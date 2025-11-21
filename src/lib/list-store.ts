import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type SavedList = {
  id: string;
  title: string;
  slug: string;
  visibility: "public" | "private";
  createdAt: string;
  movies: number[];
};

const DATA_PATH = path.join(process.cwd(), "data", "lists.json");

export async function loadLists(): Promise<SavedList[]> {
  try {
    const contents = await fs.readFile(DATA_PATH, "utf8");
    const raw = JSON.parse(contents) as Partial<SavedList>[];
    return raw.map((list) => ({
      id: list.id ?? crypto.randomUUID(),
      title: list.title ?? "Untitled list",
      slug: list.slug ?? slugify(list.title ?? "list"),
      visibility: list.visibility ?? "public",
      createdAt: list.createdAt ?? new Date().toISOString(),
      movies: Array.isArray(list.movies) ? list.movies : [],
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, "[]\n", "utf8");
      return [];
    }
    throw error;
  }
}

export async function addList(title: string, initialMovie?: number): Promise<SavedList> {
  const lists = await loadLists();
  const slugBase = slugify(title);
  let slug = slugBase;
  let counter = 1;
  while (lists.some((list) => list.slug === slug)) {
    counter += 1;
    slug = `${slugBase}-${counter}`;
  }

  const newList: SavedList = {
    id: crypto.randomUUID(),
    title: title.trim() || "Untitled list",
    slug,
    visibility: "public",
    createdAt: new Date().toISOString(),
    movies: initialMovie ? [initialMovie] : [],
  };

  const updated = [newList, ...lists];
  await fs.writeFile(DATA_PATH, JSON.stringify(updated, null, 2), "utf8");
  return newList;
}

export async function addMovieToList(listId: string, tmdbId: number): Promise<SavedList> {
  const lists = await loadLists();
  const targetIndex = lists.findIndex((list) => list.id === listId);
  if (targetIndex === -1) {
    throw new Error("List not found");
  }

  const target = lists[targetIndex];
  if (!target.movies.includes(tmdbId)) {
    target.movies.unshift(tmdbId);
  }

  lists[targetIndex] = target;
  await fs.writeFile(DATA_PATH, JSON.stringify(lists, null, 2), "utf8");
  return target;
}

export async function updateList(listId: string, data: { title?: string; slug?: string }): Promise<SavedList> {
  const lists = await loadLists();
  const index = lists.findIndex((list) => list.id === listId);
  if (index === -1) {
    throw new Error("List not found");
  }

  const next = { ...lists[index] };
  if (data.title && data.title.trim()) {
    next.title = data.title.trim();
  }
  if (data.slug && data.slug.trim()) {
    next.slug = slugify(data.slug);
  }

  lists[index] = next;
  await fs.writeFile(DATA_PATH, JSON.stringify(lists, null, 2), "utf8");
  return next;
}

export async function getListBySlug(slug: string): Promise<SavedList | undefined> {
  const lists = await loadLists();
  return lists.find((list) => list.slug === slug);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "list";
}
