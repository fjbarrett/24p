import "server-only";

import { cache } from "react";
import {
  mapTmdbMovieDetails,
  type SimplifiedMovie,
  type TmdbMovieDetailsResult,
} from "@/lib/tmdb";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.warn("TMDB_API_KEY is not set. Server-side movie rendering will be skipped until configured.");
}

export const fetchTmdbMovie = cache(async (tmdbId: number): Promise<SimplifiedMovie> => {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured.");
  }

  const endpoint = `${TMDB_API_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
  const response = await fetch(endpoint, {
    next: { revalidate: 60 * 60 },
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB lookup failed for id ${tmdbId}: ${body}`);
  }

  const payload = (await response.json()) as TmdbMovieDetailsResult;
  return mapTmdbMovieDetails(payload);
});

export async function fetchTmdbMovies(tmdbIds: number[]): Promise<SimplifiedMovie[]> {
  const results = await Promise.allSettled(tmdbIds.map((id) => fetchTmdbMovie(id)));
  return results
    .filter((result): result is PromiseFulfilledResult<SimplifiedMovie> => result.status === "fulfilled")
    .map((result) => result.value);
}
