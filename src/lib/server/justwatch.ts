import "server-only";

const JUSTWATCH_GRAPHQL = "https://apis.justwatch.com/graphql";
const JUSTWATCH_IMAGES = "https://images.justwatch.com";
const JUSTWATCH_ICON_IMAGES = "https://images.justwatch.com";
const DEFAULT_LOCALE = "US";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_PLATFORM = "WEB";
const DEFAULT_PAGE_SIZE = 24;
const MAX_BATCHES = 3;
const PAGE_STRIDE_MULTIPLIER = 3;

type JwOffer = {
  standardWebURL: string;
  monetizationType?: string | null;
  package: { packageId: number; clearName?: string | null; technicalName?: string | null; shortName?: string | null };
};

type JwMovie = {
  id: string;
  objectType?: string | null;
  content: {
    title: string;
    originalReleaseYear: number | null;
    shortDescription?: string | null;
    posterUrl?: string | null;
    backdrops?: Array<{ backdropUrl?: string | null } | null> | null;
    externalIds?: { tmdbId?: string | null; imdbId?: string | null } | null;
    scoring?: {
      imdbScore?: number | null;
      imdbVotes?: number | null;
      tmdbPopularity?: number | null;
      tmdbScore?: number | null;
      jwRating?: number | null;
    } | null;
  };
  offers: JwOffer[] | null;
  streamingCharts?: {
    edges?: Array<{ streamingChartInfo?: { rank?: number | null } | null }> | null;
  } | null;
};

type JwSearchResult = {
  data: {
    searchTitles: {
      edges: { node: JwMovie }[];
    };
  };
};

type JwPopularTitlesResult = {
  data?: {
    popularTitles?: {
      edges?: Array<{ node: JwMovie | null } | null> | null;
    } | null;
  } | null;
};

type JwPackage = {
  packageId: number;
  clearName: string;
  technicalName: string;
  shortName: string;
  icon?: string | null;
};

type JwPackagesResult = {
  data?: {
    packages?: Array<JwPackage | null> | null;
  } | null;
};

export type StreamingPlatform = {
  packageId: number;
  name: string;
  technicalName: string;
  shortName: string;
  iconUrl: string | null;
};

export type StreamingCatalogMovie = {
  justWatchId: string;
  tmdbId: number;
  imdbId: string | null;
  contentType: "MOVIE" | "SHOW";
  title: string;
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrls: string[];
  primaryOfferUrl: string | null;
  providerName: string;
  providerShortName: string;
  popularity: number | null;
  imdbRating: number | null;
  justWatchRating: number | null;
  chartRank: number | null;
};

const STREAMING_PROVIDER_ALLOWLIST = new Set([
  "nfx",
  "amp",
  "atp",
  "dnp",
  "hlu",
  "mxx",
  "ppp",
  "ppe",
  "pct",
  "cru",
  "tbv",
  "fuv",
  "szh",
  "amc",
  "mgm",
  "bbl",
  "shm",
]);

const SEARCH_QUERY = `
  query($q:String!,$country:Country!,$lang:Language!){
    searchTitles(
      source:"JUSTWATCH_CATALOG"
      country:$country
      language:$lang
      first:5
      filter:{objectTypes:[MOVIE],searchQuery:$q}
    ){
      edges{
        node{
          id
          ... on Movie{
            content(country:$country,language:$lang){ title originalReleaseYear }
            offers(country:$country,platform:WEB){ standardWebURL package{ packageId } }
          }
        }
      }
    }
  }
`;

const PACKAGES_QUERY = `
  query GetProviders($country: Country!, $platform: Platform!, $formatOfferIcon: ImageFormat) {
    packages(country: $country, platform: $platform) {
      packageId
      clearName
      technicalName
      shortName
      icon(profile: S100, format: $formatOfferIcon)
    }
  }
`;

