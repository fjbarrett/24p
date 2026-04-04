import { NextResponse } from "next/server";
import { getProfileForUser } from "@/lib/server/profiles";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const profile = await getProfileForUser(userEmail);
  return NextResponse.json({ profile });
}
