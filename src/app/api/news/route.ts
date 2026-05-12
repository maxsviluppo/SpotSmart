import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { FEEDS } from '@/components/feeds';

export const dynamic = 'force-dynamic';

// Unified Cache for RSS Feeds
let serverNewsCache: any[] = [];
let lastServerFetchTime = 0;
const SERVER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

function cleanXmlContent(xml: string): string {
  let cleaned = xml.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
  cleaned = cleaned.replace(/<(title|description|content:encoded)>([\s\S]*?)<\/\1>/g, (match, tag, content) => {
    if (content.includes('<') && !content.trim().startsWith('<![CDATA[')) {
      return `<${tag}><![CDATA[${content}]]></${tag}>`;
    }
    return match;
  });
  return cleaned;
}

async function fetchMetaInfo(url: string) {
  if (!url) return { image: null, video: null };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); 
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timeoutId);
    if (!response.ok) return { image: null, video: null };
    const html = await response.text();
    const $ = cheerio.load(html);
    let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    let video = $('meta[property="og:video:url"]').attr('content') || $('meta[name="twitter:player"]').attr('content') || $('iframe[src*="youtube.com"]').attr('src');
    if (video && video.includes('youtube.com')) {
       const ytId = video.match(/(?:v=|embed\/|watch\?v=)([a-zA-Z0-9_-]{11})/)?.[1];
       if (ytId) video = `https://www.youtube.com/embed/${ytId}`;
    }
    return { image: image || null, video: video || null };
  } catch (e) { return { image: null, video: null }; }
}

function extractImageUrl(item: any) {
  const contentEncoded = item["content:encoded"] || item.content || item.description || "";
  if (item.enclosure?.url?.match(/\.(jpg|jpeg|png|webp|gif)/i)) return item.enclosure.url;
  const mediaTags = ["media:content", "media:thumbnail", "image", "enclosure", "thumb"];
  for (const tag of mediaTags) {
    const content = item[tag];
    if (content) {
      if (Array.isArray(content)) {
        const first = content.find((c: any) => (c.url || c.$?.url)?.match(/\.(jpg|jpeg|png|webp|gif)/i));
        if (first) return first.url || first.$?.url;
      }
      if (content.url || content.$?.url) return content.url || content.$?.url;
    }
  }
  const imgMatch = contentEncoded.match(/<img[^>]+(?:src|data-src)=["']([^"'> ]+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

function extractVideoUrl(item: any) {
  const content = (item.content || item["content:encoded"] || item.description || "").toLowerCase();
  const ytMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return ytMatch ? `https://www.youtube.com/embed/${ytMatch[1]}` : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const now = Date.now();

  if (!forceRefresh && serverNewsCache.length > 0 && (now - lastServerFetchTime < SERVER_CACHE_DURATION)) {
    return NextResponse.json(serverNewsCache);
  }

  try {
    // Select top active feeds for real-time aggregation speed
    const sources = FEEDS.slice(0, 40);
    const feedPromises = sources.map(async (source: any) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); 
      try {
        const response = await fetch(source.url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeoutId);
        if (!response.ok) return [];
        const xml = cleanXmlContent(await response.text());
        const feed = await parser.parseString(xml);
        return await Promise.all((feed.items || []).slice(0, 20).map(async (item) => {
          let image = extractImageUrl(item);
          let video = extractVideoUrl(item);
          if (!image) {
            const extra = await fetchMetaInfo(item.link || "");
            image = extra.image; if (!video) video = extra.video;
          }
          return {
            id: item.guid || item.link || Math.random().toString(),
            title: item.title || "",
            url: item.link || "",
            summary: (item.contentSnippet || item.summary || "").substring(0, 280) + "...",
            category: source.cat || "General",
            source: source.name || "Unknown",
            imageUrl: image || `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1600`,
            videoUrl: video || null,
            time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
            timestamp: item.pubDate ? new Date(item.pubDate).getTime() : now
          };
        }));
      } catch (e) { return []; }
    });

    const results = await Promise.allSettled(feedPromises);
    const allItems: any[] = [];
    results.forEach(res => { if (res.status === 'fulfilled') allItems.push(...res.value); });
    
    const sorted = allItems.sort((a,b) => b.timestamp - a.timestamp).slice(0, 400);
    
    serverNewsCache = sorted;
    lastServerFetchTime = now;
    return NextResponse.json(sorted);
  } catch (e) { 
    return NextResponse.json(serverNewsCache); 
  }
}
