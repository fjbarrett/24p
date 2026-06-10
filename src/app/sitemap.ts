import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { loadPublicLists } from "@/lib/server/lists";

export const dynamic = "force-dynamic";

function absolute(path: string) {
  return new URL(path, getAppUrl()).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.NEXT_PUBLIC_NO_INDEX === "true") {
    return [];
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: absolute("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absolute("/changelog"),
      changeFrequency: "weekly",
      priority: 0.55,
    },
  ];

  let lists: Awaited<ReturnType<typeof loadPublicLists>> = [];
  try {
    lists = await loadPublicLists(5000);
  } catch {
    lists = [];
  }

  const seenProfiles = new Set<string>();
  const seenLists = new Set<string>();
  const seenTitles = new Set<string>();

  for (const list of lists) {
    const username = (list.username ?? "").trim().toLowerCase();
    if (!username) continue;

    if (!seenProfiles.has(username)) {
      seenProfiles.add(username);
      entries.push({
        url: absolute(`/${encodeURIComponent(username)}`),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }

    const listKey = `${username}/${list.slug}`;
    if (!seenLists.has(listKey)) {
      seenLists.add(listKey);
      entries.push({
        url: absolute(`/${encodeURIComponent(username)}/${encodeURIComponent(list.slug)}`),
        lastModified: list.createdAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    // Route by media type: TV ids must not be emitted under /movies/ (the id
    // spaces overlap, so a TV id there resolves to an unrelated movie).
    for (const item of list.items) {
      if (!Number.isFinite(item.tmdbId)) continue;
      const key = `${item.mediaType}:${item.tmdbId}`;
      if (seenTitles.size >= 5000) break;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      entries.push({
        url: absolute(item.mediaType === "tv" ? `/tv/${item.tmdbId}` : `/movies/${item.tmdbId}`),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
