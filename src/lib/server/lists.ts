import "server-only";

import { randomUUID } from "crypto";
import type { ListItem, ListShare, SavedList } from "@/lib/list-store";
import { getPool } from "@/lib/server/db";
import { findTmdbMovieId } from "@/lib/server/tmdb";
import { saveRatingsForUser } from "@/lib/server/ratings";

type ListRow = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  items: Array<{ tmdbId: number; mediaType: string }>;
  created_at: string;
  color: string | null;
  user_email: string;
  username: string | null;
  can_edit?: boolean;
};

// Subquery fragment that aggregates list_items into a JSON array, ordered newest-first
const ITEMS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('tmdbId', li.tmdb_id, 'mediaType', li.media_type)
                     ORDER BY li.position DESC)
     FROM list_items li WHERE li.list_id = lists.id),
    '[]'::json
  ) AS items
`;

type ShareRow = {
  list_id: string;
  shared_with_email: string;
  username: string | null;
  created_at: string;
  can_edit: boolean;
};

type ParsedEntry = {
  title: string;
  year?: string;
  tmdbId?: number;
  rating?: number;
  source: string;
};

const DEFAULT_COLOR = "neutral";
const ALLOWED_COLORS = new Set(["neutral", "rose", "amber", "emerald", "sky", "violet"]);

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeColor(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return DEFAULT_COLOR;
  return ALLOWED_COLORS.has(normalized) ? normalized : DEFAULT_COLOR;
}

function normalizeVisibility(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "private";
  if (normalized !== "public" && normalized !== "private") {
    throw new Error("visibility must be public or private");
  }
  return normalized as "public" | "private";
}

function normalizeUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3) {
    throw new Error("username must be at least 3 characters");
  }
  if (!/^[a-z0-9]+$/.test(normalized)) {
    throw new Error("username must be alphanumeric only");
  }
  return normalized;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return (slug || "list").slice(0, 60);
}

function mapList(row: ListRow): SavedList {
  const items: ListItem[] = (Array.isArray(row.items) ? row.items : []).map((item) => ({
    tmdbId: item.tmdbId,
    mediaType: item.mediaType === "tv" ? "tv" : "movie",
  }));
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    visibility: row.visibility,
    createdAt: new Date(row.created_at).toISOString(),
    items,
    movies: items.map((item) => item.tmdbId),
    color: normalizeColor(row.color),
    userEmail: normalizeEmail(row.user_email),
    username: row.username,
    canEdit: row.can_edit,
  };
}

function mapShare(row: ShareRow): ListShare {
  return {
    listId: row.list_id,
    userEmail: normalizeEmail(row.shared_with_email),
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
    canEdit: row.can_edit,
  };
}

async function ensureUserHasUsername(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<{ username: string }>("SELECT username FROM profiles WHERE user_email = $1", [userEmail]);
  if (!result.rows[0]?.username) {
    throw new Error("Set a username before making lists public");
  }
}

async function fetchListById(id: string) {
  const pool = getPool();
  const result = await pool.query<ListRow>(
    `
      SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}
      FROM lists
      LEFT JOIN profiles ON lists.user_email = profiles.user_email
      WHERE lists.id = $1
    `,
    [id],
  );
  return result.rows[0] ?? null;
}

async function fetchListShares(listId: string) {
  const pool = getPool();
  const result = await pool.query<ShareRow>(
    `
      SELECT list_shares.list_id,
             list_shares.shared_with_email,
             list_shares.created_at,
             list_shares.can_edit,
             profiles.username
      FROM list_shares
      LEFT JOIN profiles ON list_shares.shared_with_email = profiles.user_email
      WHERE list_shares.list_id = $1
      ORDER BY list_shares.created_at DESC
    `,
    [listId],
  );
  return result.rows.map(mapShare);
}

async function isListSharedWithEdit(listId: string, userEmail: string) {
  const pool = getPool();
  const result = await pool.query("SELECT 1 FROM list_shares WHERE list_id = $1 AND shared_with_email = $2 AND can_edit = true", [
    listId,
    userEmail,
  ]);
  return result.rowCount > 0;
}

async function isListSharedWith(listId: string, userEmail: string) {
  const pool = getPool();
  const result = await pool.query("SELECT 1 FROM list_shares WHERE list_id = $1 AND shared_with_email = $2", [
    listId,
    userEmail,
  ]);
  return result.rowCount > 0;
}

async function generateSlug(title: string, userEmail: string, excludeId?: string) {
  const pool = getPool();
  const base = slugify(title);
  let candidate = base;
  let counter = 1;
  for (;;) {
    const params = excludeId ? [userEmail, candidate, excludeId] : [userEmail, candidate];
    const query = excludeId
      ? "SELECT id FROM lists WHERE user_email = $1 AND slug = $2 AND id <> $3 LIMIT 1"
      : "SELECT id FROM lists WHERE user_email = $1 AND slug = $2 LIMIT 1";
    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

async function insertList(
  title: string,
  initialItems: Array<{ tmdbId: number; mediaType: "movie" | "tv" }>,
  color: string | null,
  userEmail: string,
) {
  const pool = getPool();
  const slug = await generateSlug(title, userEmail);
  const listId = randomUUID();
  await pool.query(
    `INSERT INTO lists (id, title, slug, visibility, color, user_email) VALUES ($1, $2, $3, 'private', $4, $5)`,
    [listId, title, slug, normalizeColor(color), userEmail],
  );
  if (initialItems.length) {
    const values = initialItems
      .map((item, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3}, ${initialItems.length - 1 - index})`)
      .join(", ");
    const params: unknown[] = [listId];
    initialItems.forEach((item) => params.push(item.tmdbId, item.mediaType));
    await pool.query(
      `INSERT INTO list_items (list_id, tmdb_id, media_type, position) VALUES ${values} ON CONFLICT DO NOTHING`,
      params,
    );
  }
  const created = await fetchListById(listId);
  if (!created) throw new Error("List not found");
  return mapList({ ...created, can_edit: true });
}

