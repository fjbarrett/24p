import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jose"],
  output: "standalone",
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
