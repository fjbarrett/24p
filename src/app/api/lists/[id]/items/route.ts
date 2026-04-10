import { NextResponse } from "next/server";
import { addMovieToListForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { tmdbId?: number; mediaType?: string };
    if (!Number.isInteger(payload.tmdbId)) {
      return errorResponse("tmdbId is required");
    }
    const mediaType = payload.mediaType === "tv" ? "tv" : "movie";
    const list = await addMovieToListForUser(id, Number(payload.tmdbId), userEmail, mediaType);
    return NextResponse.json({ list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update list";
    return errorResponse(message, message === "List not found" ? 404 : 400);
  }
}
