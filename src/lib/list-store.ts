import { normalizeListColor } from "@/lib/list-colors";
import { rustApiFetch } from "@/lib/rust-api-client";

export type SavedList = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  createdAt: string;
  movies: number[];
  color?: string;
  userEmail: string;
  username?: string | null;
  canEdit?: boolean;
};

export type ListShare = {
  listId: string;
  userEmail: string;
  username?: string | null;
  createdAt: string;
  canEdit: boolean;
};

type ApiList = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  movies: number[];
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
    const data = await rustApiFetch<{ lists: ApiList[] }>(
      `/lists?userEmail=${encodeURIComponent(email)}&includeShared=true`,
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
  const data = await rustApiFetch<{ list: ApiList }>("/lists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const mapped = mapApiList(data.list);
  if (typeof window !== "undefined") {
    try {
      const email = normalizeEmail(userEmail);
      const existing = window.localStorage.getItem(`lists:${email}`);
      const prev = existing ? (JSON.parse(existing) as CacheEnvelope).lists ?? [] : [];
      const envelope: CacheEnvelope = { ts: Date.now(), lists: [mapped, ...prev] };
      window.localStorage.setItem(`lists:${email}`, JSON.stringify(envelope));
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
  const data = await rustApiFetch<{ list: ApiList }>(`/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ tmdbId, userEmail: email }),
  });
  const mapped = mapApiList(data.list);
  cacheSingleList(email, mapped);
  return mapped;
}

export async function updateList(
  listId: string,
  data: { title?: string; slug?: string; color?: string; visibility?: "public" | "private"; userEmail: string },
): Promise<SavedList> {
  const email = normalizeEmail(data.userEmail);
  if (!email) {
    throw new Error("userEmail is required to update a list");
  }
  const payload: Record<string, string> = {};
  if (data.title && data.title.trim()) payload.title = data.title.trim();
  if (data.slug && data.slug.trim()) payload.slug = slugify(data.slug);
  if (data.color && data.color.trim()) payload.color = normalizeListColor(data.color);
  if (data.visibility) payload.visibility = data.visibility;
  payload.userEmail = email;
  const result = await rustApiFetch<{ list: ApiList }>(`/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const mapped = mapApiList(result.list);
  cacheSingleList(email, mapped);
  return mapped;
}

export async function getListByUsernameSlug(
  username: string,
  slug: string,
  userEmail?: string | null,
): Promise<SavedList | undefined> {
  const email = userEmail ? normalizeEmail(userEmail) : "";
  const params = email ? `?userEmail=${encodeURIComponent(email)}` : "";
  try {
    const data = await rustApiFetch<{ list: ApiList }>(
      `/lists/public/${encodeURIComponent(username)}/${encodeURIComponent(slug)}${params}`,
    );
    const mapped = mapApiList(data.list);
    if (email) {
      cacheSingleList(email, mapped);
    }
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
  await rustApiFetch<{ ok: boolean }>(`/lists/${listId}`, {
    method: "DELETE",
    body: JSON.stringify({ userEmail: email }),
  });
  if (typeof window !== "undefined") {
    try {
      const existing = window.localStorage.getItem(`lists:${email}`);
      if (existing) {
        const prev = (JSON.parse(existing) as CacheEnvelope).lists ?? [];
        const envelope: CacheEnvelope = { ts: Date.now(), lists: prev.filter((list) => list.id !== listId) };
        window.localStorage.setItem(`lists:${email}`, JSON.stringify(envelope));
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
    const prev = existing ? (JSON.parse(existing) as CacheEnvelope).lists ?? [] : [];
    const envelope: CacheEnvelope = {
      ts: Date.now(),
      lists: [updated, ...prev.filter((list) => list.id !== updated.id)],
    };
    window.localStorage.setItem(`lists:${email}`, JSON.stringify(envelope));
  } catch {
    // ignore cache write errors
  }
}

export async function loadPublicLists(limit = 24): Promise<SavedList[]> {
  try {
    const data = await rustApiFetch<{ lists: ApiList[] }>(`/lists/public?limit=${limit}`);
    return data.lists.map(mapApiList);
  } catch (error) {
    console.error("Failed to load public lists", error);
    return [];
  }
}

export async function loadPublicListsForUsername(username: string, limit = 24): Promise<SavedList[]> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  try {
    const data = await rustApiFetch<{ lists: ApiList[] }>(
      `/lists/public?limit=${limit}&username=${encodeURIComponent(normalized)}`,
    );
    return data.lists.map(mapApiList);
  } catch (error) {
    console.error("Failed to load public lists for username", error);
    return [];
  }
}

export async function loadFavorites(userEmail: string): Promise<SavedList[]> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load favorites");
  }
  try {
    const data = await rustApiFetch<{ lists: ApiList[] }>(`/favorites?userEmail=${encodeURIComponent(email)}`);
    return data.lists.map(mapApiList);
  } catch (error) {
    console.error("Failed to load favorites", error);
    return [];
  }
}

export async function addFavorite(listId: string, userEmail: string): Promise<void> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to favorite a list");
  }
  await rustApiFetch<{ ok: boolean }>("/favorites", {
    method: "POST",
    body: JSON.stringify({ listId, userEmail: email }),
  });
}

export async function removeFavorite(listId: string, userEmail: string): Promise<void> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to remove a favorite");
  }
  await rustApiFetch<{ ok: boolean }>(`/favorites/${listId}`, {
    method: "DELETE",
    body: JSON.stringify({ listId, userEmail: email }),
  });
}

export async function loadListShares(listId: string, userEmail: string): Promise<ListShare[]> {
  const email = normalizeEmail(userEmail);
  if (!email) {
    throw new Error("userEmail is required to load list shares");
  }
  const data = await rustApiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares?userEmail=${encodeURIComponent(email)}`,
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
  const data = await rustApiFetch<{ shares: ListShare[] }>(`/lists/${listId}/shares`, {
    method: "POST",
    body: JSON.stringify({ userEmail: email, username: trimmed }),
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
  const data = await rustApiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares/${encodeURIComponent(trimmed)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ userEmail: email, canEdit }),
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
  const data = await rustApiFetch<{ shares: ListShare[] }>(
    `/lists/${listId}/shares/${encodeURIComponent(trimmed)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ userEmail: email }),
    },
  );
  return data.shares;
}
