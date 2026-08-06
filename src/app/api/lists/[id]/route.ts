import { NextResponse } from "next/server";
import { deleteListForUser, updateListForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail, getSessionUserEmail } from "@/lib/server/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    const payload = (await readJsonObject(request)) as {
      title?: string;
      slug?: string;
      color?: string;
      visibility?: "public" | "private";
    };
    const list = await updateListForUser(id, userEmail, payload);
    return NextResponse.json({ list });
  } catch (error) {
    return routeError("api/lists:patch", error, "Unable to update list");
  }
}

// Deleting a list is irreversible and takes its items with it, so it needs the
// browser session rather than the 180-day Apple TV bearer — a lifted token
// should not be able to wipe an account's lists. PATCH stays on the shared
// session so the TV can still rename and recolour its own lists.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    await deleteListForUser(id, userEmail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("api/lists:delete", error, "Unable to delete list");
  }
}
