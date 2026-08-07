import { NextResponse } from "next/server";
import { removeListShareForUser, updateListSharePermissionForUser } from "@/lib/server/lists";
import { errorResponse, readJsonObject, routeError } from "@/lib/server/http";
import { getBrowserSessionUserEmail } from "@/lib/server/session";

// Browser-session only, for the same reason as the collection route: changing
// or revoking a collaborator's access is account-level, not device-level.

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; username: string }> },
) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id, username } = await context.params;
    const payload = (await readJsonObject(request)) as { canEdit?: boolean };
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
  const userEmail = await getBrowserSessionUserEmail();
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
