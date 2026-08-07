import { NextResponse } from "next/server";
import { deleteListForUser, updateListForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail, getSessionUser } from "@/lib/server/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
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
    // Publishing a list exposes it to anyone holding the URL — the same class
    // of action as flipping the whole profile public, which is already browser
    // only. A lifted Apple TV bearer must not be able to do it. Renames and
    // recolours stay open to native clients.
    if (payload.visibility !== undefined && sessionUser.authMethod !== "browser") {
      return errorResponse("Changing list visibility requires a browser session", 403);
    }
    const list = await updateListForUser(id, sessionUser.email, payload);
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
