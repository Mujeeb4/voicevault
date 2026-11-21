import { MetadataRoute } from 'next';
import { siteUrl } from '@/config/site';

// Signed-in app pages are also marked noindex; they are listed here so crawlers skip them.
// /_next/ must stay crawlable: search engines need its CSS and JS to render pages.
const PRIVATE_PATHS = [
  '/api/',
  '/admin',
  '/dashboard',
  '/chat',
  '/family',
  '/record',
  '/processing',
  '/settings',
  '/checkout',
  '/accept-invite/',
  '/pricing/success',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
