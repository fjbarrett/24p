import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { DEFAULT_LIST_COLOR_ID, normalizeListColor } from "@/lib/list-colors";

export type SavedList = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  createdAt: string;
  movies: number[];
  color?: string;
};

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_PATH = path.join(process.cwd(), "data", "lists.json");

if (!DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Lists API will fail until Postgres is configured.");
}

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
let ensuredTable = false;

type ListRow = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  movies: number[];
  created_at: string;
  color?: string | null;
};

async function ensureTable() {
  if (!pool || ensuredTable) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lists (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      slug text NOT NULL UNIQUE,
      visibility text NOT NULL DEFAULT 'public',
      movies integer[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      color text
    );
  `);
  await pool.query("ALTER TABLE lists ADD COLUMN IF NOT EXISTS color text");
  ensuredTable = true;
}

async function query<T = ListRow>(sql: string, params: unknown[] = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }
  await ensureTable();
  const result = await pool.query<T>(sql, params);
  return result.rows;
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

async function generateSlug(title: string) {
  const base = slugify(title);
  let slug = base;
  for (let counter = 1; ; counter += 1) {
    const rows = await query<Pick<ListRow, "id">>("SELECT id FROM lists WHERE slug = $1", [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${counter}`;
  }
}

function mapRow(row: ListRow): SavedList {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    visibility: row.visibility,
    createdAt: row.created_at,
    movies: Array.isArray(row.movies) ? row.movies : [],
    color: normalizeListColor(row.color),
  };
}

export async function loadLists(): Promise<SavedList[]> {
  if (!pool) {
    const fileLists = await loadListsFromFile();
    return fileLists;
  }
  const rows = await query<ListRow>("SELECT * FROM lists ORDER BY created_at DESC");
  return rows.map(mapRow);
}

export async function addList(title: string, initialMovies: number[] = [], color?: string): Promise<SavedList> {
  const normalizedColor = normalizeListColor(color);
  if (!pool) {
    const lists = await loadListsFromFile();
    const slug = await generateFileSlug(title || "Untitled list", lists);
    const newList: SavedList = {
      id: randomUUID(),
      title: title.trim() || "Untitled list",
      slug,
      visibility: "public",
      createdAt: new Date().toISOString(),
      movies: initialMovies,
      color: normalizedColor,
    };
    await saveListsToFile([newList, ...lists]);
    return newList;
  }
  const slug = await generateSlug(title || "Untitled list");
  const rows = await query<ListRow>(
    "INSERT INTO lists (id, title, slug, visibility, movies, color) VALUES ($1, $2, $3, 'public', $4, $5) RETURNING *",
    [randomUUID(), title.trim() || "Untitled list", slug, initialMovies, normalizedColor]
  );
  return mapRow(rows[0]);
}

export async function addMovieToList(listId: string, tmdbId: number): Promise<SavedList> {
  if (!pool) {
    const lists = await loadListsFromFile();
    const index = lists.findIndex((list) => matches(list, listId));
    if (index === -1) throw new Error("List not found");
    const target = lists[index];
    if (!target.movies.includes(tmdbId)) {
      target.movies.unshift(tmdbId);
    }
    lists[index] = target;
    await saveListsToFile(lists);
    return target;
  }
  const row = await getListById(listId);
  if (!row) {
    throw new Error("List not found");
  }
  const movies = row.movies.includes(tmdbId) ? row.movies : [tmdbId, ...row.movies];
  const rows = await query<ListRow>("UPDATE lists SET movies = $2 WHERE id = $1 RETURNING *", [row.id, movies]);
  return mapRow(rows[0]);
}

