import "server-only";

import { fetchStreamingCatalog, fetchStreamingCatalogAll, listStreamingPlatforms } from "@/lib/server/justwatch";

export type StreamingCatalogSort = "popularity" | "rating";

export type StreamingCatalogPayload = {
  movies: Awaited<ReturnType<typeof fetchStreamingCatalog>>;
  providers: Awaited<ReturnType<typeof listStreamingPlatforms>>;
  providerIcons: Record<string, string>;
  selectedProviders: string[];
  sort: StreamingCatalogSort;
  seed: string;
  page: number;
  hasNextPage: boolean;
};

export async function getStreamingCatalogPayload(params: {
  provider?: string | string[] | undefined;
  sort?: string | string[] | undefined;
  seed?: string | string[] | undefined;
  page?: string | string[] | undefined;
}): Promise<StreamingCatalogPayload> {
  const providers = await listStreamingPlatforms();
  const selectedProviders = parseProviders(readQueryValue(params.provider), providers);
  const sort = readQueryValue(params.sort)?.toLowerCase() === "rating" ? "rating" : "popularity";
  const seed = readQueryValue(params.seed) ?? Date.now().toString();
  const page = parsePage(readQueryValue(params.page));

  let movies: Awaited<ReturnType<typeof fetchStreamingCatalog>>;
  let hasNextPage: boolean;

  if (sort === "rating") {
    const allMovies = sortStreamingMovies(
      await fetchStreamingCatalogAll({ providerShortNames: selectedProviders }),
      "rating",
    );
    movies = allMovies.slice((page - 1) * 24, page * 24);
    hasNextPage = allMovies.length > page * 24;
  } else {
    movies = sortStreamingMovies(
      await fetchStreamingCatalog({ providerShortNames: selectedProviders, seed, page }),
      "popularity",
    );
    hasNextPage = movies.length === 24;
  }

  const providerIcons = Object.fromEntries(
    providers
      .filter((provider) => Boolean(provider.iconUrl))
      .map((provider) => [provider.shortName, provider.iconUrl as string]),
  );

  return {
    movies,
    providers,
    providerIcons,
    selectedProviders,
    sort,
    seed,
    page,
    hasNextPage,
  };
}

export function buildStreamingHref(providers: string[], sort: StreamingCatalogSort, seed: string, page = 1) {
  const params = new URLSearchParams();
  if (providers.length) params.set("provider", providers.join(","));
  if (sort !== "popularity") params.set("sort", sort);
  params.set("seed", seed);
  if (page > 1) params.set("page", String(page));
  return `/streaming?${params.toString()}`;
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProviders(
  value: string | undefined,
  providers: Awaited<ReturnType<typeof listStreamingPlatforms>>,
) {
  if (!value) return [];
  const allowed = new Set(providers.map((provider) => provider.shortName));
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, all) => Boolean(entry) && allowed.has(entry) && all.indexOf(entry) === index);
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function sortStreamingMovies(
  movies: Awaited<ReturnType<typeof fetchStreamingCatalog>>,
  sort: StreamingCatalogSort,
) {
  const sorted = [...movies];

  if (sort === "rating") {
    sorted.sort((a, b) => {
      const ratingDiff = (b.imdbRating ?? -1) - (a.imdbRating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.popularity ?? -1) - (a.popularity ?? -1);
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const popularityDiff = (b.popularity ?? -1) - (a.popularity ?? -1);
    if (popularityDiff !== 0) return popularityDiff;
    return (b.imdbRating ?? -1) - (a.imdbRating ?? -1);
  });
  return sorted;
}
