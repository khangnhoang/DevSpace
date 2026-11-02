import type { NextConfig } from "next";
import { localStorageImages } from "./lib/image-hosts";

const localImages = localStorageImages(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  images: {
    // Not empty only when the Supabase URL is local (lib/image-hosts.ts).
    ...(localImages.dangerouslyAllowLocalIP && { dangerouslyAllowLocalIP: true }),
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
      ...localImages.remotePatterns,
    ],
  },
};

export default nextConfig;