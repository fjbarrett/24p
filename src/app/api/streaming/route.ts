import { NextResponse } from "next/server";
import { routeError } from "@/lib/server/http";
import { enforceDurableLimits } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/client-ip";
import { getStreamingCatalogPayload } from "@/lib/server/streaming-catalog";

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const blocked = await enforceDurableLimits([
    { key: `streaming:${ip}`, max: 30, windowMs: 60_000 },
    { key: "streaming:global", max: 600, windowMs: 60_000 },
  ]);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(request.url);
    const payload = await getStreamingCatalogPayload({
      provider: searchParams.get("provider") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      seed: searchParams.get("seed") ?? undefined,
      page: searchParams.get("page") ?? undefined,
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (error) {
    return routeError("api/streaming", error, "Unable to load streaming catalog");
  }
}
