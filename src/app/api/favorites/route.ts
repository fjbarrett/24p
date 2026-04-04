import { NextResponse } from "next/server";
import { addFavoriteForUser, loadFavoritesForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
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
    const message = error instanceof Error ? error.message : "Unable to favorite list";
    return errorResponse(message, message === "List not found" ? 404 : 400);
  }
}
