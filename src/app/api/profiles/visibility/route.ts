import { NextResponse } from "next/server";
import { setProfileVisibilityForUser } from "@/lib/server/profiles";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function PATCH(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { isPublic?: boolean };
    if (typeof payload.isPublic !== "boolean") {
      return errorResponse("isPublic is required");
    }
    const profile = await setProfileVisibilityForUser(userEmail, payload.isPublic);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile";
    return errorResponse(message, message === "Profile not found" ? 404 : 400);
  }
}
