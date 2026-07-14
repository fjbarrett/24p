import "server-only";

import { NextResponse } from "next/server";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export class PublicHttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PublicHttpError";
  }
}

export function publicError(message: string, status = 400): never {
  throw new PublicHttpError(message, status);
}

// request.json() throws SyntaxError on malformed bodies, which routeError
// treats as an internal 500; a bad body is the caller's 400. Also rejects
// null/array/scalar payloads so `payload.field` access can't throw.
export async function readJsonObject<T extends object = Record<string, unknown>>(request: Request): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    publicError("Request body must be valid JSON", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    publicError("Request body must be a JSON object", 400);
  }
  return payload as T;
}

// Logs the underlying error server-side and returns a generic message, so
// internal/pg/config errors (e.g. "DATABASE_URL is not configured",
// "ANTHROPIC_API_KEY is not configured", raw pg messages) never leak into a
// response body. Use this for 5xx paths instead of echoing error.message.
export function serverError(context: string, error: unknown, message = "Something went wrong") {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function routeError(context: string, error: unknown, message: string) {
  if (error instanceof PublicHttpError) {
    return errorResponse(error.message, error.status);
  }
  return serverError(context, error, message);
}

// TMDB lib throws Error("TMDB request failed: <status>") / similar for upstream
// errors. A 404 is "the id doesn't exist" — distinguish it from 5xx upstream
// failures so we return 404 instead of an opaque 500 to the caller.
export function tmdbErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  return /\b(?:404|not\s+found)\b/i.test(message) ? 404 : 500;
}
