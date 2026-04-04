import { NextResponse } from "next/server";
import { fetchAppleTvLink } from "@/lib/apple-links";
import { getSessionUserEmail } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId");
  const title = searchParams.get("title") ?? "";

  if (!imdbId) {
    return NextResponse.json({ url: null, price: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await fetchAppleTvLink(imdbId, title);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
