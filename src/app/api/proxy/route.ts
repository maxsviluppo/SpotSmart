import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const mode = searchParams.get('mode');

  if (!url) {
    return new NextResponse("URL required", { status: 400 });
  }

  try {
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' 
      } 
    });
    
    let html = await response.text();
    const baseUrl = new URL(url).origin;

    if (mode === 'read') {
      const $ = cheerio.load(html);
      // Rimuoviamo elementi non essenziali per una lettura pulita
      $('script, style, nav, footer, header, iframe, .ads, .advertisement').remove();
      
      const title = $('h1').first().text() || $('title').text();
      let content = $('article').html() || $('.article-content').html() || $('.main-content').html() || $('main').html() || $('body').html();
      
      const cleanHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              color: #171717;
              background: #fdfdfd;
            }
            img { max-width: 100%; height: auto; border-radius: 8px; }
            h1 { font-size: 2rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div>${content || "Contenuto non disponibile in modalità lettura."}</div>
        </body>
        </html>
      `;
      return new NextResponse(cleanHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Default Proxy mode: iniettiamo il tag base per far caricare le risorse relative
    html = html.replace("<head>", `<head><base href="${baseUrl}/">`);
    
    // Possiamo opzionalmente aggiungere del codice frame-breaking/security se necessario
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    return new NextResponse("Proxy fetch failed", { status: 500 });
  }
}
