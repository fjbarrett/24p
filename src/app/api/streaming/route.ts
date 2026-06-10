import { NextResponse } from "next/server";
import { serverError } from "@/lib/server/http";
import { getStreamingCatalogPayload } from "@/lib/server/streaming-catalog";

export async function GET(request: Request) {
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
    return serverError("api/streaming", error, "Unable to load streaming catalog");
  }
}