export async function updateList(
  listId: string,
  data: { title?: string; slug?: string; color?: string },
): Promise<SavedList> {
  if (!pool) {
    const lists = await loadListsFromFile();
    const index = lists.findIndex((list) => matches(list, listId));
    if (index === -1) throw new Error("List not found");
    const next = { ...lists[index] };
    if (data.title && data.title.trim()) {
      next.title = data.title.trim();
    }
    if (data.slug && data.slug.trim()) {
      next.slug = slugify(data.slug);
    }
    if (data.color) {
      next.color = normalizeListColor(data.color);
    }
    if (!next.color) {
      next.color = DEFAULT_LIST_COLOR_ID;
    }
    lists[index] = next;
    await saveListsToFile(lists);
    return next;
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.title && data.title.trim()) {
    fields.push("title = $" + (fields.length + 2));
    values.push(data.title.trim());
  }
  if (data.slug && data.slug.trim()) {
    fields.push("slug = $" + (fields.length + 2));
    values.push(slugify(data.slug));
  }
  if (data.color) {
    fields.push("color = $" + (fields.length + 2));
    values.push(normalizeListColor(data.color));
  }
  if (!fields.length) {
    const row = await getListById(listId);
    if (!row) throw new Error("List not found");
    return row;
  }
  const rows = await query<ListRow>(
    `UPDATE lists SET ${fields.join(",")} WHERE id = $1 RETURNING *`,
    [listId, ...values]
  );
  if (!rows.length) {
    throw new Error("List not found");
  }
  return mapRow(rows[0]);
}

export async function getListBySlug(slug: string): Promise<SavedList | undefined> {
  if (!pool) {
    const lists = await loadListsFromFile();
    return lists.find((list) => list.slug === slug);
  }
  const rows = await query<ListRow>("SELECT * FROM lists WHERE slug = $1", [slug]);
  return rows.length ? mapRow(rows[0]) : undefined;
}

export async function deleteList(listId: string): Promise<void> {
  if (!pool) {
    const lists = await loadListsFromFile();
    const filtered = lists.filter((list) => !matches(list, listId));
    if (filtered.length === lists.length) throw new Error("List not found");
    await saveListsToFile(filtered);
    return;
  }
  const rows = await query<Pick<ListRow, "id">>("DELETE FROM lists WHERE id = $1 RETURNING id", [listId]);
  if (!rows.length) {
    throw new Error("List not found");
  }
}

async function getListById(id: string): Promise<SavedList | undefined> {
  if (!pool) {
    const lists = await loadListsFromFile();
    return lists.find((list) => matches(list, id));
  }
  const rows = await query<ListRow>("SELECT * FROM lists WHERE id = $1", [id]);
  return rows.length ? mapRow(rows[0]) : undefined;
}

function matches(list: SavedList, idOrSlug: string) {
  return list.id === idOrSlug || list.slug === idOrSlug;
}

async function loadListsFromFile(): Promise<SavedList[]> {
  try {
    const contents = await fs.readFile(DATA_PATH, "utf8");
    const raw = JSON.parse(contents) as Partial<SavedList>[];
    let changed = false;
    const normalized = raw.map((entry) => {
      let id = entry.id;
      if (!id) {
        id = randomUUID();
        changed = true;
      }
      let slug = entry.slug;
      if (!slug) {
        slug = slugify(entry.title ?? "list");
        changed = true;
      }
      const createdAt = entry.createdAt ?? new Date().toISOString();
      if (!entry.createdAt) changed = true;
      const color = normalizeListColor(entry.color);
      if (!entry.color || color !== entry.color) {
        changed = true;
      }
      return {
        id,
        title: entry.title ?? "Untitled list",
        slug,
        visibility: entry.visibility ?? "public",
        createdAt,
        movies: Array.isArray(entry.movies) ? entry.movies : [],
        color,
      } satisfies SavedList;
    });
    if (changed) {
      await saveListsToFile(normalized);
    }
    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, "[]\n", "utf8");
      return [];
    }
    throw error;
  }
}

async function saveListsToFile(lists: SavedList[]) {
  await fs.writeFile(DATA_PATH, JSON.stringify(lists, null, 2), "utf8");
}

async function generateFileSlug(title: string, lists: SavedList[]) {
  const base = slugify(title);
  let slug = base;
  for (let counter = 1; lists.some((list) => list.slug === slug); counter += 1) {
    slug = `${base}-${counter}`;
  }
  return slug;
}
