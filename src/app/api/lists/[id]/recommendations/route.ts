import { NextResponse } from "next/server";
import { getRecommendationsForList } from "@/lib/server/recommendations";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";
import { consume } from "@/lib/server/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  // Each call invokes Anthropic plus ~36 TMDB/JustWatch outbound fetches.
  // Cap per-user to bound LLM and outbound spend.
  const limit = consume(`recs:${userEmail}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return new NextResponse(JSON.stringify({ error: "Recommendation rate limit reached" }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  const { id } = await context.params;
  try {
    const movies = await getRecommendationsForList(id, userEmail);
    return NextResponse.json({ movies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch recommendations";
    return errorResponse(message, 500);
  }
}
