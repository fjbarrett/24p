import { normalizeListColor } from "@/lib/list-colors";
import { apiFetch } from "@/lib/api-client";
import type { ListItem } from "@/lib/tmdb";

export type { ListItem };

export type SavedList = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  createdAt: string;
  items: ListItem[];
  movies: number[]; // computed from items for backward compat
  color?: string;
  userEmail: string;
  username?: string | null;
  canEdit?: boolean;
};

export type ListShare = {
  listId: string;
  username?: string | null;
  createdAt: string;
  canEdit: boolean;
};

type ApiList = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  items: ListItem[];
  movies?: number[]; // legacy — prefer items
  createdAt: string;
  color?: string | null;
  userEmail: string;
  username?: string | null;
  canEdit?: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEnvelope = {
  ts: number;
  lists: SavedList[];
};

function isCachedListEntry(value: unknown): value is SavedList {
  if (!value || typeof value !== "object") return false;
  const entry = value as SavedList;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.slug === "string" &&
    typeof entry.userEmail === "string" &&
    "username" in entry
  );
}

function mapApiList(entry: ApiList): SavedList {
  const items: ListItem[] = Array.isArray(entry.items)
    ? entry.items.map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType === "tv" ? "tv" : "movie" }))
    : (entry.movies ?? []).map((id) => ({ tmdbId: id, mediaType: "movie" as const }));
  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    visibility: entry.visibility as SavedList["visibility"],
    createdAt: entry.createdAt,
    items,
    movies: items.map((item) => item.tmdbId),
    color: normalizeListColor(entry.color),
    userEmail: normalizeEmail(entry.userEmail || ""),
    username: entry.username ?? null,
    canEdit: entry.canEdit,
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
        const envelope = JSON.parse(cached) as CacheEnvelope;
        if (
          envelope &&
          typeof envelope.ts === "number" &&
          Date.now() - envelope.ts < CACHE_TTL_MS &&
          Array.isArray(envelope.lists) &&
          envelope.lists.every(isCachedListEntry)
        ) {
          return envelope.lists;
        }
      } catch {
        // ignore parse errors and fall through to network
      }
    }
  }
  try {
    const data = await apiFetch<{ lists: ApiList[] }>(
      `/lists?includeShared=true`,
    );
    const mapped = data.lists.map(mapApiList);
    if (typeof window !== "undefined") {
      try {
        const envelope: CacheEnvelope = { ts: Date.now(), lists: mapped };
        window.localStorage.setItem(`lists:${email}`, JSON.stringify(envelope));
      } catch {
        // ignore write errors
      }
    }
    return mapped;
  } catch (error) {
    console.error("Failed to load lists", error);
    return [];
  }
}

// Drops the cached snapshot so the next loadLists() refetches. Every list
// mutation must call this (directly or via a store helper): patching the
// cache in place re-stamped its timestamp, which resurrected expired entries
// (e.g. lists deleted from another device reappearing for five minutes).
export function invalidateListsCache(userEmail: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`lists:${normalizeEmail(userEmail)}`);
  } catch {
    // ignore storage errors
  }
}

export async function addList(
  title: string,
  userEmail: string,
  initialMovies: number[] = [],
  color?: string,
  mediaType: "movie" | "tv" = "movie",
): Promise<SavedList> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to create a list");
  }
  const normalizedColor = normalizeListColor(color);
  const data = await apiFetch<{ list: ApiList }>("/lists", {
    method: "POST",
    body: JSON.stringify({ title, movies: initialMovies, color: normalizedColor, mediaType }),
  });
  invalidateListsCache(email);
  return mapApiList(data.list);
}

export async function addMovieToList(
  listId: string,
  tmdbId: number,
  userEmail: string,
  mediaType: "movie" | "tv" = "movie",
): Promise<SavedList> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to update a list");
  }
  const data = await apiFetch<{ list: ApiList }>(`/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ tmdbId, mediaType }),
  });
  invalidateListsCache(email);
  return mapApiList(data.list);
}

export async function loadPublicLists(limit = 24): Promise<SavedList[]> {
  try {
    const data = await apiFetch<{ lists: ApiList[] }>(`/lists/public?limit=${limit}`);
    return data.lists.map(mapApiList);
  } catch (error) {
    console.error("Failed to load public lists", error);
    return [];
  }
}

export async function addFavorite(listId: string, userEmail: string): Promise<void> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to favorite a list");
  }
  await apiFetch<{ ok: boolean }>("/favorites", {
    method: "POST",
    body: JSON.stringify({ listId }),
  });
}

export async function removeFavorite(listId: string, userEmail: string): Promise<void> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to remove a favorite");
  }
  await apiFetch<{ ok: boolean }>(`/favorites/${listId}`, {
    method: "DELETE",
  });
}

export async function loadListShares(listId: string, userEmail: string): Promise<ListShare[]> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load list shares");
  }
  const data = await apiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares`,
  );
  return data.shares;
}

export async function addListShare(listId: string, userEmail: string, username: string): Promise<ListShare[]> {
  const email = normalizeEmail(userEmail);
  const trimmed = username.trim();
  if (!email) {
    throw new Error("userEmail is required to share a list");
  }
  if (!trimmed) {
    throw new Error("username is required to share a list");
  }
  const data = await apiFetch<{ shares: ListShare[] }>(`/lists/${listId}/shares`, {
    method: "POST",
    body: JSON.stringify({ username: trimmed }),
  });
  return data.shares;
}

export async function updateListSharePermission(
  listId: string,
  userEmail: string,
  username: string,
  canEdit: boolean,
): Promise<ListShare[]> {
  const email = normalizeEmail(userEmail);
  const trimmed = username.trim();
  if (!email) {
    throw new Error("userEmail is required to update list shares");
  }
  if (!trimmed) {
    throw new Error("username is required to update list shares");
  }
  const data = await apiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares/${encodeURIComponent(trimmed)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ canEdit }),
    },
  );
  return data.shares;
}

export async function removeListShare(listId: string, userEmail: string, username: string): Promise<ListShare[]> {
  const email = normalizeEmail(userEmail);
  const trimmed = username.trim();
  if (!email) {
    throw new Error("userEmail is required to remove list shares");
  }
  if (!trimmed) {
    throw new Error("username is required to remove list shares");
  }
  const data = await apiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares/${encodeURIComponent(trimmed)}`,
    {
      method: "DELETE",
    },
  );
  return data.shares;
}
