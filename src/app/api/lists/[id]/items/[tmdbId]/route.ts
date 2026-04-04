import { NextResponse } from "next/server";
import { removeMovieFromListForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; tmdbId: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id, tmdbId } = await context.params;
    const list = await removeMovieFromListForUser(id, Number(tmdbId), userEmail);
    return NextResponse.json({ list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update list";
    return errorResponse(message, message === "List not found" ? 404 : 400);
  }
}
