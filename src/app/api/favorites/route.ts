import { NextResponse } from "next/server";
import { addFavoriteForUser, loadFavoritesForUser } from "@/lib/server/lists";
import { errorResponse, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const lists = await loadFavoritesForUser(userEmail);
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { listId?: string };
    if (!payload.listId) {
      return errorResponse("listId is required");
    }
    await addFavoriteForUser(payload.listId, userEmail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("api/favorites:post", error, "Unable to favorite list");
  }
}
