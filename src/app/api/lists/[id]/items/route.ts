import { NextResponse } from "next/server";
import { addMovieToList } from "@/lib/list-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await request.json().catch(() => null);
  const tmdbId = Number(payload?.tmdbId);
  if (!Number.isFinite(tmdbId)) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const list = await addMovieToList(id, tmdbId);
    return NextResponse.json({ list });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
