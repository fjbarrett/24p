import { NextResponse } from "next/server";
import { getRecommendationsForList } from "@/lib/server/recommendations";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const movies = await getRecommendationsForList(id, userEmail);
    return NextResponse.json({ movies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch recommendations";
    return errorResponse(message, 500);
  }
}
