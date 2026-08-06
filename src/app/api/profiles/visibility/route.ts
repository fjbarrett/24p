import { NextResponse } from "next/server";
import { setProfileVisibilityForUser } from "@/lib/server/profiles";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail } from "@/lib/server/session";

// Flipping a profile public exposes every public list on it, so it takes the
// browser session rather than the 180-day Apple TV bearer.
export async function PATCH(request: Request) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await readJsonObject(request)) as { isPublic?: boolean };
    if (typeof payload.isPublic !== "boolean") {
      return errorResponse("isPublic is required");
    }
    const profile = await setProfileVisibilityForUser(userEmail, payload.isPublic);
    return NextResponse.json({ profile });
  } catch (error) {
    return routeError("api/profiles/visibility:patch", error, "Unable to update profile");
  }
}