export async function getListByIdForEditor(listId: string, userEmail: string) {
  const row = await fetchListById(listId);
  if (!row) return null;
  const canEdit =
    normalizeEmail(row.user_email) === userEmail || (await isListSharedWithEdit(listId, userEmail));
  if (!canEdit) return null;
  return mapList({ ...row, can_edit: canEdit });
}

export async function listListsForUser(userEmail: string, includeShared = false) {
  const pool = getPool();
  const query = includeShared
    ? `
        SELECT
          lists.*,
          profiles.username,
          ${ITEMS_SUBQUERY},
          CASE
            WHEN lists.user_email = $1 THEN true
            ELSE COALESCE(list_shares.can_edit, false)
          END AS can_edit
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        LEFT JOIN list_shares ON list_shares.list_id = lists.id AND list_shares.shared_with_email = $1
        WHERE lists.user_email = $1
           OR (list_shares.shared_with_email = $1 AND list_shares.can_edit = true)
        ORDER BY lists.created_at DESC
      `
    : `
        SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}, true AS can_edit
        FROM lists
        LEFT JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.user_email = $1
        ORDER BY lists.created_at DESC
      `;
  const result = await pool.query<ListRow>(query, [userEmail]);
  return result.rows.map(mapList);
}

export async function createListForUser(title: string, userEmail: string, movies: number[] = [], color?: string | null) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("Title is required");
  }
  const uniqueIds = Array.from(new Set(movies));
  const items = uniqueIds.map((id) => ({ tmdbId: id, mediaType: "movie" as const }));
  return insertList(normalizedTitle, items, color ?? null, userEmail);
}

