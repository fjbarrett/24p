import { NextResponse } from "next/server";
import { getRatingForUser } from "@/lib/server/ratings";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { tmdbId } = await context.params;
  const rating = await getRatingForUser(userEmail, Number(tmdbId));
  return NextResponse.json({ rating });
}
