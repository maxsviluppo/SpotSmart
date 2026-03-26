
import Parser from "rss-parser";
import * as cheerio from "cheerio";
// Use global fetch

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

function extractImageUrl(item: any) {
  // 1. Enclosure
  if (item.enclosure && item.enclosure.url) {
    if (item.enclosure.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) return item.enclosure.url;
  }
  
  // 2. Media Content / Thumbnail / Group
  const mediaTags = ["media:content", "media:thumbnail", "media:group", "image", "enclosure", "thumb"];
  for (const tag of mediaTags) {
    const content = item[tag];
    if (content) {
      if (Array.isArray(content)) {
        const firstWithUrl = content.find((c: any) => {
          const url = c.$?.url || c.url || (typeof c === 'string' ? c : null) || (c["media:content"]?.[0]?.$?.url);
          return url && url.match(/\.(jpg|jpeg|png|webp|gif)/i);
        });
        if (firstWithUrl) return firstWithUrl.$?.url || firstWithUrl.url || (typeof firstWithUrl === 'string' ? firstWithUrl : null);
      }
      if (content.$ && content.$.url) {
        if (content.$.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) return content.$.url;
      }
      if (content.url && content.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) return content.url;
      if (typeof content === 'string' && content.match(/\.(jpg|jpeg|png|webp|gif)/i)) return content;
    }
  }
  
  // 3. Content/Description Regex - Prioritize content:encoded
  const content = item["content:encoded"] || item.content || item.description || "";
  const imgMatch = content.match(/<img[^>]+(?:src|data-src|srcset)=["']([^"'> ]+)["']/);
  if (imgMatch) {
    const url = imgMatch[1];
    if (!url.includes('pixel') && !url.includes('analytics') && !url.includes('doubleclick') && !url.includes('spacer')) {
      return url;
    }
  }

  return null;
}

async function testFeeds() {
  const feeds = [
    { name: "ANSA", url: "https://www.ansa.it/sito/ansait_rss.xml" },
    { name: "NASA", url: "https://www.nasa.gov/feed/" },
    { name: "HD Blog", url: "https://www.hdblog.it/feed/" }
  ];

  for (const feedConfig of feeds) {
    console.log(`\n--- Testing ${feedConfig.name} ---`);
    try {
      const response = await fetch(feedConfig.url);
      const xml = await response.text();
      const feed = await parser.parseString(xml);
      
      console.log(`Found ${feed.items.length} items`);
      for (let i = 0; i < Math.min(3, feed.items.length); i++) {
        const item = feed.items[i];
        const img = extractImageUrl(item);
        console.log(`Item ${i + 1}: ${item.title}`);
        console.log(`  Extracted Image: ${img ? img.substring(0, 100) : "NONE"}`);
        if (!img) {
            console.log(`  Keys: ${Object.keys(item).join(", ")}`);
            console.log(`  Link: ${item.link}`);
            const desc = (item as any).description || (item as any).summary || (item as any).contentSnippet || "";
            console.log(`  Description snippet: ${desc.substring(0, 100)}`);
        }
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }
}

testFeeds();
