import { NextRequest, NextResponse } from "next/server";
import { mapTmdbMovie, type TmdbSearchResponse } from "@/lib/tmdb";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.warn("TMDB_API_KEY is not set. TMDB search will return 500 until it is configured.");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || !query.trim()) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY is not configured" }, { status: 500 });
  }

  const endpoint = `${TMDB_API_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query.trim())}&include_adult=false&language=en-US&page=1`;

  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error("TMDB search failed", await response.text());
    return NextResponse.json({ error: "Unable to reach TMDB" }, { status: 502 });
  }

  const payload = (await response.json()) as TmdbSearchResponse;
  const results = (payload.results ?? []).slice(0, 8).map(mapTmdbMovie);

  return NextResponse.json({ query, results });
}
