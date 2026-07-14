import { NextResponse } from "next/server";
import { deleteListForUser, updateListForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
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
