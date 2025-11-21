import { NextRequest, NextResponse } from "next/server";
import { mapTmdbMovieDetails, type TmdbMovieDetailsResult } from "@/lib/tmdb";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.warn("TMDB_API_KEY is not set. Individual movie lookups will fail until configured.");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing tmdbId parameter" }, { status: 400 });
  }

  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY is not configured" }, { status: 500 });
  }

  const endpoint = `${TMDB_API_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error("TMDB movie lookup failed", await response.text());
    return NextResponse.json({ error: "Unable to fetch movie" }, { status: 502 });
  }

  const payload = (await response.json()) as TmdbMovieDetailsResult;
  const detail = mapTmdbMovieDetails(payload);

  return NextResponse.json({ detail });
}
