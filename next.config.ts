import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.learn.codegym.vn',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img-c.udemycdn.com', // Domain từ lỗi của bạn
      },
      {
        protocol: 'https',
        hostname: 'lkvxxrxojjlkchzzqidu.supabase.co', // hosted Supabase Storage
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;