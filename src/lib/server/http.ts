import "server-only";

import { NextResponse } from "next/server";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Logs the underlying error server-side and returns a generic message, so
// internal/pg/config errors (e.g. "DATABASE_URL is not configured",
// "ANTHROPIC_API_KEY is not configured", raw pg messages) never leak into a
// response body. Use this for 5xx paths instead of echoing error.message.
export function serverError(context: string, error: unknown, message = "Something went wrong") {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

// TMDB lib throws Error("TMDB request failed: <status>") / similar for upstream
// errors. A 404 is "the id doesn't exist" — distinguish it from 5xx upstream
// failures so we return 404 instead of an opaque 500 to the caller.
export function tmdbErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  return /\b(?:404|not\s+found)\b/i.test(message) ? 404 : 500;
}
