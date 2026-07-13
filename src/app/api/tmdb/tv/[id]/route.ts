import { NextResponse } from "next/server";
import { fetchTmdbShow } from "@/lib/server/tmdb";
import { errorResponse, tmdbErrorStatus } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = await enforceDurableLimits([
    { key: `tmdb-detail:${clientIp(request.headers)}`, max: 120, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  const { id } = await context.params;
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return errorResponse("Invalid TMDB id");
  }
  try {
    const detail = await fetchTmdbShow(tmdbId);
    return NextResponse.json(
      { detail },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    const status = tmdbErrorStatus(error);
    return errorResponse(status === 404 ? "Show not found" : "Unable to load show", status);
  }
}
