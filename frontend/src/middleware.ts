import { NextRequest, NextResponse } from 'next/server';
import { adminHasOwnHost, adminHost, adminUrl, siteHost, siteUrl } from '@/config/site';

const LOCAL_API_ORIGINS = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:18000',
  'http://127.0.0.1:18000',
];
// GA4 (with Google Signals) sends hits to analytics.google.com, www.google.com and
// stats.g.doubleclick.net as well as google-analytics.com; Google's documented CSP for
// GA4 allows these wildcards. Loaded only after the visitor accepts the consent banner.
const ANALYTICS_ORIGINS = [
  'https://*.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
  'https://*.g.doubleclick.net',
  'https://www.google.com',
  'https://connect.facebook.net',
  'https://www.facebook.com',
];
const FFMPEG_ORIGINS = ['https://unpkg.com'];

function getOrigin(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getProtocol(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

function compact(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return compact(
    value
      .split(',')
      .map((origin) => getOrigin(origin.trim()))
  );
}

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const backendOrigin = getOrigin(process.env.BACKEND_API_URL)
    || 'http://127.0.0.1:8000';
  const siteOrigin = getOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const storageOrigin = getOrigin(process.env.LOCAL_STORAGE_PUBLIC_URL);
  const mediaOrigins = getOrigins(process.env.NEXT_PUBLIC_MEDIA_ORIGINS);
  const shouldUpgradeInsecureRequests = getProtocol(process.env.NEXT_PUBLIC_SITE_URL) === 'https:';

  const scriptSrc = compact([
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'wasm-unsafe-eval'",
    isDevelopment ? "'unsafe-eval'" : null,
  ]);
  const styleSrc = compact([
    "'self'",
    "'unsafe-inline'",
  ]);
  const connectSrc = compact([
    "'self'",
    backendOrigin,
    storageOrigin,
    siteOrigin,
    ...mediaOrigins,
    ...ANALYTICS_ORIGINS,
    ...FFMPEG_ORIGINS,
    ...(isDevelopment ? [...LOCAL_API_ORIGINS, 'ws:', 'wss:'] : []),
  ]);
  const mediaSrc = compact([
    "'self'",
    'blob:',
    'data:',
    backendOrigin,
    storageOrigin,
    ...mediaOrigins,
    ...(isDevelopment ? LOCAL_API_ORIGINS : []),
  ]);
  const imgSrc = compact([
    "'self'",
    'data:',
    'blob:',
    backendOrigin,
    storageOrigin,
    ...mediaOrigins,
    ...ANALYTICS_ORIGINS,
  ]);

  return compact([
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    "style-src-attr 'unsafe-inline'",
    `img-src ${imgSrc.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    `media-src ${mediaSrc.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    shouldUpgradeInsecureRequests ? "upgrade-insecure-requests" : null,
  ]).join('; ');
}

// Pages the admin host serves besides /admin: signing in to it
const ADMIN_HOST_AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

function requestHost(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('host') || '').toLowerCase();
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type HostRoute = { redirect: URL; status: 307 | 308 } | { notFound: true } | null;

/**
 * Host-based routing in production:
 * - admin.<site> serves only the admin dashboard (and sign-in for it)
 * - the main site does not serve /admin at all (404)
 * - www.<site> and the hosting provider's hostname redirect to the main site, so
 *   search engines see one copy of each page
 * Returns null when the request should be served as is.
 */
function routeByHost(request: NextRequest): HostRoute {
  if (!adminHasOwnHost) return null;
  const host = requestHost(request);
  const { pathname, search } = request.nextUrl;

  if (host === adminHost) {
    const allowed = isUnder(pathname, '/admin')
      || ADMIN_HOST_AUTH_PATHS.some((path) => isUnder(pathname, path))
      // Icons, manifest, images and other public files
      || /\.[a-z0-9]+$/i.test(pathname);
    if (allowed) return null;
    // The admin host's home, and the default page after signing in, is the dashboard;
    // other pages (terms, privacy, sign-up...) belong to the main site
    if (pathname === '/' || isUnder(pathname, '/dashboard')) {
      return { redirect: new URL('/admin', adminUrl), status: 307 };
    }
    return { redirect: new URL(`${pathname}${search}`, siteUrl), status: 307 };
  }
  if (host === siteHost) {
    return isUnder(pathname, '/admin') ? { notFound: true } : null;
  }
  if (host === `www.${siteHost}` || host.endsWith('.hstgr.cloud')) {
    return { redirect: new URL(`${pathname}${search}`, siteUrl), status: 308 };
  }
  return null;
}

export function middleware(request: NextRequest): NextResponse {
  const route = routeByHost(request);
  if (route && 'redirect' in route) return NextResponse.redirect(route.redirect, route.status);

  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = route
    // A path with no route renders the 404 page, so the main site shows no admin
    ? NextResponse.rewrite(new URL('/admin-not-found', request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    // Always run for admin paths, prefetches included, so the main site never serves them
    '/admin',
    '/admin/:path*',
  ],
};
