import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getRecommendationsForUser } from "@/lib/server/recommendations";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const movies = await getRecommendationsForUser(userEmail);
    return NextResponse.json({ movies });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load recommendations", 500);
  }
}
