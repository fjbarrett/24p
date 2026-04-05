import { NextResponse } from "next/server";
import { fetchJustWatchLinks } from "@/lib/server/justwatch";
import { getSessionUserEmail } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "";
  const year = searchParams.get("year");

  if (!title) return NextResponse.json({});

  const links = await fetchJustWatchLinks(title, year ? Number(year) : undefined);
  return NextResponse.json(links, {
    headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" },
  });
}