export async function updateListForUser(
  listId: string,
  userEmail: string,
  data: { title?: string; slug?: string; color?: string; visibility?: "public" | "private" },
) {
  const pool = getPool();
  const existing = await fetchListById(listId);
  if (!existing || normalizeEmail(existing.user_email) !== userEmail) {
    throw new Error("List not found");
  }

  const nextTitle = data.title?.trim() || existing.title;
  const nextSlug = data.slug ? await generateSlug(data.slug, existing.user_email, listId) : existing.slug;
  const nextVisibility = data.visibility ? normalizeVisibility(data.visibility) : existing.visibility;
  if (nextVisibility === "public") {
    await ensureUserHasUsername(existing.user_email);
  }

  await pool.query(
    `
      UPDATE lists
      SET title = $2, slug = $3, color = $4, visibility = $5
      WHERE id = $1
    `,
    [listId, nextTitle, nextSlug, normalizeColor(data.color ?? existing.color), nextVisibility],
  );

  const updated = await fetchListById(listId);
  if (!updated) {
    throw new Error("List not found");
  }
  return mapList({ ...updated, can_edit: true });
}

export async function addMovieToListForUser(
  listId: string,
  tmdbId: number,
  userEmail: string,
  mediaType: "movie" | "tv" = "movie",
) {
  const pool = getPool();
  const existing = await fetchListById(listId);
  if (!existing) {
    throw new Error("List not found");
  }
  const canEdit =
    normalizeEmail(existing.user_email) === userEmail || (await isListSharedWithEdit(listId, userEmail));
  if (!canEdit) {
    throw new Error("List not found");
  }

  const nextPosition = await pool
    .query<{ max: number | null }>("SELECT MAX(position) AS max FROM list_items WHERE list_id = $1", [listId])
    .then((r) => (r.rows[0]?.max ?? -1) + 1);

  await pool.query(
    `INSERT INTO list_items (list_id, tmdb_id, media_type, position)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (list_id, tmdb_id) DO NOTHING`,
    [listId, tmdbId, mediaType, nextPosition],
  );

  const updated = await fetchListById(listId);
  if (!updated) throw new Error("List not found");
  return mapList({ ...updated, can_edit: canEdit });
}

export async function removeMovieFromListForUser(listId: string, tmdbId: number, userEmail: string) {
  const pool = getPool();
  const existing = await fetchListById(listId);
  if (!existing) {
    throw new Error("List not found");
  }
  const canEdit =
    normalizeEmail(existing.user_email) === userEmail || (await isListSharedWithEdit(listId, userEmail));
  if (!canEdit) {
    throw new Error("List not found");
  }

  await pool.query("DELETE FROM list_items WHERE list_id = $1 AND tmdb_id = $2", [listId, tmdbId]);

  const updated = await fetchListById(listId);
  if (!updated) throw new Error("List not found");
  return mapList({ ...updated, can_edit: canEdit });
}

export async function deleteListForUser(listId: string, userEmail: string) {
  const pool = getPool();
  const existing = await fetchListById(listId);
  if (!existing || normalizeEmail(existing.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  await pool.query("DELETE FROM lists WHERE id = $1", [listId]);
}

export async function getListByUsernameSlugForViewer(username: string, slug: string, viewerEmail?: string | null) {
  const pool = getPool();
  let normalizedUsername: string;
  try {
    normalizedUsername = normalizeUsername(username);
  } catch {
    return null;
  }
  const owner = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
    normalizedUsername,
  ]);
  const ownerEmail = owner.rows[0]?.user_email;
  if (!ownerEmail) {
    return null;
  }

  const result = await pool.query<ListRow>(
    `
      SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}
      FROM lists
      LEFT JOIN profiles ON lists.user_email = profiles.user_email
      WHERE lists.user_email = $1 AND lists.slug = $2
    `,
    [ownerEmail, slug],
  );
  const list = result.rows[0];
  if (!list) {
    return null;
  }

  const normalizedViewer = viewerEmail ? normalizeEmail(viewerEmail) : null;
  const isOwner = normalizedViewer === normalizeEmail(list.user_email);
  const isShared = normalizedViewer ? await isListSharedWith(list.id, normalizedViewer) : false;
  const canEdit = isOwner || (normalizedViewer ? await isListSharedWithEdit(list.id, normalizedViewer) : false);

  if (list.visibility !== "public" && !isOwner && !isShared) {
    return null;
  }

  return mapList({ ...list, can_edit: canEdit });
}

