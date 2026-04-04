import { NextResponse } from "next/server";
import { fetchTmdbPersonWithFilmography } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    return errorResponse("Invalid person id");
  }
  try {
    return NextResponse.json(await fetchTmdbPersonWithFilmography(personId));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load artist", 500);
  }
}
