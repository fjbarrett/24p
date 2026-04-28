import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getProfileForUser } from "@/lib/server/profiles";
import { getSessionUser } from "@/lib/server/session";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.email) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const profile = await getProfileForUser(sessionUser.email);
    return NextResponse.json({
      user: sessionUser,
      profile,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load session", 500);
  }
}
