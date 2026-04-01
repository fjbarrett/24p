import type { MetadataRoute } from "next";
import { loadPublicLists } from "@/lib/list-store";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

function absolute(path: string) {
  return new URL(path, getAppUrl()).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: absolute("/"),
      changeFrequency: "daily",
      priority: 1,
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
  const seenMovies = new Set<number>();

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

    for (const tmdbId of list.movies) {
      if (!Number.isFinite(tmdbId)) continue;
      if (seenMovies.size >= 5000) break;
      if (seenMovies.has(tmdbId)) continue;
      seenMovies.add(tmdbId);
      entries.push({
        url: absolute(`/movies/${tmdbId}`),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}

