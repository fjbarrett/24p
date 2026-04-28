import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
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
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load streaming catalog", 500);
  }
}
