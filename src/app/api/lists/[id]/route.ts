import { NextResponse } from "next/server";
import { loadLists, updateList } from "@/lib/list-store";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const lists = await loadLists();
  const list = lists.find((item) => item.id === params.id);
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  return NextResponse.json({ list });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  try {
    const updated = await updateList(params.id, {
      title: typeof payload.title === "string" ? payload.title : undefined,
      slug: typeof payload.slug === "string" ? payload.slug : undefined,
    });
    return NextResponse.json({ list: updated });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