const POPULAR_TITLES_QUERY = `
  query GetPopularTitles(
    $country: Country!,
    $language: Language!,
    $first: Int!,
    $offset: Int,
    $popularTitlesFilter: TitleFilter!,
    $formatPoster: ImageFormat,
    $profile: PosterProfile,
    $backdropProfile: BackdropProfile,
    $filter: OfferFilter!
  ) {
    popularTitles(
      country: $country
      filter: $popularTitlesFilter
      first: $first
      offset: $offset
      sortBy: POPULAR
      sortRandomSeed: 0
    ) {
      edges {
        node {
          id
          objectType
          content(country: $country, language: $language) {
            title
            originalReleaseYear
            shortDescription
            posterUrl(profile: $profile, format: $formatPoster)
            backdrops(profile: $backdropProfile, format: $formatPoster) {
              backdropUrl
            }
            externalIds {
              tmdbId
              imdbId
            }
            scoring {
              imdbScore
              imdbVotes
              tmdbPopularity
              tmdbScore
              jwRating
            }
          }
          offers(country: $country, platform: WEB, filter: $filter) {
            standardWebURL
            monetizationType
            package {
              packageId
              clearName
              technicalName
              shortName
            }
          }
          streamingCharts(country: $country) {
            edges {
              streamingChartInfo {
                rank
              }
            }
          }
        }
      }
    }
  }
`;

