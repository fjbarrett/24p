import { NextResponse } from "next/server";
import { routeError } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";
import { fetchTmdbMovies, fetchTmdbShow } from "@/lib/server/tmdb";

// Batch title lookup so a list-detail view makes one request per ~50 titles
// instead of one request per title. Movies and TV are resolved in parallel
// server-side, where the TMDB data cache is shared across users.
// The web client batches at 50 (list-movies-grid.tsx); the cap bounds each
// request's TMDB fan-out across movies + tv combined.
const MAX_IDS = 50;

function parseIds(value: string | null, budget: number): number[] {
  if (!value || budget <= 0) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, budget);
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `tmdb-titles:${ip}`, max: 30, windowMs: 60_000 },
    { key: "tmdb-titles:global", max: 300, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const movieIds = parseIds(searchParams.get("movies"), MAX_IDS);
  const tvIds = parseIds(searchParams.get("tv"), MAX_IDS - movieIds.length);

  if (!movieIds.length && !tvIds.length) {
    return NextResponse.json({ titles: [] });
  }

  try {
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
  } catch (error) {
    return routeError("api/tmdb/titles", error, "Unable to load titles");
  }
}
