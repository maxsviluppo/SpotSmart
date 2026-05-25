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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      } 
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let html = await response.text();
    const baseUrl = new URL(url).origin;
    const baseTag = `<base href="${baseUrl}/">`;

    if (mode === 'read') {
      const $ = cheerio.load(html);
      // READING MODE: Estrai solo contenuto rilevante ed elimina il superfluo
      $('script, style, iframe, ads, .ads, .adv, aside, header, footer, nav, .menu, .sidebar, .comments, .related').remove();
      
      // Rimuovi immagini e video se richiesto (modalità testo pulito)
      $('img, picture, svg, video, figure').remove();

      let content = $('article').html() || 
                    $('.article-body').html() || 
                    $('.post-content').html() || 
                    $('.content').html() || 
                    $('#main-content').html() || 
                    $('main').html() || 
                    $('body').html();
      
      const title = $('h1').first().text() || $('title').text() || "Lettura Articolo";
      
      const cleanHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          ${baseTag}
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem 1.5rem;
              color: #1a1a1a;
              background: #fff;
            }
            h1, h2, h3 { line-height: 1.2; margin-top: 2rem; color: #000; }
            p { margin-bottom: 1.5rem; font-size: 1.1rem; }
            a { color: #4f46e5; text-decoration: none; }
            a:hover { text-decoration: underline; }
            ul, ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
            li { margin-bottom: 0.5rem; }
            blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin-left: 0; font-style: italic; color: #4b5563; }
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

    // ORIGINAL MODE: Rimuovi script e aggira il blocco del caricamento in iframe (frame-breaking)
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
      
      // Protezione avanzata da frame-breaking
      html = html.replace(/if\s*\(top\s*!==\s*self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/if\s*\(window\.top\s*!==\s*window\.self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/if\s*\(parent\s*!==\s*self\)\s*\{[\s\S]*?\}/gi, '');
      html = html.replace(/top\.location\.href\s*=\s*(self|window)\.location\.href/gi, '');
      html = html.replace(/window\.top\s*=\s*window/gi, '');
      html = html.replace(/location\.replace/g, '//location.replace');
    }

    // Script iniettato per isolare l'iframe e forzare il caricamento
    const frameScript = `
      <script>
        (function() {
          try {
            window.top = window.self;
            window.parent = window.self;
            Object.defineProperty(window, 'top', { get: function() { return window.self; } });
            Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
          } catch(e) {}
          window.onerror = function() { return true; };
          document.addEventListener('DOMContentLoaded', () => {
             document.documentElement.style.overflowX = 'hidden';
             document.body.style.overflowX = 'hidden';
             document.querySelectorAll('a').forEach(a => {
               if (a.target === '_top' || a.target === '_parent') {
                 a.target = '_blank';
               }
             });
          });
        })();
      </script>
    `;

    // Iniezione tag base e frameScript in maniera case-insensitive e robusta
    const injection = `${baseTag}${frameScript}`;
    if (/<head(\s[^>]*)?>/i.test(html)) {
      html = html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${injection}`);
    } else {
      html = `${injection}${html}`;
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    return new NextResponse("Proxy fetch failed", { status: 500 });
  }
}
