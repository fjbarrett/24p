import { NextResponse } from "next/server";
import { createListForUser, listListsForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const { searchParams } = new URL(request.url);
    const includeShared = searchParams.get("includeShared") === "true";
    const lists = await listListsForUser(userEmail, includeShared);
    return NextResponse.json({ lists });
  } catch (error) {
    return routeError("api/lists:get", error, "Unable to load lists");
  }
}

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = await readJsonObject<{
      title?: string;
      movies?: number[];
      color?: string | null;
      tmdbId?: number;
      mediaType?: "movie" | "tv";
    }>(request);
    const movies = Array.isArray(payload.movies) ? payload.movies : [];
    // Non-integer ids would otherwise reach the INTEGER column and 500.
    if (!movies.every((id) => Number.isInteger(id) && id > 0)) {
      return errorResponse("movies must be positive TMDB ids");
    }
    if (Number.isInteger(payload.tmdbId) && !movies.includes(payload.tmdbId as number)) {
      movies.unshift(payload.tmdbId as number);
    }
    const mediaType = payload.mediaType === "tv" ? "tv" : "movie";
    const list = await createListForUser(payload.title ?? "", userEmail, movies, payload.color, mediaType);
    return NextResponse.json({ list });
  } catch (error) {
    return routeError("api/lists:post", error, "Unable to create list");
  }
}
