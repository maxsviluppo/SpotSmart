
import * as cheerio from "cheerio";

async function fetchMetaInfo(url: string) {
  if (!url) return { image: null, video: null };
  try {
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      } 
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') ||
                  $('meta[property="og:image:secure_url"]').attr('content');
    
    return { image: image || null };
  } catch (e) {
    return { error: e.message };
  }
}

async function testExtraction() {
  const url = "https://www.ansa.it/sito/notizie/cronaca/2026/03/25/la-citazione-obbedisco-da-giuseppe-garibaldi-a-daniela-santanche_6ae9308d-0e06-4b0c-9f6c-177447915538.html"; // Example url
  console.log(`Testing extraction for: ${url}`);
  const result = await fetchMetaInfo(url);
  console.log("Result:", JSON.stringify(result, null, 2));
}

testExtraction();