export async function loadPublicLists(limit = 24, username?: string | null) {
  const pool = getPool();
  if (username) {
    const normalizedUsername = normalizeUsername(username);
    const owner = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
      normalizedUsername,
    ]);
    const ownerEmail = owner.rows[0]?.user_email;
    if (!ownerEmail) {
      return [];
    }
    const result = await pool.query<ListRow>(
      `
        SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}
        FROM lists
        JOIN profiles ON lists.user_email = profiles.user_email
        WHERE lists.visibility = 'public' AND lists.user_email = $1
        ORDER BY lists.created_at DESC
        LIMIT $2
      `,
      [ownerEmail, limit],
    );
    return result.rows.map(mapList);
  }

  const result = await pool.query<ListRow>(
    `
      SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}
      FROM lists
      JOIN profiles ON lists.user_email = profiles.user_email
      WHERE lists.visibility = 'public'
      ORDER BY lists.created_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map(mapList);
}

export async function loadFavoritesForUser(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<ListRow>(
    `
      SELECT lists.*, profiles.username, ${ITEMS_SUBQUERY}
      FROM user_favorites
      JOIN lists ON lists.id = user_favorites.list_id
      LEFT JOIN profiles ON lists.user_email = profiles.user_email
      WHERE user_favorites.user_email = $1
        AND (lists.visibility = 'public' OR lists.user_email = $1)
      ORDER BY user_favorites.created_at DESC
    `,
    [userEmail],
  );
  return Promise.all(
    result.rows.map(async (row) =>
      mapList({
        ...row,
        can_edit: normalizeEmail(row.user_email) === userEmail || (await isListSharedWithEdit(row.id, userEmail)),
      }),
    ),
  );
}

export async function addFavoriteForUser(listId: string, userEmail: string) {
  const pool = getPool();
  const list = await fetchListById(listId);
  if (!list) {
    throw new Error("List not found");
  }
  if (list.visibility !== "public" && normalizeEmail(list.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  await pool.query(
    `
      INSERT INTO user_favorites (user_email, list_id)
      VALUES ($1, $2)
      ON CONFLICT (user_email, list_id) DO NOTHING
    `,
    [userEmail, listId],
  );
}

export async function removeFavoriteForUser(listId: string, userEmail: string) {
  const pool = getPool();
  await pool.query("DELETE FROM user_favorites WHERE user_email = $1 AND list_id = $2", [userEmail, listId]);
}

export async function loadListSharesForUser(listId: string, userEmail: string) {
  const list = await fetchListById(listId);
  if (!list || normalizeEmail(list.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  await ensureUserHasUsername(userEmail);
  return fetchListShares(listId);
}

export async function addListShareForUser(listId: string, userEmail: string, username: string, canEdit = false) {
  const pool = getPool();
  const list = await fetchListById(listId);
  if (!list || normalizeEmail(list.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  await ensureUserHasUsername(userEmail);
  const normalizedUsername = normalizeUsername(username);
  const share = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
    normalizedUsername,
  ]);
  const shareEmail = share.rows[0]?.user_email ? normalizeEmail(share.rows[0].user_email) : null;
  if (!shareEmail) {
    throw new Error("username not found");
  }
  if (shareEmail === userEmail) {
    throw new Error("cannot share with yourself");
  }
  await pool.query(
    `
      INSERT INTO list_shares (list_id, shared_with_email, can_edit)
      VALUES ($1, $2, $3)
      ON CONFLICT (list_id, shared_with_email) DO UPDATE SET can_edit = EXCLUDED.can_edit
    `,
    [listId, shareEmail, canEdit],
  );
  return fetchListShares(listId);
}

export async function updateListSharePermissionForUser(listId: string, userEmail: string, username: string, canEdit: boolean) {
  const pool = getPool();
  const list = await fetchListById(listId);
  if (!list || normalizeEmail(list.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  const normalizedUsername = normalizeUsername(username);
  const share = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
    normalizedUsername,
  ]);
  const shareEmail = share.rows[0]?.user_email ? normalizeEmail(share.rows[0].user_email) : null;
  if (!shareEmail) {
    throw new Error("username not found");
  }
  await pool.query("UPDATE list_shares SET can_edit = $3 WHERE list_id = $1 AND shared_with_email = $2", [
    listId,
    shareEmail,
    canEdit,
  ]);
  return fetchListShares(listId);
}

export async function removeListShareForUser(listId: string, userEmail: string, username: string) {
  const pool = getPool();
  const list = await fetchListById(listId);
  if (!list || normalizeEmail(list.user_email) !== userEmail) {
    throw new Error("List not found");
  }
  const normalizedUsername = normalizeUsername(username);
  const share = await pool.query<{ user_email: string }>("SELECT user_email FROM profiles WHERE username = $1", [
    normalizedUsername,
  ]);
  const shareEmail = share.rows[0]?.user_email ? normalizeEmail(share.rows[0].user_email) : null;
  if (!shareEmail) {
    throw new Error("username not found");
  }
  await pool.query("DELETE FROM list_shares WHERE list_id = $1 AND shared_with_email = $2", [listId, shareEmail]);
  return fetchListShares(listId);
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function normalizeImportRating(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const normalized = parsed <= 5 ? Math.round(parsed * 2) : Math.round(parsed);
  return normalized >= 1 && normalized <= 10 ? normalized : undefined;
}

function parseImportedTitles(raw: string): ParsedEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  if (lines[0].includes(",")) {
    const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
    const titleIndex = header.findIndex((value) => value === "title" || value === "movie title" || value === "primarytitle");
    if (titleIndex >= 0) {
      const yearIndex = header.findIndex((value) => value === "year" || value === "release year" || value === "startyear");
      const tmdbIdIndex = header.findIndex((value) => value === "tmdb id" || value === "tmdbid" || value === "tmdb_id");
      const ratingIndex = header.findIndex((value) => value === "your rating" || value === "rating");
      return lines.slice(1).flatMap((line) => {
        const cells = parseCsvLine(line);
        const title = cells[titleIndex]?.trim();
        if (!title) return [];
        return [
          {
            title,
            year: yearIndex >= 0 ? cells[yearIndex]?.trim() || undefined : undefined,
            tmdbId: tmdbIdIndex >= 0 ? Number(cells[tmdbIdIndex]) || undefined : undefined,
            rating: ratingIndex >= 0 ? normalizeImportRating(cells[ratingIndex]) : undefined,
            source: "import",
          },
        ];
      });
    }
  }

  return lines.map((line) => {
    const match = line.match(/^(.*)\((\d{4})\)$/);
    return {
      title: match ? match[1].trim() : line.trim(),
      year: match?.[2],
      source: "import",
    };
  });
}

export async function importListForUser(title: string, raw: string, userEmail: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle || !raw.trim()) {
    throw new Error("Title and data are required");
  }

  const entries = parseImportedTitles(raw).slice(0, 500);
  if (!entries.length) {
    throw new Error("No movies could be parsed from the import data");
  }

  const ids: number[] = [];
  const ratings: Array<{ tmdbId: number; rating: number; source: string }> = [];

  for (const entry of entries) {
    const tmdbId = entry.tmdbId ?? (await findTmdbMovieId(entry.title, entry.year));
    if (!tmdbId) continue;
    ids.push(tmdbId);
    if (entry.rating) {
      ratings.push({ tmdbId, rating: entry.rating, source: entry.source });
    }
  }

  if (!ids.length) {
    throw new Error("No movies could be matched");
  }

  const list = await insertList(normalizedTitle, ids.map((id) => ({ tmdbId: id, mediaType: "movie" as const })), null, userEmail);
  if (ratings.length) {
    await saveRatingsForUser(userEmail, ratings);
  }
  return list;
}
