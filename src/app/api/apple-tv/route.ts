import { NextResponse } from "next/server";
import { fetchAppleTvLink } from "@/lib/apple-links";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId");
  const title = searchParams.get("title") ?? "";

  if (!imdbId) {
    return NextResponse.json({ url: null, price: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await fetchAppleTvLink(imdbId, title);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
