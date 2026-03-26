import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// Load Firebase Config for Cloud Sync
let db: any = null;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("[Firebase] initialized for backend sync");
} catch (e) {
  console.warn("[Firebase] Could not initialize sync, falling back to local files only:", e instanceof Error ? e.message : String(e));
}

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SEO_FILE = path.join(DATA_DIR, "seo_configs.json");
const SOURCES_FILE = path.join(DATA_DIR, "news_sources.json");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics_config.json");
const TRAFFIC_FILE = path.join(DATA_DIR, "traffic_stats.json");
const ADSENSE_FILE = path.join(DATA_DIR, "adsense_config.json");

// Default SEO data
const DEFAULT_SEO = {
  all: {
    title: "SpotSmart Notizie 2024-2025 | Il tuo Hub Intelligente di Informazione",
    description: "SpotSmart 2024/2025: Il tuo hub intelligente per le notizie in tempo reale. Cronaca, Mondo, Tecnologia, Finanza e Scienza in un'unica piattaforma innovativa.",
    keywords: "notizie oggi, news tempo reale, attualità 2025, aggregatore notizie, informazione intelligente, spotsmart",
    url: "https://spotsmart.it/explore/all"
  },
  cronaca: {
    title: "Ultime Notizie Cronaca Italia 2024-2025 | SpotSmart Live",
    description: "Resta aggiornato sulla cronaca italiana e internazionale: le ultime notizie, inchieste e approfondimenti sui fatti che contano. Aggiornamenti real-time da ANSA e Adnkronos.",
    keywords: "cronaca italia oggi, notizie cronaca ultime ore, inchieste giudiziarie, sicurezza urbana 2025, politica italiana news",
    url: "https://spotsmart.it/explore/cronaca"
  },
  mondo: {
    title: "Notizie dal Mondo e Geopolitica 2025 | SpotSmart Estero",
    description: "Analisi approfondite su geopolitica, conflitti e sfide globali. Rimani informato sugli eventi che plasmano il nostro futuro con Reuters, BBC e fonti internazionali.",
    keywords: "notizie internazionali, geopolitica 2025, crisi medio oriente, elezioni usa 2024 analisi, breaking news mondo",
    url: "https://spotsmart.it/explore/mondo"
  },
  regioni: {
    title: "Notizie Locali e Cronaca Regionale | SpotSmart Territorio",
    description: "Le voci del territorio italiano in tempo reale. Cronaca, eventi e politica locale da Messaggero, Gazzettino e le principali testate regionali.",
    keywords: "notizie locali, cronaca regionale, news territorio, gazzettino, messaggero, eventi città italia",
    url: "https://spotsmart.it/explore/regioni"
  },
  tecnologia: {
    title: "Tecnologia, AI e Innovazione 2025 | SpotSmart Tech",
    description: "Scopri le innovazioni in AI generativa, robotica e cybersecurity. Il tuo portale sulle tendenze tech che stanno ridefinendo il futuro con Wired e TechCrunch.",
    keywords: "tecnologia 2025, ai generativa news, cybersecurity aziendale, robotica avanzata, realtà virtuale news, innovazione digitale",
    url: "https://spotsmart.it/explore/tecnologia"
  },
  finanza: {
    title: "Economia e Finanza: Mercati e Borse 2025 | SpotSmart Business",
    description: "Previsioni mercati globali, investimenti e andamento economico. Analisi per decisioni informate con Il Sole 24 Ore e CNBC. Borsa Italiana in tempo reale.",
    keywords: "mercati finanziari 2025, investimenti sicuri, borsa italiana oggi, inflazione italia news, economy globale, trading online",
    url: "https://spotsmart.it/explore/finanza"
  },
  sport: {
    title: "Ultime Notizie Sport, Risultati e Calciomercato | SpotSmart Sport",
    description: "Tutte le ultime notizie su Calcio Serie A, Tennis ATP, F1 e Olimpiadi. Risultati in diretta, interviste e analisi esclusive dalla Gazzetta e Tuttosport.",
    keywords: "risultati serie a 2025, calciomercato live, tennis atp news, formula 1 oggi, moto gp risultati, sport news italia",
    url: "https://spotsmart.it/explore/sport"
  },
  scienza: {
    title: "Scienza, Spazio e Medicina 2025 | SpotSmart Science",
    description: "Le scoperte che cambiano il mondo. Dalle missioni spaziali NASA ai progressi della medicina e ricerca scientifica. Resta aggiornato con Nature e ScienceDaily.",
    keywords: "scoperte scientifiche 2025, esplorazione spaziale, news medicina 2024, astronomia nasa, ricerca scientifica innovazione",
    url: "https://spotsmart.it/explore/scienza"
  },
  cultura: {
    title: "Cultura, Arte e Tendenze Sociali 2025 | SpotSmart Culture",
    description: "Esplora le nuove tendenze artistiche, letterarie e sociali. Approfondimenti su eventi, mostre e il dibattito culturale contemporaneo in Italia e nel mondo.",
    keywords: "eventi culturali 2025, arte contemporanea news, libri novità, festival cinema italia, tendenze sociali, mostre d'arte",
    url: "https://spotsmart.it/explore/cultura"
  },
  salute: {
    title: "Salute, Benessere e News Sanità Italia | SpotSmart Health",
    description: "Le ultime notizie sulla sanità pubblica, consigli per il benessere e aggiornamenti sulla prevenzione. Prendi cura di te con informazioni mediche affidabili.",
    keywords: "sanità italia 2025, benessere mentale news, prevenzione malattie, alimentazione sana, news medicina, stili di vita sani",
    url: "https://spotsmart.it/explore/salute"
  }
};

