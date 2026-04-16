import { NextResponse } from "next/server";
import { waitForMigrations } from "@/lib/server/db";
import { runStreamingNotificationCheck } from "@/lib/server/streaming-notifications";

// Long-running: allow up to 5 minutes before the runtime kills it.
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await waitForMigrations();
    const result = await runStreamingNotificationCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/streaming-check] Job failed", error);
    return NextResponse.json({ error: "Job failed", detail: message }, { status: 500 });
  }
}
