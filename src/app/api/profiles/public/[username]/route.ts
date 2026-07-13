import { NextResponse } from "next/server";
import { getPublicProfileByUsername } from "@/lib/server/profiles";
import { errorResponse, routeError } from "@/lib/server/http";

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
    return routeError("api/profiles/public:get", error, "Unable to load profile");
  }
}
