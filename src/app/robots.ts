import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();
  const shouldIndex = process.env.NEXT_PUBLIC_NO_INDEX !== "true";

  if (!shouldIndex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      // General crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/profile", "/settings"],
      },
      // OpenAI search bot — allow discovery, disallow training
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: ["/api/", "/profile", "/settings"],
      },
      // Google extended (Gemini training) — disallow
      {
        userAgent: "Google-Extended",
        disallow: "/",
      },
      // Anthropic crawler — allow
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/api/", "/profile", "/settings"],
      },
      // Perplexity — allow
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/api/", "/profile", "/settings"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}

