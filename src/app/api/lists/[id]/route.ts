import { NextResponse } from "next/server";
import { loadLists, updateList, deleteList } from "@/lib/list-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lists = await loadLists();
  const list = lists.find((item) => item.id === id);
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  return NextResponse.json({ list });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  try {
    const { id } = await params;
    const updated = await updateList(id, {
      title: typeof payload.title === "string" ? payload.title : undefined,
      slug: typeof payload.slug === "string" ? payload.slug : undefined,
      color: typeof payload.color === "string" ? payload.color : undefined,
    });
    return NextResponse.json({ list: updated });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteList(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
