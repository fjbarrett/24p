import { NextResponse } from "next/server";
import { removeListShareForUser, updateListSharePermissionForUser } from "@/lib/server/lists";
import { errorResponse, routeError } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; username: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id, username } = await context.params;
    const payload = (await request.json()) as { canEdit?: boolean };
    if (typeof payload.canEdit !== "boolean") {
      return errorResponse("canEdit is required");
    }
    const shares = await updateListSharePermissionForUser(id, userEmail, username, payload.canEdit);
    return NextResponse.json({ shares });
  } catch (error) {
    return routeError("api/lists/shares:patch", error, "Unable to update shares");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; username: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id, username } = await context.params;
    const shares = await removeListShareForUser(id, userEmail, username);
    return NextResponse.json({ shares });
  } catch (error) {
    return routeError("api/lists/shares:delete", error, "Unable to update shares");
  }
}
