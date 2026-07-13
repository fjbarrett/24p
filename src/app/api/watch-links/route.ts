import { NextResponse } from "next/server";
import { routeError } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";
import { fetchJustWatchOffers } from "@/lib/server/justwatch";

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `watch-links:${ip}`, max: 60, windowMs: 60_000 },
    { key: "watch-links:global", max: 600, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "";
  const year = searchParams.get("year");
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";

  if (!title) return NextResponse.json({});

  try {
    const offers = await fetchJustWatchOffers(title, year ? Number(year) : undefined, undefined, mediaType);
    return NextResponse.json(offers, {
      headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return routeError("api/watch-links", error, "Unable to load watch links");
  }
}