// Default AdSense data
const DEFAULT_ADSENSE = {
  enabled: false,
  client: "", // e.g. ca-pub-XXXXXXXXXXXXXXXX
  script: "", // Full script snippet
  adsTxt: "", // Content for ads.txt
  metaTag: "" // Meta tag verification
};

// Initialize files if missing
if (!fs.existsSync(SEO_FILE)) fs.writeFileSync(SEO_FILE, JSON.stringify(DEFAULT_SEO, null, 2));
if (!fs.existsSync(ANALYTICS_FILE)) fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ trackingId: "", enabled: true, verificationTag: "" }, null, 2));
if (!fs.existsSync(ADSENSE_FILE)) fs.writeFileSync(ADSENSE_FILE, JSON.stringify(DEFAULT_ADSENSE, null, 2));

let cachedSeo: any = null;
function getSeoConfigs() {
  if (cachedSeo) return cachedSeo;
  try { 
    cachedSeo = JSON.parse(fs.readFileSync(SEO_FILE, "utf-8")); 
    return cachedSeo;
  } catch (err) { return DEFAULT_SEO; }
}
function saveSeoConfigs(configs: any) { 
  cachedSeo = configs;
  fs.writeFileSync(SEO_FILE, JSON.stringify(configs, null, 2)); 
}

// Config Cache for Production/Cloud
let cachedAdSense: any = null;
let cachedAnalytics: any = null;
let lastSync = 0;

async function syncCloudConfigs() {
  if (!db) return;
  const now = Date.now();
  if (now - lastSync < 60000 && cachedAdSense) return; // Sync every 60s max per instance

  try {
    const adsDoc = await getDoc(doc(db, 'configs', 'adsense'));
    if (adsDoc.exists()) cachedAdSense = adsDoc.data();
    
    const anaDoc = await getDoc(doc(db, 'configs', 'analytics'));
    if (anaDoc.exists()) cachedAnalytics = anaDoc.data();

    const seoDoc = await getDoc(doc(db, 'configs', 'seo'));
    if (seoDoc.exists()) cachedSeo = seoDoc.data();
    
    lastSync = now;
    console.log("[Cloud] All configs synced from Firestore");
  } catch (e) {
    console.warn("[Cloud] Sync failed, using local/cache fallback:", e);
  }
}

