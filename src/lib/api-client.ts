import { getAppUrl } from "@/lib/app-url";

const DEFAULT_CLIENT_BASE_URL = "/api";
const DEFAULT_SERVER_BASE_URL = `${getAppUrl()}/api`;

const clientBaseUrl = DEFAULT_CLIENT_BASE_URL;
const serverBaseUrl = DEFAULT_SERVER_BASE_URL;

function normalize(base: string) {
  return base.replace(/\/$/, "");
}

export function getApiBaseUrl() {
  const candidate = typeof window === "undefined" ? serverBaseUrl : clientBaseUrl;
  const normalized = candidate ? normalize(candidate) : "";
  if (!normalized) {
    throw new Error("API base URL is not configured.");
  }
  return normalized;
}

export function buildApiUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${suffix}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
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
