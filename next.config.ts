import path from "node:path";
import type { NextConfig } from "next";

// CSP is set dynamically in src/proxy.ts with a per-request nonce.
// These headers are safe to apply statically.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["jose", "pg", "pg-pool", "pg-connection-string", "pgpass"],
  output: "standalone",
  // Keep the fetch/data cache in memory only (see cache-handler.mjs); the
  // on-disk fetch cache never evicts and once exhausted the host's inodes.
  // Must be an absolute path; the standalone build rewrites it relative.
  cacheHandler: path.join(process.cwd(), "cache-handler.mjs"),
  cacheMaxMemorySize: 128 * 1024 * 1024,
  images: {
    // The optimizer's disk LRU otherwise defaults to half the free bytes on
    // the volume. Optimized posters are ~3-10 KB (two inodes each), so a byte
    // budget that large still allows millions of files. Cap it explicitly.
    maximumDiskCacheSize: 256 * 1024 * 1024,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "images.justwatch.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
