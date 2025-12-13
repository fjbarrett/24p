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
  async rewrites() {
    return [
      {
        source: "/api/tmdb/:path*",
        destination: "/api/rust/tmdb/:path*",
      },
    ];
  },
};

export default nextConfig;
