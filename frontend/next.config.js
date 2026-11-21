const backendApiUrl = (process.env.BACKEND_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const backendBaseUrl = backendApiUrl.replace(/\/api$/, '');

// Admin dashboard host (same rule as src/config/site.ts), kept out of search engines
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
const adminHostname = process.env.NEXT_PUBLIC_ADMIN_URL
  ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).hostname
  : `admin.${siteUrl.hostname}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  skipTrailingSlashRedirect: true,

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Output standalone for Docker deployment
  output: 'standalone',

  // Performance optimizations
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Fix workspace root detection with multiple lockfiles
  outputFileTracingRoot: __dirname,

  // Experimental features
  experimental: {
    // Required for Next.js 15 and React 19
    reactCompiler: true,
    // Long uploads, transcription, and SSE responses can exceed the default 30 seconds.
    proxyTimeout: 180000,
    // Keep the proxy above Django's 100 MB recording limit, including multipart overhead.
    middlewareClientMaxBodySize: '110mb',
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: adminHostname }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },

  // API Rewrites to Django Backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*/`,
      },
      {
        source: '/static/:path*',
        destination: `${backendBaseUrl}/static/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${backendBaseUrl}/media/:path*`,
      },
    ];
  },

  // Webpack - use Next.js defaults (custom splitChunks can cause __webpack_modules__[moduleId] errors in Next.js 15)
  webpack: (config) => config,
};

module.exports = nextConfig;
