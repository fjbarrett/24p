import { NextResponse } from "next/server";
import { searchTmdb } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  if (!query.trim()) {
    return errorResponse("Missing query parameter");
  }
  try {
    return NextResponse.json(await searchTmdb(query));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to search TMDB", 500);
  }
}
