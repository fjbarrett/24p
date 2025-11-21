import { NextResponse } from "next/server";
import { addMovieToList } from "@/lib/list-store";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const payload = await request.json().catch(() => null);
  const tmdbId = Number(payload?.tmdbId);
  if (!Number.isFinite(tmdbId)) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }

  try {
    const list = await addMovieToList(params.id, tmdbId);
    return NextResponse.json({ list });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
