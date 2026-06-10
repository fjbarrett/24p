import { NextResponse } from "next/server";
import { setPriceNotificationsForUser } from "@/lib/server/profiles";
import { errorResponse, serverError } from "@/lib/server/http";
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

  try {
    const profile = await setPriceNotificationsForUser(userEmail, (body as { enabled: boolean }).enabled);
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "Profile not found") {
      return errorResponse("Set a username before changing notification settings", 404);
    }
    return serverError("api/profiles/price-notifications", error, "Unable to update notifications");
  }
}
