import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Calendar, ExternalLink, Info } from "lucide-react";
import Parser from 'rss-parser';
import { FEEDS } from '@/components/feeds';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  category: string;
  source: string;
  imageUrl: string;
  videoUrl?: string | null;
  time: string;
  timestamp: number;
  slug?: string;
}

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

async function fallbackDirectParse(): Promise<NewsItem[]> {
  const articles: NewsItem[] = [];
  try {
    const parser = new Parser();
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
          (feed.items || []).slice(0, 10).forEach(item => {
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
  return articles;
}

async function getArticle(slug: string): Promise<NewsItem | null> {
  const appUrl = getAppUrl();
  try {
    const res = await fetch(`${appUrl}/api/news`, { 
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });
    
    if (res.ok) {
      const news: NewsItem[] = await res.json();
      if (Array.isArray(news)) {
        const found = news.find((item) => item.slug === slug);
        if (found) return found;
      }
    }
  } catch (error) {
    console.error("Error fetching article from news API:", error);
  }

  // Fallback direct parse search
  try {
    const fallbackNews = await fallbackDirectParse();
    const found = fallbackNews.find((item) => item.slug === slug);
    if (found) return found;
  } catch (e) {
    console.error("Error in fallback direct parse:", e);
  }

  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const article = await getArticle(resolvedParams.slug);
  
  if (!article) {
    return {
      title: "Articolo non trovato | SpotSmart",
    };
  }

  return {
    title: `${article.title} | SpotSmart`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      publishedTime: new Date(article.timestamp).toISOString(),
      authors: [article.source],
      images: article.imageUrl ? [{ url: article.imageUrl }] : [],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const article = await getArticle(resolvedParams.slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 font-montserrat selection:bg-indigo-500 selection:text-white">
      {/* Dynamic blurred background glow */}
      {article.imageUrl && (
        <div className="absolute top-0 left-0 right-0 h-[50vh] z-0 overflow-hidden pointer-events-none">
          <img 
            src={article.imageUrl} 
            alt="" 
            className="w-full h-full object-cover opacity-10 blur-3xl scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
        </div>
      )}

      {/* Content Container */}
      <article className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Navigation back */}
        <Link 
          href={`/?article=${article.slug}`}
          className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest text-indigo-400 hover:text-indigo-300 uppercase transition-colors mb-10 group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Torna alla Reader View
        </Link>

        {/* Article Meta Header */}
        <div className="space-y-6 mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[9px] font-bold tracking-widest uppercase text-indigo-300">
              {article.source}
            </span>
            <span className="text-zinc-500 text-xs font-semibold">•</span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-bold tracking-widest uppercase text-zinc-400">
              {article.category}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(article.timestamp).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </div>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight text-white">
            {article.title}
          </h1>
        </div>

        {/* Featured Image */}
        {article.imageUrl && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.6)] mb-8">
            <img 
              src={article.imageUrl} 
              alt={article.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Article Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="prose prose-invert max-w-none text-zinc-300 text-base md:text-lg leading-relaxed space-y-6 font-normal">
              <p className="font-semibold text-white text-lg md:text-xl border-l-2 border-indigo-500 pl-4 py-1 italic">
                {article.summary}
              </p>
              
              <p>
                Questo articolo è un estratto di notizie aggregate in tempo reale da <strong className="text-white">{article.source}</strong> nella sezione <strong className="text-indigo-400 capitalize">{article.category}</strong>. Per leggere la versione completa comprensiva di gallerie multimediali, approfondimenti e commenti, ti invitiamo a visitare la fonte ufficiale.
              </p>
            </div>

            {/* Link to external source */}
            <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 items-center">
              <a 
                href={article.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                Continua su {article.source}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Google AdSense Blocco Annuncio inside content */}
            <div className="w-full py-8 border-t border-b border-white/5 my-8 flex flex-col items-center">
              <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-600 uppercase mb-4">Annuncio Pubblicitario</span>
              <ins className="adsbygoogle"
                   style={{ display: "block", textAlign: "center" }}
                   data-ad-layout="in-article"
                   data-ad-format="fluid"
                   data-ad-client="ca-pub-1385801472165821"
                   data-ad-slot="default"></ins>
            </div>
          </div>

          {/* Right Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-5 space-y-4 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 pb-2 border-b border-white/5 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                Informazioni
              </h3>
              
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 uppercase font-bold block mb-1">Fonte Originaria:</span>
                  <span className="font-semibold text-white">{article.source}</span>
                </div>

                <div>
                  <span className="text-zinc-500 uppercase font-bold block mb-1">Categoria:</span>
                  <span className="font-semibold text-indigo-400 capitalize">{article.category}</span>
                </div>

                <div>
                  <span className="text-zinc-500 uppercase font-bold block mb-1">Data di Acquisizione:</span>
                  <span className="font-semibold text-white">
                    {new Date(article.timestamp).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })} del {new Date(article.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-zinc-950/20 border border-dashed border-white/10 rounded-2xl text-center space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">Ti piace SpotSmart?</h4>
              <p className="text-xs text-zinc-500">Aggiungi la web app alla schermata home per ricevere gli ultimi aggiornamenti istantanei in tempo reale.</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
