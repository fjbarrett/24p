import { NextResponse } from "next/server";
import { setUsernameForUser } from "@/lib/server/profiles";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { username?: string };
    const profile = await setUsernameForUser(userEmail, payload.username ?? "");
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update username");
  }
}
