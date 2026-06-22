import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";
import { createTvPairing, listTvTokens, revokeTvTokenById, revokeTvTokens } from "@/lib/server/tv-tokens";

export const dynamic = "force-dynamic";

// GET — list the user's Apple TV tokens (never returns the plaintext).
export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    return NextResponse.json({ tokens: await listTvTokens(userEmail) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load Apple TV tokens", 500);
  }
}

// POST — create a pairing and return the short-lived 4-digit PIN to display.
export async function POST() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    const { pin, expiresInSeconds } = await createTvPairing(userEmail);
    return NextResponse.json({ pin, expiresInSeconds });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to create Apple TV code", 500);
  }
}

// DELETE — revoke one device (?id=) or, with no id, all of the user's tokens.
export async function DELETE(request: Request) {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id");
  try {
    const revoked = id
      ? await revokeTvTokenById(userEmail, id)
      : await revokeTvTokens(userEmail);
    return NextResponse.json({ revoked });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to revoke Apple TV tokens", 500);
  }
}
