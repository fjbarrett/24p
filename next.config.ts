import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jose"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
};

export default nextConfig;
