const DEFAULT_CLIENT_BASE_URL = "/api/rust";
const DEFAULT_SERVER_BASE_URL =
  process.env.RUST_API_ORIGIN ??
  process.env.RUST_API_BASE_URL ??
  process.env.RUST_API_URL ??
  process.env.NEXT_PUBLIC_RUST_API_BASE_URL ??
  process.env.NEXT_PUBLIC_RUST_API_URL ??
  (process.env.NODE_ENV === "development" ? "https://127.0.0.1:8080" : "");

const clientBaseUrl =
  process.env.NEXT_PUBLIC_RUST_API_BASE_URL ??
  process.env.NEXT_PUBLIC_RUST_API_URL ??
  DEFAULT_CLIENT_BASE_URL;
const serverBaseUrl = DEFAULT_SERVER_BASE_URL;

function normalize(base: string) {
  return base.replace(/\/$/, "");
}

export function getRustApiBaseUrl() {
  const candidate = typeof window === "undefined" ? serverBaseUrl : clientBaseUrl;
  const normalized = candidate ? normalize(candidate) : "";
  if (!normalized) {
    throw new Error(
      "Rust API base URL is not configured. Set RUST_API_ORIGIN (and NEXT_PUBLIC_RUST_API_BASE_URL if overriding the proxy).",
    );
  }
  return normalized;
}

export function buildRustApiUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${getRustApiBaseUrl()}${suffix}`;
}

export async function rustApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildRustApiUrl(path), {
    ...init,
    headers,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : response.statusText || "Request failed";
    throw new Error(message);
  }

  return body as T;
}
