import "server-only";

import { cache } from "react";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { buildRustApiUrl } from "@/lib/rust-api-client";

const RUST_TMDB_REVALIDATE_SECONDS = 60 * 60;

export const fetchTmdbMovie = cache(async (tmdbId: number): Promise<SimplifiedMovie> => {
  const response = await fetch(buildRustApiUrl(`/tmdb/movie/${tmdbId}`), {
    next: { revalidate: RUST_TMDB_REVALIDATE_SECONDS },
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
  return payload.detail;
});

export async function fetchTmdbMovies(tmdbIds: number[]): Promise<SimplifiedMovie[]> {
  const results = await Promise.allSettled(tmdbIds.map((id) => fetchTmdbMovie(id)));
  return results
    .filter((result): result is PromiseFulfilledResult<SimplifiedMovie> => result.status === "fulfilled")
    .map((result) => result.value);
}
