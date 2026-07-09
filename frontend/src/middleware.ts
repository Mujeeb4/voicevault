import { NextRequest, NextResponse } from 'next/server';

const LOCAL_API_ORIGINS = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:18000',
  'http://127.0.0.1:18000',
];
const ANALYTICS_ORIGINS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
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
    || getOrigin(process.env.NEXT_PUBLIC_API_URL)
    || 'https://voicevault-backend-production.up.railway.app';
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

export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
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
  ],
};
