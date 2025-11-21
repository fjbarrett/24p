import { NextResponse } from "next/server";
import { addList, loadLists } from "@/lib/list-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const lists = await loadLists();
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title : "";
  const tmdbId = payload?.tmdbId ? Number(payload.tmdbId) : undefined;
  const color = typeof payload?.color === "string" ? payload.color : undefined;
  if (!title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const initialMovies = Number.isFinite(tmdbId) ? [Number(tmdbId)] : [];
  const newList = await addList(title, initialMovies, color);
  return NextResponse.json({ list: newList }, { status: 201 });
}
