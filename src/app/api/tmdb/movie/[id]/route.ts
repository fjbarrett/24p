import { NextResponse } from "next/server";
import { fetchTmdbMovie } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(request.url);
  const lite = searchParams.get("lite") === "true";
  const { id } = await context.params;
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) {
    return errorResponse("Invalid TMDB id");
  }
  try {
    const detail = await fetchTmdbMovie(tmdbId, lite);
    return NextResponse.json({ detail });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load movie", 500);
  }
}
