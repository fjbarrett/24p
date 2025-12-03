const DEFAULT_RUST_API_BASE_URL = process.env.NODE_ENV === "development" ? "http://localhost:8080" : "";
const RUST_API_BASE_URL = [
  process.env.RUST_API_BASE_URL,
  process.env.RUST_API_URL,
  process.env.NEXT_PUBLIC_RUST_API_BASE_URL,
  process.env.NEXT_PUBLIC_RUST_API_URL,
  DEFAULT_RUST_API_BASE_URL,
].find((value) => typeof value === "string" && value.trim());

function getRustApiBaseUrl() {
  const base = RUST_API_BASE_URL?.trim();
  if (!base) {
    throw new Error("Rust API base URL is not configured. Set RUST_API_BASE_URL or NEXT_PUBLIC_RUST_API_BASE_URL.");
  }
  return base.replace(/\/$/, "");
}

async function fetchFromRustApi<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getRustApiBaseUrl();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${suffix}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    const detail = typeof (data as Record<string, unknown>).error === "string"
      ? (data as { error: string }).error
      : response.statusText;
    throw new Error(detail);
  }
  return data as T;
}

export async function saveRatings(
  userEmail: string,
  ratings: Array<{ tmdbId: number; rating: number; source: string }>,
) {
  if (!ratings.length) return;
  await fetchFromRustApi<{ updated: number }>("/ratings", {
    method: "POST",
    body: JSON.stringify({
      userEmail,
      ratings,
    }),
  });
}

export async function getRating(userEmail: string, tmdbId: number) {
  const result = await fetchFromRustApi<{ rating: number | null }>(
    `/ratings/${encodeURIComponent(userEmail)}/${tmdbId}`,
  );
  return typeof result.rating === "number" ? result.rating : null;
}

export async function getRatingsForUser(userEmail: string) {
  const result = await fetchFromRustApi<{
    ratings: Array<{ tmdbId: number; rating: number; source: string; updatedAt: string }>;
  }>(`/ratings/${encodeURIComponent(userEmail)}`);
  const map: Record<number, number> = {};
  result.ratings.forEach((entry) => {
    map[entry.tmdbId] = entry.rating;
  });
  return map;
}
