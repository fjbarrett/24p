import "server-only";

import { NextResponse } from "next/server";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// TMDB lib throws Error("TMDB request failed: <status>") / similar for upstream
// errors. A 404 is "the id doesn't exist" — distinguish it from 5xx upstream
// failures so we return 404 instead of an opaque 500 to the caller.
export function tmdbErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  return /\b(?:404|not\s+found)\b/i.test(message) ? 404 : 500;
}
