import type { NextConfig } from "next";
import { localStorageImages } from "./lib/image-hosts";

const localImages = localStorageImages(process.env.NEXT_PUBLIC_SUPABASE_URL);

// Test-only fixtures (TM-U3 AC20): files named `page.e2e.tsx` are routes only in the e2e build, which sets this variable
// (`buildE2eEnv`). A production build never sets it, so the fixture pages are not in its route list or its output.
const e2eFixtures = process.env.E2E_NEXT_FIXTURES === "1";

const nextConfig: NextConfig = {
  pageExtensions: [
    "tsx",
    "ts",
    "jsx",
    "js",
    ...(e2eFixtures ? ["e2e.tsx"] : []),
  ],
  images: {
    // Not empty only when the Supabase URL is local (lib/image-hosts.ts).
    ...(localImages.dangerouslyAllowLocalIP && {
      dangerouslyAllowLocalIP: true,
    }),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.learn.codegym.vn",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img-c.udemycdn.com", // Domain từ lỗi của bạn
      },
      {
        protocol: "https",
        hostname: "lkvxxrxojjlkchzzqidu.supabase.co", // hosted Supabase Storage
        pathname: "/storage/v1/object/public/**",
      },
      ...localImages.remotePatterns,
    ],
  },
};

export default nextConfig;
