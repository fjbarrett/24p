import { NextResponse } from "next/server";
import { fetchAppleTvLink } from "@/lib/apple-links";

// IMDb IDs are `tt` followed by 7-10 digits. Rejecting anything else stops an
// unauthenticated caller from seeding cache rows for arbitrary keys.
const IMDB_ID_RE = /^tt\d{7,10}$/;
const MAX_TITLE_LEN = 200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId");
  const title = (searchParams.get("title") ?? "").slice(0, MAX_TITLE_LEN);

  if (!imdbId || !IMDB_ID_RE.test(imdbId)) {
    return NextResponse.json({ url: null, price: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await fetchAppleTvLink(imdbId, title);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
