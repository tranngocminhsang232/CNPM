import type { NextConfig } from 'next';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
