import { normalizeListColor } from "@/lib/list-colors";

export type SavedList = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  createdAt: string;
  movies: number[];
  color?: string;
  userEmail: string;
};

const DEFAULT_RUST_API_BASE_URL = process.env.NODE_ENV === "development" ? "http://localhost:8080" : "";
const RUST_API_BASE_URL = [
  process.env.RUST_API_BASE_URL,
  process.env.RUST_API_URL,
  process.env.NEXT_PUBLIC_RUST_API_BASE_URL,
  process.env.NEXT_PUBLIC_RUST_API_URL,
  DEFAULT_RUST_API_BASE_URL,
].find((value) => typeof value === "string" && value.trim());

type ApiList = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  movies: number[];
  createdAt: string;
  color?: string | null;
  userEmail: string;
};

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
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = typeof (data as Record<string, unknown>).error === "string"
      ? (data as { error: string }).error
      : response.statusText;
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "list"
  ).slice(0, 60);
}

function mapApiList(entry: ApiList): SavedList {
  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    visibility: entry.visibility as SavedList["visibility"],
    createdAt: entry.createdAt,
    movies: Array.isArray(entry.movies) ? entry.movies : [],
    color: normalizeListColor(entry.color),
    userEmail: normalizeEmail(entry.userEmail || ""),
  };
}

export async function loadLists(userEmail: string): Promise<SavedList[]> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load lists");
  }
  const data = await fetchFromRustApi<{ lists: ApiList[] }>(`/lists?userEmail=${encodeURIComponent(email)}`);
  return data.lists.map(mapApiList);
}

export async function addList(
  title: string,
  userEmail: string,
  initialMovies: number[] = [],
  color?: string,
): Promise<SavedList> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to create a list");
  }
  const normalizedColor = normalizeListColor(color);
  const payload = { title, movies: initialMovies, color: normalizedColor, userEmail: email };
  const data = await fetchFromRustApi<{ list: ApiList }>("/lists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapApiList(data.list);
}

export async function addMovieToList(listId: string, tmdbId: number, userEmail: string): Promise<SavedList> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to update a list");
  }
  const data = await fetchFromRustApi<{ list: ApiList }>(`/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ tmdbId, userEmail: email }),
  });
  return mapApiList(data.list);
}

export async function updateList(
  listId: string,
  data: { title?: string; slug?: string; color?: string; userEmail: string },
): Promise<SavedList> {
  const email = normalizeEmail(data.userEmail);
  if (!email) {
    throw new Error("userEmail is required to update a list");
  }
  const payload: Record<string, string> = {};
  if (data.title && data.title.trim()) payload.title = data.title.trim();
  if (data.slug && data.slug.trim()) payload.slug = slugify(data.slug);
  if (data.color && data.color.trim()) payload.color = normalizeListColor(data.color);
  payload.userEmail = email;
  const result = await fetchFromRustApi<{ list: ApiList }>(`/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapApiList(result.list);
}

export async function getListBySlug(slug: string): Promise<SavedList | undefined> {
  try {
    const data = await fetchFromRustApi<{ list: ApiList }>(`/lists/by-slug/${encodeURIComponent(slug)}`);
    return mapApiList(data.list);
  } catch {
    return undefined;
  }
}

export async function deleteList(listId: string, userEmail: string): Promise<void> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to delete a list");
  }
  await fetchFromRustApi<{ ok: boolean }>(`/lists/${listId}`, {
    method: "DELETE",
    body: JSON.stringify({ userEmail: email }),
  });
}
