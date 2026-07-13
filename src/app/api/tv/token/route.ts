import { NextResponse } from "next/server";
import { errorResponse, routeError } from "@/lib/server/http";
import { consumeDurable } from "@/lib/server/rate-limit";
import { getBrowserSessionUserEmail } from "@/lib/server/session";
import { approveTvPairing, listTvTokens, revokeTvTokenById, revokeTvTokens } from "@/lib/server/tv-tokens";

export const dynamic = "force-dynamic";

// GET — list the user's Apple TV tokens (never returns the plaintext).
export async function GET() {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    return NextResponse.json({ tokens: await listTvTokens(userEmail) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError("api/tv/token:get", error, "Unable to load Apple device tokens");
  }
}

// POST — approve the six-digit code currently displayed by an Apple device.
export async function POST(request: Request) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    const limit = await consumeDurable(`tv-approve:${userEmail}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many approval attempts" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
    const body = (await request.json()) as { pin?: unknown };
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (!(await approveTvPairing(userEmail, pin))) {
      return errorResponse("That code is invalid or has expired", 404);
    }
    return NextResponse.json({ approved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError("api/tv/token:post", error, "Unable to approve Apple device");
  }
}

// DELETE — revoke one device (?id=) or, with no id, all of the user's tokens.
export async function DELETE(request: Request) {
  const userEmail = await getBrowserSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id");
  try {
    const revoked = id
      ? await revokeTvTokenById(userEmail, id)
      : await revokeTvTokens(userEmail);
    return NextResponse.json({ revoked }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError("api/tv/token:delete", error, "Unable to revoke Apple device tokens");
  }
}
