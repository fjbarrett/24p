import { NextResponse } from "next/server";
import { getRatingForUser } from "@/lib/server/ratings";
import { errorResponse, routeError } from "@/lib/server/http";
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
  const numericId = Number(tmdbId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return errorResponse("tmdbId must be a positive integer", 400);
  }
  try {
    const rating = await getRatingForUser(userEmail, numericId);
    return NextResponse.json({ rating });
  } catch (error) {
    return routeError("api/ratings/tmdbId:get", error, "Unable to load rating");
  }
}
