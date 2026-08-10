import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/server/client-ip";

// Per-IP fixed-window limiter for unauthenticated reads. State is per-isolate;
// a single-container deploy is fine, multi-replica needs a shared store
// (Redis/Upstash).
//
// Two budgets. The strict one covers routes that fan out to an upstream API or
// run an expensive query on every call, and it applies to pages as well as
// their JSON twins — /movies/<slug> resolves an attacker-chosen title through
// TMDB search exactly like /api/tmdb/search does, and only the latter used to
// be capped. The default budget is a backstop for everything else: far above
// human browsing, far below a scraper.
const RATE_LIMIT_WINDOW_MS = 60_000;
const STRICT_MAX = 60;
const DEFAULT_MAX = 240;
// Hard ceiling on tracked keys. Evicting only expired entries let a client
// rotating IPv6 source addresses (a /64 holds 2^64 of them) add live buckets
// faster than they aged out, growing the map without bound.
const MAX_BUCKETS = 20_000;

const buckets = new Map<string, { count: number; reset: number }>();

const STRICT_PREFIXES = [
  "/api/profiles/public/",
  "/api/lists/public",
  // Slug pages: every distinct slug is a fresh TMDB search that no cache can
  // absorb, so the input space is effectively unbounded.
  "/movies/",
  "/tv/",
  "/artists/",
];

function limitFor(pathname: string) {
  if (pathname === "/api/profiles/username") return STRICT_MAX;
  return STRICT_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ? STRICT_MAX : DEFAULT_MAX;
}

// Files under public/ pass through here too — the matcher only excludes
// _next/static, _next/image and the favicons. They are cheap file reads and one
// page view pulls several, so counting them would make the budget a measure of
// asset count rather than of work done. Generated metadata images render on
// demand, so those stay counted.
const STATIC_ASSET_RE = /\.(?:ico|png|jpe?g|svg|webp|avif|gif|woff2?|webmanifest|map)$/i;
const GENERATED_IMAGE_RE = /\/(?:opengraph|twitter)-image(?:-[a-z0-9]+)?(?:\.[a-z]+)?$/i;

function isStaticAsset(pathname: string) {
  return STATIC_ASSET_RE.test(pathname) && !GENERATED_IMAGE_RE.test(pathname);
}

function evict(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.reset < now) buckets.delete(key);
  }
  // Still at the ceiling: drop oldest-first (Map iterates in insertion order)
  // so the map can never outgrow it, whatever the client does with addresses.
  for (const key of buckets.keys()) {
    if (buckets.size < MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

function consume(key: string, max: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && now <= bucket.reset) {
    bucket.count += 1;
    return bucket.count <= max;
  }
  if (buckets.size >= MAX_BUCKETS) evict(now);
  buckets.set(key, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
  return true;
}

function tooManyRequests(pathname: string) {
  const isApi = pathname.startsWith("/api/");
  return new NextResponse(isApi ? JSON.stringify({ error: "Too many requests" }) : "Too many requests", {
    status: 429,
    headers: {
      "content-type": isApi ? "application/json" : "text/plain; charset=utf-8",
      "retry-after": String(RATE_LIMIT_WINDOW_MS / 1000),
    },
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isStaticAsset(pathname)) {
    const max = limitFor(pathname);
    // Keyed by budget as well as address, so the strict tier gets its own
    // counter instead of sharing one with ordinary page views.
    if (!consume(`${max}:${clientIp(request.headers)}`, max)) {
      return tooManyRequests(pathname);
    }
  }

  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://image.tmdb.org https://images.justwatch.com",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
