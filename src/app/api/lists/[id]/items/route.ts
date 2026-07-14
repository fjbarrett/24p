import { NextResponse } from "next/server";
import { addMovieToListForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
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
    const payload = (await readJsonObject(request)) as { tmdbId?: number; mediaType?: string };
    if (!Number.isInteger(payload.tmdbId)) {
      return errorResponse("tmdbId is required");
    }
    const mediaType = payload.mediaType === "tv" ? "tv" : "movie";
    const list = await addMovieToListForUser(id, Number(payload.tmdbId), userEmail, mediaType);
    return NextResponse.json({ list });
  } catch (error) {
    return routeError("api/lists/items:post", error, "Unable to update list");
  }
}
