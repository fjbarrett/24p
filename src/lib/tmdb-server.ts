import "server-only";

import type { SimplifiedMovie } from "@/lib/tmdb";
import { buildRustApiUrl } from "@/lib/rust-api-client";

export async function fetchTmdbMovie(tmdbId: number): Promise<SimplifiedMovie> {
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(`tmdb:${tmdbId}`);
    if (cached) {
      try {
        return JSON.parse(cached) as SimplifiedMovie;
      } catch {
        // ignore parse errors
      }
    }
  }

  const response = await fetch(buildRustApiUrl(`/tmdb/movie/${tmdbId}`), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Rust TMDB lookup failed for id ${tmdbId}: ${body}`);
  }

  const payload = (await response.json()) as { detail?: SimplifiedMovie };
  if (!payload.detail) {
    throw new Error(`Rust TMDB response missing detail for id ${tmdbId}`);
  }
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(`tmdb:${tmdbId}`, JSON.stringify(payload.detail));
    } catch {
      // ignore cache errors
    }
  }
  return payload.detail;
}

export async function fetchTmdbMovies(tmdbIds: number[]): Promise<SimplifiedMovie[]> {
  const concurrency = 6;
  const results: SimplifiedMovie[] = [];

  for (let i = 0; i < tmdbIds.length; i += concurrency) {
    const chunk = tmdbIds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((id) => fetchTmdbMovie(id)));
    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    });
  }

  return results;
}
