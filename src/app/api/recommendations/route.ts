import { NextResponse } from "next/server";
import { errorResponse, serverError } from "@/lib/server/http";
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
    return serverError("api/recommendations", error, "Unable to load recommendations");
  }
}
