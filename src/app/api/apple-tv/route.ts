import { NextResponse } from "next/server";
import { routeError } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";
import { fetchAppleTvLink } from "@/lib/apple-links";

// IMDb IDs are `tt` followed by 7-10 digits. Rejecting anything else stops an
// unauthenticated caller from seeding cache rows for arbitrary keys.
const IMDB_ID_RE = /^tt\d{7,10}$/;
const MAX_TITLE_LEN = 200;

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `apple-tv:${ip}`, max: 30, windowMs: 60_000 },
    { key: "apple-tv:global", max: 300, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId");
  const title = (searchParams.get("title") ?? "").slice(0, MAX_TITLE_LEN);

  if (!imdbId || !IMDB_ID_RE.test(imdbId)) {
    return NextResponse.json({ url: null, price: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await fetchAppleTvLink(imdbId, title);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError("api/apple-tv", error, "Unable to load Apple TV link");
  }
}
