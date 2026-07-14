import { NextResponse } from "next/server";
import { removeMovieFromListForUser } from "@/lib/server/lists";
import { errorResponse, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; tmdbId: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id, tmdbId } = await context.params;
    const numericId = Number(tmdbId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return errorResponse("tmdbId must be a positive integer", 400);
    }
    // Movie and TV ids overlap, so the item to remove is identified by type
    // too; absent param means movie for pre-existing callers.
    const mediaType = new URL(request.url).searchParams.get("mediaType") === "tv" ? "tv" : "movie";
    const list = await removeMovieFromListForUser(id, numericId, mediaType, userEmail);
    return NextResponse.json({ list });
  } catch (error) {
    return routeError("api/lists/items:delete", error, "Unable to update list");
  }
}
