import { NextResponse } from "next/server";
import { getRatingsForUser, saveRatingsForUser } from "@/lib/server/ratings";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const ratings = await getRatingsForUser(userEmail);
  return NextResponse.json({
    ratings,
  });
}

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const payload = (await request.json()) as {
      ratings?: Array<{ tmdbId: number; rating: number; source?: string }>;
    };
    const updated = await saveRatingsForUser(
      userEmail,
      (payload.ratings ?? []).map((entry) => ({
        tmdbId: entry.tmdbId,
        rating: entry.rating,
        source: entry.source ?? "tmdb",
      })),
    );
    return NextResponse.json({ updated });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to save ratings");
  }
}
