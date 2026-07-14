import { NextResponse } from "next/server";
import { getProfileForUser } from "@/lib/server/profiles";
import { errorResponse, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const profile = await getProfileForUser(userEmail);
    return NextResponse.json({ profile });
  } catch (error) {
    return routeError("api/profiles:get", error, "Unable to load profile");
  }
}
