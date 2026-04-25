import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { waitForMigrations } from "@/lib/server/db";
import { runStreamingNotificationCheck } from "@/lib/server/streaming-notifications";

// Long-running: allow up to 5 minutes before the runtime kills it.
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isAuthorized(request: Request, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/streaming-check] CRON_SECRET not configured");
    return unauthorized();
  }
  if (!isAuthorized(request, secret)) {
    return unauthorized();
  }

  try {
    await waitForMigrations();
    const result = await runStreamingNotificationCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/streaming-check] Job failed", error);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
