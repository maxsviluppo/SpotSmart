import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://spotsmart.it';
  
  const categories = [
    'all',
    'cronaca',
    'mondo',
    'regioni',
    'tecnologia',
    'finanza',
    'sport',
    'scienza',
    'cultura',
    'salute'
  ];

  const routes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: cat === 'all' ? baseUrl : `${baseUrl}/explore/${cat}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: cat === 'all' ? 1.0 : 0.8,
  }));

  return routes;
}
