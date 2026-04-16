import { NextResponse } from "next/server";
import { setStreamingNotificationsForUser } from "@/lib/server/profiles";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function PATCH(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  if (typeof (body as { enabled?: unknown }).enabled !== "boolean") {
    return errorResponse("enabled must be a boolean", 400);
  }

  const profile = await setStreamingNotificationsForUser(userEmail, (body as { enabled: boolean }).enabled);
  return NextResponse.json({ profile });
}
