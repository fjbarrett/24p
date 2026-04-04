import { NextResponse } from "next/server";
import { importListForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { title?: string; data?: string };
    const list = await importListForUser(payload.title ?? "", payload.data ?? "", userEmail);
    return NextResponse.json({ list });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to import list");
  }
}
