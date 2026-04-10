import type { Metadata } from "next";
import Link from "next/link";
import { StreamingCatalogGrid } from "@/components/streaming-catalog-grid";
import { StreamingDiscoveryControls } from "@/components/streaming-discovery-controls";
import { fetchStreamingCatalog, listStreamingPlatforms } from "@/lib/server/justwatch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Streaming" },
  robots: { index: false, follow: false },
};

type StreamingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StreamingPage({ searchParams }: StreamingPageProps) {
  const [rawSearchParams, providers] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    listStreamingPlatforms(),
  ]);
  const resolvedSearchParams = rawSearchParams as Record<string, string | string[] | undefined>;

  const selectedProviders = parseProviders(readQueryValue(resolvedSearchParams.provider), providers);
  const sortParam = readQueryValue(resolvedSearchParams.sort)?.toLowerCase() === "rating" ? "rating" : "popularity";
  // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is safe here
  const seed = readQueryValue(resolvedSearchParams.seed) ?? Date.now().toString();
  const page = parsePage(readQueryValue(resolvedSearchParams.page));
  const movies = sortStreamingMovies(await fetchStreamingCatalog({
    providerShortNames: selectedProviders,
    seed,
    page,
  }), sortParam);
  const providerIcons = Object.fromEntries(
    providers
      .filter((provider) => Boolean(provider.iconUrl))
      .map((provider) => [provider.shortName, provider.iconUrl as string]),
  );

  const previousHref = page > 1 ? buildStreamingHref(selectedProviders, sortParam, seed, page - 1) : null;
  const nextHref = movies.length === 24 ? buildStreamingHref(selectedProviders, sortParam, seed, page + 1) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-6 sm:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Streaming</h1>
        </header>

        <StreamingDiscoveryControls providers={providers} selectedProviders={selectedProviders} selectedSort={sortParam} />

        <StreamingCatalogGrid movies={movies} providerIcons={providerIcons} />

        <nav className="flex items-center justify-center gap-3">
          {previousHref ? (
            <Link
              href={previousHref}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-sm text-white/25">Previous</span>
          )}

          <span className="text-sm text-white/50">Page {page}</span>

          {nextHref ? (
            <Link
              href={nextHref}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-sm text-white/25">Next</span>
          )}
        </nav>
      </div>
    </div>
  );
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildStreamingHref(providers: string[], sort: string, seed: string, page = 1) {
  const params = new URLSearchParams();
  if (providers.length) params.set("provider", providers.join(","));
  if (sort !== "popularity") params.set("sort", sort);
  params.set("seed", seed);
  if (page > 1) params.set("page", String(page));
  return `/streaming?${params.toString()}`;
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
  sort: "popularity" | "rating",
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
