import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();
  const shouldIndex = process.env.NEXT_PUBLIC_NO_INDEX !== "true";

  return {
    rules: shouldIndex
      ? [
          {
            userAgent: "*",
            allow: "/",
            disallow: ["/api/", "/profile", "/settings"],
          },
        ]
      : [
          {
            userAgent: "*",
            disallow: "/",
          },
        ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}

