import { NextResponse } from "next/server";
import { getRecommendationsForList } from "@/lib/server/recommendations";
import { getListByIdForEditor } from "@/lib/server/lists";
import { errorResponse, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";
import { consume } from "@/lib/server/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;
  try {
    // 404 unknown/inaccessible lists before consuming a rate-limit slot —
    // downstream returns [] for those, which both burned quota and was
    // indistinguishable from "no suggestions".
    const list = await getListByIdForEditor(id, userEmail);
    if (!list) return errorResponse("List not found", 404);

    // Each call invokes Anthropic plus ~36 TMDB/JustWatch outbound fetches.
    // Cap per-user to bound LLM and outbound spend.
    const limit = consume(`recs:${userEmail}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      return new NextResponse(JSON.stringify({ error: "Recommendation rate limit reached" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(limit.retryAfterSeconds) },
      });
    }

    const movies = await getRecommendationsForList(id, userEmail);
    return NextResponse.json({ movies });
  } catch (error) {
    return routeError("api/lists/recommendations:get", error, "Unable to fetch recommendations");
  }
}
