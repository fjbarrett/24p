import { NextResponse } from "next/server";
import { errorResponse, routeError } from "@/lib/server/http";
import { consumeDurable } from "@/lib/server/rate-limit";
import { claimTvPairing } from "@/lib/server/tv-tokens";
import { clientIp } from "@/lib/server/client-ip";

export const dynamic = "force-dynamic";

// POST — poll browser approval using the high-entropy pairing id and token that
// were issued together to the device. Both limits are durable across restarts.
// Sizing: devices poll every 5s for up to 10 min (~120 calls), and several
// devices can share one NAT IP; guessing is not a threat here (the claim needs
// both 128-bit and 256-bit secrets), so the caps only bound database load.
export async function POST(request: Request) {
  try {
    // Inside the try: consumeDurable hits the DB, so an outage here fails closed
    // with a clean JSON error instead of an unhandled, bodyless 500.
    const ip = clientIp(request.headers);
    const limits = await Promise.all([
      consumeDurable(`tv-claim:${ip}`, 300, 10 * 60 * 1000),
      consumeDurable("tv-claim:global", 5_000, 10 * 60 * 1000),
    ]);
    const blocked = limits.find((limit): limit is { ok: false; retryAfterSeconds: number } => !limit.ok);
    if (blocked) {
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } },
      );
    }

    let pairingId = "";
    let deviceToken = "";
    try {
      const body = (await request.json()) as { pairingId?: unknown; deviceToken?: unknown };
      pairingId = typeof body.pairingId === "string" ? body.pairingId : "";
      deviceToken = typeof body.deviceToken === "string" ? body.deviceToken : "";
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const result = await claimTvPairing(pairingId, deviceToken);
    if (result.status === "invalid") {
      return errorResponse("This pairing request is invalid or has expired", 404);
    }
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { status: "approved", token: result.token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError("api/tv/claim", error, "Unable to complete device sign-in");
  }
}
