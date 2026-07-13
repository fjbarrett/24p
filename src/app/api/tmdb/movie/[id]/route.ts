import { NextResponse } from "next/server";
import { fetchTmdbMovie } from "@/lib/server/tmdb";
import { errorResponse, tmdbErrorStatus } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // Shared per-IP budget across the public TMDB detail/trailer routes: normal
  // browsing stays far below it while bulk scraping runs into the cap.
  const blocked = await enforceDurableLimits([
    { key: `tmdb-detail:${clientIp(request.headers)}`, max: 120, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const lite = searchParams.get("lite") === "true";
  const { id } = await context.params;
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return errorResponse("Invalid TMDB id");
  }
  try {
    const detail = await fetchTmdbMovie(tmdbId, lite);
    return NextResponse.json(
      { detail },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    const status = tmdbErrorStatus(error);
    return errorResponse(status === 404 ? "Movie not found" : "Unable to load movie", status);
  }
}
