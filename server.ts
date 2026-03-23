import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const app = express();
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      ['image', 'image'],
      ['thumbnail', 'thumbnail'],
      ['yt:videoId', 'yt:videoId']
    ]
  }
});

app.use(cors());
app.use(express.json());

// Proxy for Article Loading (Taken from GamesPulse)
app.get("/api/proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("URL is required");

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

    let html = await response.text();
    
    // Inject <base> tag to fix relative links and images
    const baseUrl = new URL(url).origin;
    const baseTag = `<base href="${baseUrl}/">`;
    
    // Strip scripts for specific sites known to cause issues in iframes
    const troublesomeSites = ['engadget.com', 'yahoo.com', 'techcrunch.com', 'reuters.com', 'cnbc.com', 'ansa.it'];
    const needsStripping = troublesomeSites.some(site => url.toLowerCase().includes(site));

    if (needsStripping) {
      // Remove scripts and preload links to prevent rehydration crashes
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<link rel="preload" as="script" [^>]*>/gi, '');
      html = html.replace(/<next-route-announcer>[\s\S]*?<\/next-route-announcer>/gi, '');
    }

    // Add Base Tag for relative assets
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}`);
    } else {
      html = `${baseTag}${html}`;
    }

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Failed to load content in SpotSmart");
  }
});

// Improved Metadata Extraction (Taken from GamesPulse)
async function fetchMetaInfo(url: string) {
  if (!url) return { image: null, video: null };
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });
    if (!response.ok) return { image: null, video: null };
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') ||
                  $('meta[property="og:image:secure_url"]').attr('content') ||
                  $('meta[name="thumbnail"]').attr('content') ||
                  $('link[rel="image_src"]').attr('href');
    
    let video = $('meta[property="og:video:url"]').attr('content') ||
                $('meta[property="og:video:secure_url"]').attr('content') ||
                $('meta[property="og:video"]').attr('content') ||
                $('meta[name="twitter:player"]').attr('content');

    if (video && (video.includes('youtube.com') || video.includes('youtu.be'))) {
      const ytId = video.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (ytId) video = `https://www.youtube.com/embed/${ytId}`;
    }

    return { image: image || null, video: video || null };
  } catch (e) {
    return { image: null, video: null };
  }
}

function extractImage(item: any) {
  if (item["media:content"]) {
    const media = Array.isArray(item["media:content"]) ? item["media:content"] : [item["media:content"]];
    const image = media.find((m: any) => m.$ && m.$.medium === 'image' || m.$.type?.includes('image'));
    if (image && image.$.url) return image.$.url;
  }
  if (item["media:thumbnail"] && item["media:thumbnail"].$.url) return item["media:thumbnail"].$.url;
  
  const content = item.content || item["content:encoded"] || item.description || "";
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) return imgMatch[1];
  
  return null;
}

function extractVideo(item: any) {
  if (item['yt:videoId']) return `https://www.youtube.com/embed/${item['yt:videoId']}`;
  
  const content = item.content || item["content:encoded"] || item.description || "";
  const ytMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  
  if (item["media:content"]) {
    const media = Array.isArray(item["media:content"]) ? item["media:content"] : [item["media:content"]];
    const video = media.find((m: any) => m.$ && (m.$.type?.includes('video') || m.$.medium === 'video'));
    if (video && video.$.url) return video.$.url;
  }
  
  return null;
}

app.get("/api/news", async (req, res) => {
  const { url, category, source } = req.query;
  if (!url) return res.status(400).send("Feed URL is required");

  try {
    const feed = await parser.parseURL(url as string);
    const items = await Promise.all(feed.items.map(async (item) => {
      let image = extractImage(item);
      let video = extractVideo(item);

      // If no image/video found in RSS, try scraping meta tags from the article URL
      if (!image || !video) {
        const meta = await fetchMetaInfo(item.link || "");
        if (!image) image = meta.image;
        if (!video) video = meta.video;
      }

      return {
        id: item.guid || item.link || Math.random().toString(),
        title: item.title,
        url: item.link,
        summary: (item.contentSnippet || item.summary || "").substring(0, 200) + "...",
        category: category,
        source: source,
        imageUrl: image || `https://picsum.photos/seed/${Math.random()}/1600/900`,
        videoUrl: video || undefined,
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString() : new Date().toLocaleTimeString()
      };
    }));
    res.send(items);
  } catch (error) {
    console.error("RSS Fetch error:", error);
    res.status(500).send("Failed to fetch news feed");
  }
});

async function startServer() {
  const PORT = 3000;
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SpotSmart server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
