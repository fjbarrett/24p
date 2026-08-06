import { NextResponse } from "next/server";
import { fetchWatchProviders } from "@/lib/server/tmdb";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";

export async function GET(request: Request) {
  // Unauthenticated and fans out to TMDB per call, same as /api/streaming and
  // /api/tmdb/search, so it carries their per-IP and global caps too.
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `watch-providers:${ip}`, max: 30, windowMs: 60_000 },
    { key: "watch-providers:global", max: 600, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ providers: [], justWatchLink: null });
  }
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const includeAppleTvPlus = searchParams.get("includeAppleTvPlus") === "1";

  const result = await fetchWatchProviders(tmdbId, "US", mediaType, includeAppleTvPlus);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
