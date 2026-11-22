import { MetadataRoute } from 'next';
import { siteUrl } from '@/config/site';

// Public pages only; signed-in app pages are noindex and kept out of the sitemap
const PAGES: Array<{ path: string; changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }> = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/signup', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund-policy', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
