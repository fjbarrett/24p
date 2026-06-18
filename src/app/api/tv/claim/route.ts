import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { consume } from "@/lib/server/rate-limit";
import { claimTvPairing } from "@/lib/server/tv-tokens";
import { clientIp } from "@/lib/server/client-ip";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
// A claim matches a PIN against the GLOBAL pool of live pairings, so a per-IP
// cap alone can be defeated by rotating IPs. This global ceiling bounds total
// guesses across all IPs: at 60 / 10 min an attacker can never cover enough of
// the 10k PIN space within a pairing's 10-min lifetime, while legitimate claims
// (rare — one per device pairing) sail through. NOTE: in-memory + per-isolate;
// the durable fix is to scope the claim to a high-entropy pairing id rather
// than a global PIN match (tracked as a follow-up).
const GLOBAL_MAX_ATTEMPTS = 60;

// POST — exchange a 4-digit pairing PIN for a long-lived bearer token.
// Public + rate-limited: the PIN space is small, so we throttle guessing.
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const perIp = consume(`tv-claim:${ip}`, 10, WINDOW_MS);
  const global = consume("tv-claim:global", GLOBAL_MAX_ATTEMPTS, WINDOW_MS);
  if (!perIp.ok || !global.ok) {
    const retryAfter = !perIp.ok ? perIp.retryAfterSeconds : (global as { retryAfterSeconds: number }).retryAfterSeconds;
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
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
