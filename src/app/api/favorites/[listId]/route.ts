import { NextResponse } from "next/server";
import { removeFavoriteForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { listId } = await context.params;
  await removeFavoriteForUser(listId, userEmail);
  return NextResponse.json({ ok: true });
}
