import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { consume } from "@/lib/server/rate-limit";
import { claimTvPairing } from "@/lib/server/tv-tokens";

export const dynamic = "force-dynamic";

// POST — exchange a 4-digit pairing PIN for a long-lived bearer token.
// Public + rate-limited: the PIN space is small, so we throttle guessing.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = consume(`tv-claim:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let pin = "";
  try {
    const body = (await request.json()) as { pin?: string };
    pin = typeof body.pin === "string" ? body.pin : "";
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  try {
    const result = await claimTvPairing(pin);
    if (!result) {
      return errorResponse("That code is invalid or has expired. Generate a new one.", 404);
    }
    return NextResponse.json({ token: result.token });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to sign in", 500);
  }
}
