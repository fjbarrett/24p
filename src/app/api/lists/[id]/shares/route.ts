import { NextResponse } from "next/server";
import { addListShareForUser, loadListSharesForUser } from "@/lib/server/lists";
import { errorResponse, routeError } from "@/lib/server/http";
import { consumeDurable } from "@/lib/server/rate-limit";
import { getSessionUserEmail } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    const shares = await loadListSharesForUser(id, userEmail);
    return NextResponse.json({ shares });
  } catch (error) {
    return routeError("api/lists/shares:get", error, "Unable to load shares");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    // Adding a share resolves a username to an account, so cap attempts per
    // account to keep username enumeration and share spam impractical.
    const limit = await consumeDurable(`list-share:${userEmail}`, 30, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many share requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
    const { id } = await context.params;
    const payload = (await request.json()) as { username?: string; canEdit?: boolean };
    const shares = await addListShareForUser(id, userEmail, payload.username ?? "", payload.canEdit ?? false);
    return NextResponse.json({ shares });
  } catch (error) {
    return routeError("api/lists/shares:post", error, "Unable to update shares");
  }
}
