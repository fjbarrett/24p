import { NextResponse } from "next/server";
import { getPublicProfileByUsername } from "@/lib/server/profiles";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  try {
    const profile = await getPublicProfileByUsername(username);
    if (!profile) {
      return errorResponse("Profile not found", 404);
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load profile");
  }
}
