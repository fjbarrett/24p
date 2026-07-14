import { NextResponse } from "next/server";
import { getRatingsForUser, saveRatingsForUser } from "@/lib/server/ratings";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const ratings = await getRatingsForUser(userEmail);
    return NextResponse.json({ ratings });
  } catch (error) {
    return routeError("api/ratings:get", error, "Unable to load ratings");
  }
}

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const payload = await readJsonObject<{
      ratings?: Array<{ tmdbId: number; rating: number; source?: string }>;
    }>(request);
    const entries = payload.ratings ?? [];
    if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "object" || entry === null)) {
      return errorResponse("ratings must be an array of objects");
    }
    const updated = await saveRatingsForUser(
      userEmail,
      entries.map((entry) => ({
        tmdbId: entry.tmdbId,
        rating: entry.rating,
        source: entry.source ?? "tmdb",
      })),
    );
    return NextResponse.json({ updated });
  } catch (error) {
    return routeError("api/ratings:post", error, "Unable to save ratings");
  }
}
