import { NextResponse } from "next/server";
import { loadPublicLists } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 24), 1), 100);
    const username = searchParams.get("username");
    const lists = await loadPublicLists(limit, username);
    return NextResponse.json({ lists });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load public lists");
  }
}
