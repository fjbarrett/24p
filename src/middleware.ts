import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://image.tmdb.org",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
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
