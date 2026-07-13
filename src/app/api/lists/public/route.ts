import { NextResponse } from "next/server";
import { loadPublicLists } from "@/lib/server/lists";
import { routeError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 24), 1), 100);
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
