import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

export default function manifest(): MetadataRoute.Manifest {
  const appUrl = getAppUrl();
  return {
    name: "24p",
    short_name: "24p",
    description: "Track films, capture ratings, and share collaborative shelves.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    id: appUrl,
  };
}
