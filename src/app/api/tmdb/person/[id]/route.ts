import { NextResponse } from "next/server";
import { fetchTmdbPersonWithFilmography } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { id } = await context.params;
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    return errorResponse("Invalid person id");
  }
  try {
    return NextResponse.json(await fetchTmdbPersonWithFilmography(personId));
  } catch {
    return errorResponse("Unable to load artist", 500);
  }
}
