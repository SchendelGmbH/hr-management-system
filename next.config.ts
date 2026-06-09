import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: [
    'prisma-field-encryption',
    '@prisma/client',
    'pdf-parse',
    'mammoth',
    '@react-pdf/renderer',
    'puppeteer',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.cache = false;

    if (!isServer) {
      // Redirect node:crypto to our stub module before webpack tries to parse it
      if (!config.resolve.alias) config.resolve.alias = {};
      config.resolve.alias['node:crypto'] = './src/lib/crypto-stub.js';
      config.resolve.alias['node'] = false;
    }

    return config;
  },
};

export default withNextIntl(nextConfig);