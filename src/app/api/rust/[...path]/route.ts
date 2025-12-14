import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_ORIGIN =
  process.env.RUST_API_ORIGIN ??
  process.env.RUST_API_BASE_URL ??
  process.env.RUST_API_URL ??
  process.env.NEXT_PUBLIC_RUST_API_BASE_URL ??
  process.env.NEXT_PUBLIC_RUST_API_URL ??
  "https://127.0.0.1:8080";

function buildUpstreamUrl(path: string[] | undefined, search: string) {
  const cleanedOrigin = API_ORIGIN.replace(/\/$/, "");
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `${cleanedOrigin}${suffix}${search}`;
}

type RouteParams = { path?: string[] } | Promise<{ path: string[] }>;

async function proxy(request: NextRequest, context: { params: RouteParams }) {
  const params = await context.params;
  const upstreamUrl = buildUpstreamUrl(params?.path, new URL(request.url).search);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength) {
      init.body = body;
    }
  }

  try {
    const response = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-length");
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
