import { NextResponse } from "next/server";
import { addListShareForUser, loadListSharesForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    const shares = await loadListSharesForUser(id, userEmail);
    return NextResponse.json({ shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load shares";
    return errorResponse(message, message === "List not found" ? 404 : 400);
  }
}

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
    const payload = (await request.json()) as { username?: string; canEdit?: boolean };
    const shares = await addListShareForUser(id, userEmail, payload.username ?? "", payload.canEdit ?? false);
    return NextResponse.json({ shares });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update shares";
    return errorResponse(message, message === "List not found" ? 404 : 400);
  }
}
