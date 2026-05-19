import React from 'react';
import SpotSmartAppWrapper from '@/components/SpotSmartAppWrapper';
import Parser from 'rss-parser';
import { FEEDS } from '@/components/feeds';

// Revalida la pagina in cache ogni 5 minuti per garantire tempi di risposta fulminei ai bot AdSense
export const revalidate = 300;

const getAppUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

function createSlug(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fallbackDirectParse(): Promise<any[]> {
  const articles: any[] = [];
  try {
    const parser = new Parser();
    // Parse top 6 sources directly to keep server response fast
    const topSources = FEEDS.slice(0, 6);
    for (const source of topSources) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(source.url, { 
          signal: controller.signal, 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          let xml = await res.text();
          xml = xml.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
          const feed = await parser.parseString(xml);
          (feed.items || []).slice(0, 6).forEach(item => {
            if (item.title) {
              articles.push({
                id: item.guid || item.link || Math.random().toString(),
                title: item.title,
                url: item.link || "",
                slug: createSlug(item.title),
                summary: (item.contentSnippet || item.summary || "").substring(0, 280) + "...",
                category: source.cat || "Generale",
                source: source.name || "Unknown",
                imageUrl: `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1600`,
                time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
                timestamp: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
              });
            }
          });
        }
      } catch (e) {}
    }
  } catch (e) {}
  return articles.sort((a, b) => b.timestamp - a.timestamp);
}

async function getInitialNews() {
  const appUrl = getAppUrl();
  try {
    const res = await fetch(`${appUrl}/api/news`, {
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.error("Error fetching RSS news in page.tsx:", error);
  }

  // Fallback to direct parsing if API call fails
  console.log("Using direct RSS parsing fallback...");
  return await fallbackDirectParse();
}

export default async function Home() {
  const initialNews = await getInitialNews();

  return (
    <SpotSmartAppWrapper initialNews={initialNews} />
  );
}
