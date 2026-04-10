import { NextResponse } from "next/server";
import { fetchWatchProviders } from "@/lib/server/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!tmdbId || Number.isNaN(tmdbId)) {
    return NextResponse.json({ providers: [], justWatchLink: null });
  }
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const includeAppleTvPlus = searchParams.get("includeAppleTvPlus") === "1";

  const result = await fetchWatchProviders(tmdbId, "US", mediaType, includeAppleTvPlus);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
