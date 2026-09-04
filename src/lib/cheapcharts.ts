export const CHEAPCHARTS_API_BASE = "https://buster.cheapcharts.de/v1";

export const CHEAPCHARTS_COUNTRIES = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "gb", label: "United Kingdom" },
  { value: "au", label: "Australia" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "at", label: "Austria" },
  { value: "ch", label: "Switzerland" },
  { value: "es", label: "Spain" },
  { value: "pt", label: "Portugal" },
  { value: "jp", label: "Japan" },
  { value: "tr", label: "Turkey" },
  { value: "pl", label: "Poland" },
  { value: "in", label: "India" },
  { value: "cn", label: "China" },
] as const;

export type CheapChartsCountry = (typeof CHEAPCHARTS_COUNTRIES)[number]["value"];

export type CheapChartsListSummary = {
  id: string;
  title: string;
  itemCount?: number;
};

export type CheapChartsListLink = {
  id: string;
  title: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type CheapChartsListIntegration = {
  connected: boolean;
  country: CheapChartsCountry;
  availableLists: CheapChartsListSummary[];
  link: CheapChartsListLink | null;
  loadError: string | null;
};

export type CheapChartsSearchItem = {
  idInStore?: string | number;
  title?: string;
  imdbId?: string | null;
  releaseDate?: string;
  releaseYear?: string | number;
  itemType?: string;
  mediaType?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(...values: unknown[]) {
  const value = values.find((candidate) => typeof candidate === "string" || typeof candidate === "number");
  return value === undefined ? "" : String(value).trim();
}

export function parseCheapChartsCustomLists(payload: unknown): CheapChartsListSummary[] {
  const results: CheapChartsListSummary[] = [];
  const seenIds = new Set<string>();
  const queue: unknown[] = [payload];
  let visited = 0;

  while (queue.length > 0 && visited < 5_000) {
    const value = queue.shift();
    visited += 1;
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    const entry = asRecord(value);
    if (!entry) continue;

    const id = stringValue(entry.ID, entry.listID, entry.listId, entry.id);
    const title = stringValue(entry.title, entry.listName, entry.name);
    const isStoreItem = entry.idInStore !== undefined || entry.itemID !== undefined || entry.itemId !== undefined;
    if (id && title && !isStoreItem && !seenIds.has(id)) {
      const countValue = entry.itemCount ?? entry.count;
      const count = typeof countValue === "number" && Number.isFinite(countValue) ? countValue : undefined;
      results.push({ id, title, ...(count === undefined ? {} : { itemCount: count }) });
      seenIds.add(id);
    }

    queue.push(...Object.values(entry));
  }

  return results.sort((a, b) => a.title.localeCompare(b.title));
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function itemYear(item: CheapChartsSearchItem) {
  return String(item.releaseYear ?? item.releaseDate?.slice(0, 4) ?? "");
}

export function selectCheapChartsMovie(
  items: CheapChartsSearchItem[],
  movie: { title: string; releaseYear?: number; imdbId?: string | null },
) {
  const movies = items.filter((item) => {
    const type = (item.itemType ?? item.mediaType ?? "").toLowerCase();
    return Boolean(item.idInStore) && (type === "movie" || type === "movies");
  });
  const imdbId = movie.imdbId?.trim().toLowerCase();
  if (imdbId) {
    const exactImdb = movies.find((item) => item.imdbId?.trim().toLowerCase() === imdbId);
    if (exactImdb) return exactImdb;
  }

  const title = normalizeTitle(movie.title);
  const exactTitle = movies.filter((item) => normalizeTitle(item.title ?? "") === title);
  if (movie.releaseYear) {
    const exactYear = exactTitle.find((item) => itemYear(item) === String(movie.releaseYear));
    if (exactYear) return exactYear;
  }
  return exactTitle.length === 1 ? exactTitle[0] : null;
}
