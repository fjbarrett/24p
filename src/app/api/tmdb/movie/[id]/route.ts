import { NextResponse } from "next/server";
import { fetchTmdbMovie } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
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
