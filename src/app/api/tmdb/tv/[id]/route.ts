import { NextResponse } from "next/server";
import { fetchTmdbShow } from "@/lib/server/tmdb";
import { errorResponse, tmdbErrorStatus } from "@/lib/server/http";

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
    const detail = await fetchTmdbShow(tmdbId);
    return NextResponse.json({ detail });
  } catch (error) {
    const status = tmdbErrorStatus(error);
    return errorResponse(status === 404 ? "Show not found" : "Unable to load show", status);
  }
}
