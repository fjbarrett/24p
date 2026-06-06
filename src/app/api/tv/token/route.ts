import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { getSessionUserEmail } from "@/lib/server/session";
import { listTvTokens, mintTvToken, revokeTvTokens } from "@/lib/server/tv-tokens";

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

// POST — mint a new Apple TV token. The plaintext is returned exactly once.
export async function POST() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    const { token } = await mintTvToken(userEmail);
    return NextResponse.json({ token });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to create Apple TV token", 500);
  }
}

// DELETE — revoke all of the user's Apple TV tokens.
export async function DELETE() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) return errorResponse("Unauthorized", 401);
  try {
    const revoked = await revokeTvTokens(userEmail);
    return NextResponse.json({ revoked });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to revoke Apple TV tokens", 500);
  }
}
