import { NextResponse } from "next/server";
import { createListForUser, listListsForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { searchParams } = new URL(request.url);
  const includeShared = searchParams.get("includeShared") === "true";
  const lists = await listListsForUser(userEmail, includeShared);
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { title?: string; movies?: number[]; color?: string | null; tmdbId?: number };
    const movies = Array.isArray(payload.movies) ? payload.movies : [];
    if (Number.isInteger(payload.tmdbId) && !movies.includes(payload.tmdbId as number)) {
      movies.unshift(payload.tmdbId as number);
    }
    const list = await createListForUser(payload.title ?? "", userEmail, movies, payload.color);
    return NextResponse.json({ list });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to create list");
  }
}
