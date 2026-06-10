import { NextResponse } from "next/server";
import { fetchTmdbMovies, fetchTmdbShow } from "@/lib/server/tmdb";

// Batch title lookup so a list-detail view makes one request per ~50 titles
// instead of one request per title. Movies and TV are resolved in parallel
// server-side, where the TMDB data cache is shared across users.
const MAX_IDS = 120;

function parseIds(value: string | null): number[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, MAX_IDS);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const movieIds = parseIds(searchParams.get("movies"));
  const tvIds = parseIds(searchParams.get("tv"));

  if (!movieIds.length && !tvIds.length) {
    return NextResponse.json({ titles: [] });
  }

  const [movies, shows] = await Promise.all([
    fetchTmdbMovies(movieIds),
    Promise.allSettled(tvIds.map((id) => fetchTmdbShow(id))).then((results) =>
      results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
    ),
  ]);

  return NextResponse.json(
    { titles: [...movies, ...shows] },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