function getAnalytics() {
  if (cachedAnalytics) return cachedAnalytics;
  try { return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8")); } 
  catch (err) { return { trackingId: "", enabled: true, verificationTag: "" }; }
}
function saveAnalytics(data: any) { 
  try { fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function getAdSense() {
  if (cachedAdSense) return cachedAdSense;
  try { return JSON.parse(fs.readFileSync(ADSENSE_FILE, "utf-8")); } 
  catch (err) { return DEFAULT_ADSENSE; }
}
function saveAdSense(data: any) { 
  try { fs.writeFileSync(ADSENSE_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function getSources() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8")); } catch (err) { return []; }
}
function saveSources(sources: any) { fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2)); }

// Memory Buffers for Traffic to prevent Watcher Loops
let memoryTraffic = { total: 0, today: 0, lastUpdate: new Date().toDateString(), history: {} };
try {
  const data = JSON.parse(fs.readFileSync(TRAFFIC_FILE, "utf-8"));
  if (data.lastUpdate === memoryTraffic.lastUpdate) {
     memoryTraffic = data;
  } else {
     memoryTraffic = { ...data, today: 0, lastUpdate: memoryTraffic.lastUpdate };
  }
} catch (e) {}
let isTrafficDirty = false;

function recordVisit() {
  const today = new Date().toDateString();
  if (memoryTraffic.lastUpdate !== today) {
     memoryTraffic.today = 0;
     memoryTraffic.lastUpdate = today;
  }
  memoryTraffic.total += 1;
  memoryTraffic.today += 1;
  memoryTraffic.history[today] = (memoryTraffic.history[today] || 0) + 1;
  isTrafficDirty = true;
  return memoryTraffic;
}

function resetTraffic() {
  memoryTraffic = { 
    total: 0, 
    today: 0, 
    lastUpdate: new Date().toDateString(), 
    history: {} 
  };
  isTrafficDirty = true;
  // Also try to clear in Firestore if we have a connection
  if (db) {
     setDoc(doc(db, 'traffic', 'stats'), { ...memoryTraffic, lastUpdate: memoryTraffic.lastUpdate })
       .catch(e => console.error("[Cloud] Traffic reset sync failed:", e));
  }
  return memoryTraffic;
}

// Persist to disk every 30 seconds if dirty, to avoid triggering watchers constantly
setInterval(() => {
  if (isTrafficDirty) {
    try {
      fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(memoryTraffic, null, 2));
      isTrafficDirty = false;
    } catch (e) {
      console.error("[Traffic] Failed to persist stats:", e);
    }
  }
}, 30000);

// Global app object
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

// Helper for SEO Injection
function injectMetadata(html: string, config: any, analytics: any, adsense: any, reqUrl: string) {
  const gaScript = (analytics?.enabled && analytics?.trackingId) ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${analytics.trackingId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${analytics.trackingId}');
    </script>
  ` : '';

  let adsenseHead = "";
  let adsenseBody = "";
  
  if (adsense?.enabled && adsense?.script) {
     const scriptStr = adsense.script.trim();
     if (scriptStr.includes('<amp-auto-ads')) {
        // Extract script part for head
        const scriptMatch = scriptStr.match(/<script.*?src=.*?amp-auto-ads.*?><\/script>/i);
        adsenseHead = scriptMatch ? scriptMatch[0] : "";
        
        // Extract tag part for body
        const tagMatch = scriptStr.match(/<amp-auto-ads.*?>.*?<\/amp-auto-ads>/i);
        adsenseBody = tagMatch ? tagMatch[0] : "";
        
        // If they provided both but regex failed or they are separate, try to find the tag anywhere
        if (!adsenseBody && scriptStr.includes('<amp-auto-ads')) {
           adsenseBody = scriptStr.includes('</amp-auto-ads>') 
              ? scriptStr.substring(scriptStr.indexOf('<amp-auto-ads'), scriptStr.indexOf('</amp-auto-ads>') + 15)
              : scriptStr; 
        }
     } else {
        adsenseHead = scriptStr;
     }
  }

  const adsenseMeta = (adsense?.enabled && adsense?.metaTag && adsense?.metaTag.trim().startsWith('<')) ? adsense.metaTag : '';
  const analyticsMeta = (analytics?.enabled && analytics?.verificationTag && analytics?.verificationTag.trim().startsWith('<')) ? analytics.verificationTag : '';

  let injected = html;
  
  // 1. Title
  injected = injected.replace(/<title>(.*?)<\/title>/i, `<title>${config?.title || "SpotSmart"}</title>`);
  
  // 2. Head Tags
  const headTags = `
    <meta name="description" content="${config?.description || ""}" />
    <meta name="keywords" content="${config?.keywords || ""}" />
    <meta property="og:title" content="${config?.title || ""}" />
    <meta property="og:description" content="${config?.description || ""}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://spotsmart.it${reqUrl}" />
    <link rel="canonical" href="https://spotsmart.it${reqUrl}" />
    ${analyticsMeta}
    ${adsenseMeta}
    ${adsenseHead}
    ${gaScript}
  `;
  
  injected = injected.replace(/<\/head>/i, `${headTags}</head>`);
  
  // 3. Body Tags (right after <body>)
  if (adsenseBody) {
     injected = injected.replace(/<body.*?>/i, (match) => `${match}\n${adsenseBody}`);
  }

  return injected;
}

app.use(cors());
app.use(express.json());

// Ads.txt for AdSense
app.get("/ads.txt", async (req, res) => {
  await syncCloudConfigs();
  const adsense = getAdSense();
  res.header("Content-Type", "text/plain");
  res.send(adsense.adsTxt || "google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0");
});

// Proxy for Article Loading (Improved with Reading Mode & Stability)
app.get("/api/proxy", async (req, res) => {
  const url = req.query.url as string;
  const mode = req.query.mode as string; // 'read' for reader view
  
  if (!url) return res.status(400).send("URL is required");

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

    let html = await response.text();
    const $ = cheerio.load(html);
    
    // Inject <base> tag to fix relative links
    const baseUrl = new URL(url).origin;
    const baseTag = `<base href="${baseUrl}/">`;

    if (mode === 'read') {
      // READING MODE: Extract only relevant content
      // Remove noise
      $('script, style, iframe, ads, .ads, .adv, aside, header, footer, nav, .menu, .sidebar, .comments, .related').remove();
      
      // User explicitly asked "senza immagini" (without images)
      $('img, picture, svg, video, figure').remove();

      // Find main content
      let content = $('article').html() || 
                    $('.article-body').html() || 
                    $('.post-content').html() || 
                    $('.content').html() || 
                    $('#main-content').html() || 
                    $('main').html() || 
                    $('body').html();

      // Basic styling for the clean view
      const cleanHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          ${baseTag}
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              line-height: 1.6; 
              color: #1a1a1a; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 2rem 1.5rem;
              background: #fff;
            }
            h1, h2, h3 { line-height: 1.2; margin-top: 2rem; color: #000; }
            p { margin-bottom: 1.5rem; font-size: 1.1rem; }
            a { color: #4f46e5; text-decoration: none; }
            a:hover { text-decoration: underline; }
            ul, ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
            li { margin-bottom: 0.5rem; }
            blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin-left: 0; font-style: italic; color: #4b5563; }
            .read-time { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; display: block; }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `;
      return res.send(cleanHtml);
    }
    
    // ORIGINAL MODE: Strip scripts and fix frame-breaking
    const troublesomeSites = [
      'engadget.com', 'yahoo.com', 'techcrunch.com', 'reuters.com', 'cnbc.com', 
      'ansa.it', 'hdblog.it', 'wired.it', 'tomshw.it', 'dday.it', 'macitynet.it',
      'theverge.com', 'vox.com', 'polygon.com', 'repubblica.it', 'corriere.it'
    ];
    const needsStripping = troublesomeSites.some(site => url.toLowerCase().includes(site));

    if (needsStripping) {
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<link rel="preload" as="script" [^>]*>/gi, '');
      
      // Expanded frame-breaking protection (GAMESPULSE ELITE STABILITY)
      html = html.replace(/if\s*\(top\s*!==\s*self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/if\s*\(window\.top\s*!==\s*window\.self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/if\s*\(parent\s*!==\s*self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/top\.location\.href\s*=\s*(self|window)\.location\.href/gi, '');
      html = html.replace(/window\.top\s*=\s*window/gi, '');
      html = html.replace(/location\.replace/g, '//location.replace');
    }

    // Extra script for frame isolation and interaction handling
    const frameScript = `
      <script>
        (function() {
          // Absolute Isolation
          try {
            window.top = window.self;
            window.parent = window.self;
            Object.defineProperty(window, 'top', { get: function() { return window.self; } });
            Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
          } catch(e) {}

          // Prevent app-hangs from heavy scripts that might still be alive
          window.onerror = function() { return true; };
          
          document.addEventListener('DOMContentLoaded', () => {
             document.documentElement.style.overflowX = 'hidden';
             document.body.style.overflowX = 'hidden';
             
             // Open all links in top window if they try to escape
             document.querySelectorAll('a').forEach(a => {
               if (a.target === '_top' || a.target === '_parent') {
                 a.target = '_blank';
               }
             });
          });
        })();
      </script>
    `;

    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}${frameScript}`);
    } else {
      html = `${baseTag}${frameScript}${html}`;
    }

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Failed to load content in SpotSmart");
  }
});


// Improved Metadata Extraction (Fully Synchronized with GamesPulse)
async function fetchMetaInfo(url: string) {
  if (!url) return { image: null, video: null };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // Increased to 12s for heavy sites
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      } 
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { image: null, video: null };
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') ||
                  $('meta[property="og:image:secure_url"]').attr('content') ||
                  $('meta[name="thumbnail"]').attr('content') ||
                  $('link[rel="image_src"]').attr('href') ||
                  $('link[rel="apple-touch-icon"]').attr('href') ||
                  $('meta[name="msapplication-TileImage"]').attr('content');
    
    let video = $('meta[property="og:video:url"]').attr('content') ||
                $('meta[property="og:video:secure_url"]').attr('content') ||
                $('meta[property="og:video"]').attr('content') ||
                $('meta[name="twitter:player"]').attr('content') ||
                $('meta[property="og:video:iframe"]').attr('content') ||
                $('meta[name="twitter:player:stream"]').attr('content') ||
                $('link[rel="alternate"][type="application/json+oembed"]').attr('href');

    if (!video) {
      video = $('video source').attr('src') || $('video').attr('src');
    }

    // Handle YouTube links in meta tags
    if (video && (video.includes('youtube.com') || video.includes('youtu.be'))) {
      const ytId = video.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (ytId) video = `https://www.youtube.com/embed/${ytId}`;
    }

    let finalImage = image || null;
    if (finalImage && !finalImage.startsWith('http')) {
      try {
        finalImage = new URL(finalImage, url).href;
      } catch {
        finalImage = null;
      }
    }
    return { image: finalImage, video: video || null };
  } catch (e) {
    return { image: null, video: null };
  }
}

function extractImageUrl(item: any) {
  // 1. Enclosure
  if (item.enclosure && item.enclosure.url) {
    if (item.enclosure.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) return item.enclosure.url;
  }
  
  // 2. Media Content / Thumbnail / Group
  const mediaTags = ["media:content", "media:thumbnail", "media:group", "image", "enclosure", "thumb", "og:image", "twitter:image"];
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
  const imgMatch = content.match(/<img[^>]+(?:src|data-src|srcset|original-src)=["']([^"'> ]+)["']/i);
  if (imgMatch) {
    const url = imgMatch[1];
    if (!url.includes('pixel') && !url.includes('analytics') && !url.includes('doubleclick') && !url.includes('spacer')) {
      return url;
    }
  }

  return null;
}

function extractVideoUrl(item: any) {
  const content = (item.content || item["content:encoded"] || item.description || "").toLowerCase();
  
  if (item['yt:videoId']) return `https://www.youtube.com/embed/${item['yt:videoId']}`;
  if (item.id && item.id.startsWith('yt:video:')) return `https://www.youtube.com/embed/${item.id.replace('yt:video:', '')}`;

  const ytMatch = content.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  
  const vimeoMatch = content.match(/https?:\/\/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  const iframeMatch = content.match(/<iframe[^>]+src=["']([^"']+)["']/);
  if (iframeMatch) {
    const src = iframeMatch[1];
    if (src.includes('youtube.com') || src.includes('youtu.be')) {
      const ytId = src.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (ytId) return `https://www.youtube.com/embed/${ytId}`;
    }
    if (src.includes('vimeo.com')) {
      const vimeoId = src.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
  }

  const videoFileMatch = content.match(/https?:\/\/[^"'>]+\.(mp4|webm|ogg)/);
  if (videoFileMatch) return videoFileMatch[0];

  if (item["media:content"]) {
    const media = Array.isArray(item["media:content"]) ? item["media:content"] : [item["media:content"]];
    const video = media.find((m: any) => m.$ && (m.$.type?.includes('video') || m.$.medium === 'video' || m.$.url?.match(/\.(mp4|webm|ogg)$/)));
    if (video && video.$.url) return video.$.url;
  }

  return null;
}

function cleanXmlContent(xml: string): string {
  let cleaned = xml;
  // 1. Fix unescaped ampersands in titles/descriptions (common in brittle Italian feeds)
  cleaned = cleaned.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
  
  // 2. Fix unquoted attributes
  cleaned = cleaned.replace(/<([a-zA-Z0-9:_.-]+)\s+([^>]*?)\s*>/g, (match, tagName, attrs) => {
    const sanitizedAttrs = attrs.replace(/([a-zA-Z0-9:_.-]+)(?!=)(\s|$)/g, '$1=""$2');
    return `<${tagName} ${sanitizedAttrs}>`;
  });

  // 2.5 Fix numeric attribute names (XML doesn't allow them, but some feeds use them)
  cleaned = cleaned.replace(/(\s)([0-9][a-zA-Z0-9:_.-]*=)/g, '$1attr_$2');
  cleaned = cleaned.replace(/(\s[a-zA-Z0-9:_.-]+)\s*=\s*(["'])/g, '$1=$2');

  // 3. Ensure HTML content within RSS tags is wrapped in CDATA if it contains tags
  cleaned = cleaned.replace(/<(title|description|content:encoded)>([\s\S]*?)<\/\1>/g, (match, tag, content) => {
    if (content.includes('<') && !content.trim().startsWith('<![CDATA[')) {
      return `<${tag}><![CDATA[${content}]]></${tag}>`;
    }
    return match;
  });

  return cleaned;
}

interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  category: string;
  source: string;
  imageUrl: string | null;
  videoUrl: string | null;
  time: string;
  timestamp: number;
}

app.get("/api/news", async (req, res) => {
  const { url, category, source } = req.query;
  try {
    const response = await fetch(url as string, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} when fetching feed`);
    let rawXml = await response.text();
    
    // GAMESPULSE UPGRADE: Clean and normalize XML string before parsing
    const xml = cleanXmlContent(rawXml);

    let items: NewsItem[] = [];
    
    try {
      // Primary Parser: Rss-Parser
      const feed = await parser.parseString(xml);
      items = feed.items.map((item) => {
        return {
          id: item.guid || item.link || Math.random().toString(),
          title: item.title,
          url: item.link,
          summary: (item.contentSnippet || item.summary || "").substring(0, 200) + "...",
          category: category as string,
          source: source as string,
          imageUrl: extractImageUrl(item),
          videoUrl: extractVideoUrl(item),
          time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
          timestamp: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
        };
      });
    } catch (parseError) {
      // GAMESPULSE UPGRADE: Cheerio Fallback for brittle feeds that still fail XML parsing
      console.warn(`[RSS Parser] Fallback to Cheerio for ${url}`);
      const $ = cheerio.load(xml, { xmlMode: true });
      $('item, entry').each((i, el) => {
        const $el = $(el);
        const title = $el.find('title').text();
        const link = $el.find('link').attr('href') || $el.find('link').text() || $el.find('link').attr('url');
        const pubDate = $el.find('pubDate, published, updated').text();
        const content = $el.find('description, content\\:encoded, summary').text();
        const guid = $el.find('guid, id').text();
        
        let image = null;
        const enclosure = $el.find('enclosure').attr('url');
        const mediaContent = $el.find('media\\:content, content').attr('url');
        const mediaThumbnail = $el.find('media\\:thumbnail, thumbnail').attr('url');
        const ogImage = $el.find('og\\:image').text();
        
        if (enclosure) image = enclosure;
        else if (mediaContent) image = mediaContent;
        else if (mediaThumbnail) image = mediaThumbnail;
        else if (ogImage) image = ogImage;
        else {
          const imgMatch = content.match(/<img[^>]+(?:src|data-src|srcset)="([^"> ]+)"/);
          if (imgMatch) image = imgMatch[1];
        }

        if (title && link) {
          items.push({
            id: guid || link || Math.random().toString(),
            title,
            url: link,
            summary: content.replace(/<[^>]*>?/gm, '').substring(0, 200) + "...",
            category: category as string,
            source: source as string,
            imageUrl: image,
            videoUrl: extractVideoUrl({ content }),
            time: pubDate ? new Date(pubDate).toLocaleTimeString() : new Date().toLocaleTimeString(),
            timestamp: pubDate ? new Date(pubDate).getTime() : Date.now()
          });
        }
      });
    }

    // Deep enhancement for items without media (increased to 20 per feed for better coverage)
    const newsToEnhance = items.filter(item => !item.imageUrl || !item.videoUrl).slice(0, 20);
    if (newsToEnhance.length > 0) {
      await Promise.all(newsToEnhance.map(async (item) => {
        try {
          const meta = await fetchMetaInfo(item.url || "");
          if (!item.imageUrl && meta.image) item.imageUrl = meta.image;
          if (!item.videoUrl && meta.video) item.videoUrl = meta.video;
        } catch (e) {
          console.error(`Failed to enhance ${item.url}:`, e);
        }
      }));
    }

    // Final cleanup: if still no image, use a premium news fallback instead of picsum
    items = items.map(item => ({
      ...item,
      imageUrl: item.imageUrl || `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1600`
    }));

    res.send(items);
  } catch (error) {
    console.error("RSS Fetch error:", error);
    res.status(500).send("Failed to fetch news feed");
  }
});

app.get("/api/admin/seo", async (req, res) => {
  await syncCloudConfigs();
  res.json(getSeoConfigs());
});

app.post("/api/admin/seo", express.json(), async (req, res) => {
  const { auth, category, data } = req.body;
  if (auth?.username !== 'admin' || auth?.password !== 'accessometti') return res.status(401).send("Unauthorized");
  const current = getSeoConfigs();
  current[category] = data;
  saveSeoConfigs(current);
  if (db) await setDoc(doc(db, 'configs', 'seo'), current).catch(console.error);
  res.send("Saved");
});

app.get("/api/admin/sources", (req, res) => res.json(getSources()));
app.post("/api/admin/sources", express.json(), (req, res) => {
  const { auth, sources } = req.body;
  if (auth?.username !== 'admin' || auth?.password !== 'accessometti') return res.status(401).send("Unauthorized");
  saveSources(sources);
  res.send("Saved");
});

app.get("/api/admin/analytics", async (req, res) => {
  await syncCloudConfigs();
  res.json(getAnalytics());
});

app.post("/api/admin/analytics", express.json(), async (req, res) => {
  const { auth, data } = req.body;
  if (auth?.username !== 'admin' || auth?.password !== 'accessometti') return res.status(401).send("Unauthorized");
  saveAnalytics(data);
  cachedAnalytics = data;
  if (db) await setDoc(doc(db, 'configs', 'analytics'), data).catch(console.error);
  res.send("Saved");
});

app.get("/api/admin/adsense", async (req, res) => {
  await syncCloudConfigs();
  const data = getAdSense();
  res.json(data);
});

app.post("/api/admin/adsense", express.json(), async (req, res) => {
  const { auth, data } = req.body;
  if (auth?.username !== 'admin' || auth?.password !== 'accessometti') return res.status(401).send("Unauthorized");
  
  if (!data) return res.status(400).send("No data provided");

  // Instant update memory to avoid loop/delay
  cachedAdSense = data;
  saveAdSense(data);

  // Sync to Cloud as well
  if (db) {
    try {
      await setDoc(doc(db, 'configs', 'adsense'), data);
      console.log("[Cloud] AdSense synced to Firestore successfully");
    } catch (e) {
      console.error("[Cloud] AdSense sync failed:", e);
    }
  }

  res.send("Saved Successfully");
});

// AdSense ads.txt serving
app.get("/ads.txt", (req, res) => {
  const adsense = getAdSense();
  res.type("text/plain");
  res.send(adsense.adsTxt || "");
});

app.get("/api/admin/traffic", (req, res) => res.json(memoryTraffic));
app.post("/api/admin/traffic/reset", express.json(), (req, res) => {
  const { auth } = req.body;
  if (auth?.username !== 'admin' || auth?.password !== 'accessometti') return res.status(401).send("Unauthorized");
  const resetData = resetTraffic();
  res.json(resetData);
});

async function startServer() {
  const PORT = 3000;
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          ignored: ['**/.data/**', '**/traffic_stats.json', '**/adsense_config.json', '**/seo_configs.json', '**/analytics_config.json', '**/news_sources.json']
        }
      },
      appType: "custom", // Changed to custom to handle index.html manually
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        await syncCloudConfigs(); // Ensure fresh config for injection
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        
        const urlPath = req.path.split('/').filter(Boolean).pop()?.toLowerCase() || 'all';
        const configs = getSeoConfigs();
        const config = configs[urlPath] || configs.all;
        const analytics = getAnalytics();
        const adsense = getAdSense();
        
        recordVisit();
        const html = injectMetadata(template, config, analytics, adsense, url);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", async (req, res) => {
      await syncCloudConfigs(); // Cloud sync on production
      const urlPath = req.path.split('/').filter(Boolean).pop()?.toLowerCase() || 'all';
      const configs = getSeoConfigs();
      const config = configs[urlPath] || configs.all;
      const analytics = getAnalytics();
      const adsense = getAdSense();
      
      recordVisit();
      const template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
      const html = injectMetadata(template, config, analytics, adsense, req.originalUrl);
      res.send(html);
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
