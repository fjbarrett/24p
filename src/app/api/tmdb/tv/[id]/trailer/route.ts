import { NextResponse } from "next/server";
import { fetchTmdbTrailerForShow } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) {
    return errorResponse("Invalid TMDB id");
  }
  try {
    const trailer = await fetchTmdbTrailerForShow(tmdbId);
    return NextResponse.json(trailer, {
      headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" },
    });
  } catch {
    return errorResponse("Unable to load trailer", 500);
  }
}