function bestMatch(nodes: JwMovie[], title: string, year?: number): JwMovie | null {
  const normalizedTitle = title.trim().toLowerCase();
  const scored = nodes.map((node) => {
    const t = node.content.title.trim().toLowerCase();
    let score = 0;
    if (t === normalizedTitle) score += 100;
    else if (t.startsWith(normalizedTitle)) score += 50;
    if (year && node.content.originalReleaseYear === year) score += 40;
    return { node, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].node : (nodes[0] ?? null);
}

function absoluteImageUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${JUSTWATCH_IMAGES}${path}`;
}

async function postJustWatch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function scoreSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getStreamingOffer(movie: JwMovie, providerShortNames?: string[]) {
  const offers = movie.offers ?? [];

  if (providerShortNames?.length) {
    const allowedProviders = new Set(providerShortNames.map((value) => value.toLowerCase()));
    return (
      offers.find((offer) => {
        const shortName = offer.package.shortName?.toLowerCase();
        return offer.monetizationType === "FLATRATE" && !!shortName && allowedProviders.has(shortName);
      }) ?? null
    );
  }

  return (
    offers.find(
      (offer) => {
        const shortName = offer.package.shortName?.toLowerCase();
        return offer.monetizationType === "FLATRATE" && !!shortName && STREAMING_PROVIDER_ALLOWLIST.has(shortName);
      },
    ) ?? null
  );
}

function mapCatalogMovie(movie: JwMovie, offer: JwOffer): StreamingCatalogMovie | null {
  const tmdbId = Number(movie.content.externalIds?.tmdbId);
  if (!tmdbId || Number.isNaN(tmdbId)) return null;

  return {
    justWatchId: movie.id,
    tmdbId,
    imdbId: movie.content.externalIds?.imdbId ?? null,
    contentType: movie.objectType === "SHOW" ? "SHOW" : "MOVIE",
    title: movie.content.title,
    releaseYear: movie.content.originalReleaseYear ?? null,
    overview: movie.content.shortDescription ?? null,
    posterUrl: absoluteImageUrl(movie.content.posterUrl),
    backdropUrls: (movie.content.backdrops ?? [])
      .map((backdrop) => absoluteImageUrl(backdrop?.backdropUrl))
      .filter((url): url is string => Boolean(url)),
    primaryOfferUrl: offer.standardWebURL ?? null,
    providerName: offer.package.clearName?.trim() || "Streaming",
    providerShortName: offer.package.shortName?.trim() || "",
    popularity: movie.content.scoring?.tmdbPopularity ?? null,
    imdbRating: movie.content.scoring?.imdbScore ?? null,
    justWatchRating: movie.content.scoring?.jwRating ?? null,
    chartRank: movie.streamingCharts?.edges?.[0]?.streamingChartInfo?.rank ?? null,
  };
}

export async function fetchJustWatchLinks(
  title: string,
  year?: number,
  locale = DEFAULT_LOCALE,
): Promise<Record<number, string>> {
  try {
    const data = await postJustWatch<JwSearchResult>(SEARCH_QUERY, {
      q: title,
      country: locale,
      lang: DEFAULT_LANGUAGE,
    });
    if (!data) return {};
    const nodes = data.data.searchTitles.edges.map((e) => e.node);
    if (!nodes.length) return {};

    const match = bestMatch(nodes, title, year);
    if (!match?.offers?.length) return {};

    // De-duplicate: keep first URL per packageId
    const map: Record<number, string> = {};
    for (const offer of match.offers) {
      const id = offer.package.packageId;
      if (!map[id]) map[id] = offer.standardWebURL;
    }
    return map;
  } catch {
    return {};
  }
}

export async function listStreamingPlatforms(locale = DEFAULT_LOCALE): Promise<StreamingPlatform[]> {
  const data = await postJustWatch<JwPackagesResult>(PACKAGES_QUERY, {
    country: locale,
    platform: DEFAULT_PLATFORM,
    formatOfferIcon: "PNG",
  });

  const packages = (data?.data?.packages ?? [])
    .filter((pkg): pkg is JwPackage => Boolean(pkg?.shortName && pkg.clearName && pkg.technicalName))
    .filter((pkg) => STREAMING_PROVIDER_ALLOWLIST.has(pkg.shortName.toLowerCase()))
    .sort((a, b) => a.clearName.localeCompare(b.clearName));

  return packages.map((pkg) => ({
    packageId: pkg.packageId,
    name: pkg.clearName,
    technicalName: pkg.technicalName,
    shortName: pkg.shortName,
    iconUrl: pkg.icon ? `${JUSTWATCH_ICON_IMAGES}${pkg.icon}` : null,
  }));
}

export async function fetchStreamingCatalog({
  providerShortNames,
  seed = "0",
  locale = DEFAULT_LOCALE,
  limit = DEFAULT_PAGE_SIZE,
  page = 1,
}: {
  providerShortNames?: string[];
  seed?: string;
  locale?: string;
  limit?: number;
  page?: number;
}): Promise<StreamingCatalogMovie[]> {
  const normalizedProviders = (providerShortNames ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => STREAMING_PROVIDER_ALLOWLIST.has(value));
  const collected = new Map<number, StreamingCatalogMovie>();
  const pageNumber = Math.max(1, Math.floor(page));
  const offsetBase =
    (scoreSeed(`${normalizedProviders.sort().join(",") || "all"}:${seed}`) % 120) +
    (pageNumber - 1) * limit * PAGE_STRIDE_MULTIPLIER;

  for (let batch = 0; batch < MAX_BATCHES && collected.size < limit; batch += 1) {
    const data = await postJustWatch<JwPopularTitlesResult>(POPULAR_TITLES_QUERY, {
      country: locale,
      language: DEFAULT_LANGUAGE,
      first: limit,
      offset: offsetBase + batch * limit,
      popularTitlesFilter: {
        objectTypes: ["MOVIE", "SHOW"],
        ...(normalizedProviders.length ? { packages: normalizedProviders } : {}),
      },
      formatPoster: "JPG",
      profile: "S718",
      backdropProfile: "S1920",
      filter: { bestOnly: true },
    });

    const nodes = (data?.data?.popularTitles?.edges ?? [])
      .map((edge) => edge?.node)
      .filter((node): node is JwMovie => Boolean(node && (node.objectType === "MOVIE" || node.objectType === "SHOW")));

    if (!nodes.length) break;

    for (const node of nodes) {
      const offer = getStreamingOffer(node, normalizedProviders);
      if (!offer) continue;
      const mapped = mapCatalogMovie(node, offer);
      if (!mapped || collected.has(mapped.tmdbId)) continue;
      collected.set(mapped.tmdbId, mapped);
      if (collected.size >= limit) break;
    }
  }

  return Array.from(collected.values()).slice(0, limit);
}
