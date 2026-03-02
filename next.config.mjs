import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['prisma-field-encryption', '@prisma/client', 'pdf-parse', 'mammoth', '@react-pdf/renderer', 'puppeteer'],
  webpack: (config) => {
    // Webpack-Filesystem-Cache deaktivieren – verhindert Rename-Fehler auf Netzlaufwerken
    config.cache = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
