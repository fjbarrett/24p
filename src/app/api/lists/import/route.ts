import { NextResponse } from "next/server";
import { importListForUser } from "@/lib/server/lists";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

const MAX_IMPORT_BYTES = 200_000;

export async function POST(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const payload = (await request.json()) as { title?: string; data?: string };
    if ((payload.data?.length ?? 0) > MAX_IMPORT_BYTES) {
      return errorResponse("Import data exceeds the 200 KB limit", 413);
    }
    const list = await importListForUser(payload.title ?? "", payload.data ?? "", userEmail);
    return NextResponse.json({ list });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to import list");
  }
}
