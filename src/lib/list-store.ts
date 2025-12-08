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
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(`lists:${email}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SavedList[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // ignore parse errors and fall through to network
      }
    }
  }
  try {
    const data = await fetchFromRustApi<{ lists: ApiList[] }>(`/lists?userEmail=${encodeURIComponent(email)}`);
    const mapped = data.lists.map(mapApiList);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`lists:${email}`, JSON.stringify(mapped));
      } catch {
        // ignore write errors
      }
    }
    return mapped;
  } catch (error) {
    console.error("Failed to load lists from Rust API", error);
    return [];
  }
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
  const mapped = mapApiList(data.list);
  if (typeof window !== "undefined") {
    try {
      const email = normalizeEmail(userEmail);
      const existing = window.localStorage.getItem(`lists:${email}`);
      const parsed = existing ? (JSON.parse(existing) as SavedList[]) : [];
      window.localStorage.setItem(`lists:${email}`, JSON.stringify([mapped, ...parsed]));
    } catch {
      // ignore cache write errors
    }
  }
  return mapped;
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
  const mapped = mapApiList(data.list);
  cacheSingleList(email, mapped);
  return mapped;
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
  const mapped = mapApiList(result.list);
  cacheSingleList(email, mapped);
  return mapped;
}

export async function getListBySlug(slug: string, userEmail: string): Promise<SavedList | undefined> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load a list");
  }
  try {
    const data = await fetchFromRustApi<{ list: ApiList }>(
      `/lists/by-slug/${encodeURIComponent(slug)}?userEmail=${encodeURIComponent(email)}`,
    );
    const mapped = mapApiList(data.list);
    cacheSingleList(email, mapped);
    return mapped;
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
  if (typeof window !== "undefined") {
    try {
      const existing = window.localStorage.getItem(`lists:${email}`);
      if (existing) {
        const parsed = JSON.parse(existing) as SavedList[];
        const filtered = parsed.filter((list) => list.id !== listId);
        window.localStorage.setItem(`lists:${email}`, JSON.stringify(filtered));
      }
    } catch {
      // ignore cache write errors
    }
  }
}

function cacheSingleList(email: string, updated: SavedList) {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(`lists:${email}`);
    const parsed = existing ? (JSON.parse(existing) as SavedList[]) : [];
    const next = [updated, ...parsed.filter((list) => list.id !== updated.id)];
    window.localStorage.setItem(`lists:${email}`, JSON.stringify(next));
  } catch {
    // ignore cache write errors
  }
}
