import { NextResponse } from "next/server";
import { fetchTmdbMovie } from "@/lib/server/tmdb";
import { errorResponse, tmdbErrorStatus } from "@/lib/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
