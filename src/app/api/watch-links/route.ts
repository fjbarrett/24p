import { NextResponse } from "next/server";
import { fetchJustWatchOffers } from "@/lib/server/justwatch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "";
  const year = searchParams.get("year");
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";

  if (!title) return NextResponse.json({});

  const offers = await fetchJustWatchOffers(title, year ? Number(year) : undefined, undefined, mediaType);
  return NextResponse.json(offers, {
    headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" },
  });
}
