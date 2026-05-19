import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://spotsmart.it';
  const today = new Date();
  
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: today,
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contacts`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookie`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const categories = ['cronaca', 'mondo', 'regioni', 'scienza', 'tecnologia', 'finanza', 'sport', 'cultura', 'salute'];
  for (const cat of categories) {
    routes.push({
      url: `${baseUrl}/?category=${cat}`,
      lastModified: today,
      changeFrequency: 'hourly',
      priority: 0.8,
    });
  }

  // Fetch RSS news to register dynamic article pages in sitemap
  try {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.VERCEL_URL || 'localhost:3000'; // Match default port 3000
    const res = await fetch(`${protocol}://${host}/api/news`, { cache: 'no-store' });
    if (res.ok) {
      const news = await res.json();
      if (Array.isArray(news)) {
        for (const item of news) {
          if (item && item.slug) {
            routes.push({
              url: `${baseUrl}/article/${item.slug}`,
              lastModified: item.pubDate ? new Date(item.pubDate) : today,
              changeFrequency: 'daily',
              priority: 0.8,
            });
          }
        }
      }
    }
  } catch (e) {
    // Silent fallback
  }

  return routes;
}
