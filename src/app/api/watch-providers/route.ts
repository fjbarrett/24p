import { NextResponse } from "next/server";
import { fetchWatchProviders } from "@/lib/server/tmdb";
import { getSessionUserEmail } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!tmdbId || Number.isNaN(tmdbId)) {
    return NextResponse.json({ providers: [], justWatchLink: null });
  }
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";

  const result = await fetchWatchProviders(tmdbId, "US", mediaType);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
