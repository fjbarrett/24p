import { NextResponse } from "next/server";
import { addList, loadLists } from "@/lib/list-store";

export async function GET() {
  const lists = await loadLists();
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title : "";
  const tmdbId = payload?.tmdbId ? Number(payload.tmdbId) : undefined;
  if (!title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const newList = await addList(title, Number.isFinite(tmdbId) ? tmdbId : undefined);
  return NextResponse.json({ list: newList }, { status: 201 });
}
