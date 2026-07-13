import { NextResponse } from "next/server";
import { searchTmdb } from "@/lib/server/tmdb";
import { errorResponse, routeError } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";

export async function GET(request: Request) {
  // Unauthenticated and fans out to 3 TMDB calls + Wikipedia lookups per query,
  // so cap per-IP and globally to blunt outbound amplification.
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `tmdb-search:${ip}`, max: 30, windowMs: 60_000 },
    { key: "tmdb-search:global", max: 600, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  if (!query.trim()) {
    return errorResponse("Missing query parameter");
  }
  try {
    return NextResponse.json(await searchTmdb(query));
  } catch (error) {
    return routeError("api/tmdb/search", error, "Unable to search TMDB");
  }
}
