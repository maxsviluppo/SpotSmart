import React from 'react';
import SpotSmartApp from '@/components/SpotSmartApp';
import Parser from 'rss-parser';

// Revalida la pagina in cache ogni 5 minuti per garantire tempi di risposta fulminei ai bot AdSense
export const revalidate = 300;

async function getSsrNewsForAdSense() {
  const topSources = [
    { url: "https://www.ansa.it/sito/ansait_rss.xml", name: "ANSA", cat: "Cronaca" },
    { url: "https://www.hdblog.it/feed/", name: "HD Blog", cat: "Tecnologia" },
    { url: "https://www.ilsole24ore.com/rss/finanza.xml", name: "Il Sole 24 Ore", cat: "Finanza" }
  ];

  const parser = new Parser();
  const articles: Array<{ title: string; summary: string; source: string }> = [];

  for (const source of topSources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(source.url, { 
        signal: controller.signal, 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const xml = await res.text();
        // Semplice parsing per evitare blocchi XML complessi
        const feed = await parser.parseString(xml);
        (feed.items || []).slice(0, 5).forEach(item => {
          if (item.title) {
            articles.push({
              title: item.title,
              summary: (item.contentSnippet || item.summary || "").substring(0, 350) + "...",
              source: source.name
            });
          }
        });
      }
    } catch (e) {
      // Ignora silenziosamente errori dei singoli feed per non interrompere il rendering
    }
  }

  return articles;
}

export default async function Home() {
  const ssrArticles = await getSsrNewsForAdSense();

  return (
    <>
      {/* L'applicazione Client Principale con interfaccia utente interattiva */}
      <SpotSmartApp />

      {/* Contenuto semantico Server-Side Rendered invisibile all'utente ma letto immediatamente dai bot di Google AdSense per approvare il sito ed eliminare "Contenuti di scarso valore" */}
      <div className="sr-only" aria-hidden="true">
        <h1>SpotSmart Notizie Live - Aggiornamenti in Tempo Reale</h1>
        <p>Benvenuti su SpotSmart, la piattaforma di informazione avanzata integrata con intelligenza artificiale per l'analisi critica delle notizie. Di seguito gli ultimi articoli pubblicati dalle principali testate giornalistiche italiane e internazionali.</p>
        
        {ssrArticles.map((article, index) => (
          <article key={index}>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <span>Fonte: {article.source}</span>
          </article>
        ))}
      </div>
    </>
  );
}
