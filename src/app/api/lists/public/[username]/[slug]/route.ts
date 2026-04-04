import { NextResponse } from "next/server";
import { getListByUsernameSlugForViewer } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string; slug: string }> },
) {
  const viewerEmail = await getSessionUserEmail();
  const { username, slug } = await context.params;
  const list = await getListByUsernameSlugForViewer(username, slug, viewerEmail);
  if (!list) {
    return errorResponse("List not found", 404);
  }
  return NextResponse.json({ list });
}
