import { NextResponse } from "next/server";
import { loadPublicLists } from "@/lib/server/lists";
import { routeError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // NaN would pass Math.min/Math.max straight through to LIMIT and 500.
    const rawLimit = Number(searchParams.get("limit") ?? 24);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 24;
    const username = searchParams.get("username");
    const lists = await loadPublicLists(limit, username);
    return NextResponse.json(
      { lists },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return routeError("api/lists/public:get", error, "Unable to load public lists");
  }
}
