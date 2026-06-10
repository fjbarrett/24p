import { NextResponse } from "next/server";
import { searchTmdb } from "@/lib/server/tmdb";
import { errorResponse } from "@/lib/server/http";
import { consume } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  // Unauthenticated and fans out to 3 TMDB calls + Wikipedia lookups per query,
  // so cap per-IP to blunt outbound amplification.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = consume(`tmdb-search:${ip}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  if (!query.trim()) {
    return errorResponse("Missing query parameter");
  }
  try {
    return NextResponse.json(await searchTmdb(query));
  } catch {
    return errorResponse("Unable to search TMDB", 500);
  }
}
