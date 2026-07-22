import { NextResponse } from "next/server";
import { clientIp } from "@/lib/server/client-ip";
import { errorResponse, routeError } from "@/lib/server/http";
import { consumeDurable } from "@/lib/server/rate-limit";
import { startTvPairing } from "@/lib/server/tv-tokens";

export const dynamic = "force-dynamic";

const LABELS = new Set(["Apple TV", "iPhone", "iPad"]);

export async function POST(request: Request) {
  try {
    // Inside the try: consumeDurable hits the DB, so an outage here must fail
    // closed with a clean JSON error (routeError) rather than an unhandled,
    // bodyless 500. Pairing needs the DB anyway (startTvPairing writes a row),
    // so there is nothing to fall through to.
    const ip = clientIp(request.headers);
    const limits = await Promise.all([
      consumeDurable(`tv-pairing:${ip}`, 10, 60 * 60 * 1000),
      consumeDurable("tv-pairing:global", 500, 60 * 60 * 1000),
    ]);
    const blocked = limits.find((limit): limit is { ok: false; retryAfterSeconds: number } => !limit.ok);
    if (blocked) {
      return NextResponse.json(
        { error: "Too many pairing requests" },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { label?: unknown };
    const requested = typeof body.label === "string" ? body.label.trim() : "";
    const label = LABELS.has(requested) ? requested : "Apple device";
    return NextResponse.json(await startTvPairing(label), {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Invalid request body");
    return routeError("api/tv/pairing", error, "Unable to start device sign-in");
  }
}
