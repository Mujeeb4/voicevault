const backendApiUrl = (process.env.BACKEND_API_URL || 'https://voicevault-backend-production.up.railway.app/api').replace(/\/$/, '');
const backendBaseUrl = backendApiUrl.replace(/\/api$/, '');

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
  },

  // Headers for security and performance
  async headers() {
    return [
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
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
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
        source: '/admin/:path*',
        destination: `${backendBaseUrl}/admin/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${backendBaseUrl}/static/:path*`,
      },
    ];
  },

  // Webpack - use Next.js defaults (custom splitChunks can cause __webpack_modules__[moduleId] errors in Next.js 15)
  webpack: (config) => config,
};

module.exports = nextConfig;
