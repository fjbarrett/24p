import "server-only";
import { fetchTmdbArtwork } from "@/lib/server/tmdb";

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
  package: {
    packageId: number;
    clearName?: string | null;
    technicalName?: string | null;
    shortName?: string | null;
    icon?: string | null;
  };
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

export type JustWatchAccessModel =
  | "subscription"
  | "free"
  | "ads"
  | "live"
  | "rent"
  | "buy"
  | "cinema";

export type JustWatchOffer = {
  url: string;
  accessModel: JustWatchAccessModel;
  monetizationType: string | null;
  providerName: string;
  providerShortName: string;
  packageId: number;
  lookupKeys: string[];
  iconUrl: string | null;
};

function isJustWatchHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "justwatch.com" || normalized.endsWith(".justwatch.com");
}

function resolveDirectOfferUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "click.justwatch.com") {
      const redirectTarget = parsed.searchParams.get("r");
      if (!redirectTarget) return null;

      const directTarget = new URL(redirectTarget);
      if (isJustWatchHostname(directTarget.hostname)) return null;
      return directTarget.toString();
    }

    if (isJustWatchHostname(hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

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
  "plx",
  "ptv",
  "tbv",
  "fuv",
  "szh",
  "amc",
  "mgm",
  "bbl",
  "shm",
]);

const STREAMING_PROVIDER_NAME_ALLOWLIST = new Set([
  "plex",
  "tubi tv",
  "tubitv",
  "pluto tv",
  "plutotv",
]);

const DEFAULT_DISCOVERY_MONETIZATION_TYPES = new Set([
  "FLATRATE",
]);

const FILTERED_DISCOVERY_MONETIZATION_TYPES = [
  "FLATRATE",
  "ADS",
  "FREE",
  "FAST",
  "RENT",
] as const;

const PROVIDER_FAMILY_ALIASES: Record<string, string[]> = {
  plx: ["pxp", "plc"],
  ptv: ["ptv"],
  tbv: ["tbv"],
};

const SEARCH_QUERY = `
  query($q:String!,$country:Country!,$lang:Language!){
    searchTitles(
      source:"JUSTWATCH_CATALOG"
      country:$country
      language:$lang
      first:5
      filter:{objectTypes:[MOVIE,SHOW],searchQuery:$q}
    ){
      edges{
        node{
          id
          objectType
          ... on Movie{
            content(country:$country,language:$lang){ title originalReleaseYear }
            offers(country:$country,platform:WEB){
              standardWebURL
              monetizationType
              package{ packageId clearName technicalName shortName icon(profile:S100, format:PNG) }
            }
          }
          ... on Show{
            content(country:$country,language:$lang){ title originalReleaseYear }
            offers(country:$country,platform:WEB){
              standardWebURL
              monetizationType
              package{ packageId clearName technicalName shortName icon(profile:S100, format:PNG) }
            }
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

function bestMatch(nodes: JwMovie[], title: string, year?: number, mediaType?: "movie" | "tv"): JwMovie | null {
  const normalizedTitle = title.trim().toLowerCase();
  const scored = nodes.map((node) => {
    const t = node.content.title.trim().toLowerCase();
    let score = 0;
    if (t === normalizedTitle) score += 100;
    else if (t.startsWith(normalizedTitle)) score += 50;
    if (year && node.content.originalReleaseYear === year) score += 40;
    if (mediaType === "movie" && node.objectType === "MOVIE") score += 80;
    if (mediaType === "tv" && node.objectType === "SHOW") score += 80;
    return { node, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].node : (nodes[0] ?? null);
}

function absoluteImageUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${JUSTWATCH_IMAGES}${path}`;
}

function normalizeProviderKey(value?: string | number | null) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized || null;
}

function isAllowedProviderPackage(pkg: {
  shortName?: string | null;
  clearName?: string | null;
  technicalName?: string | null;
}) {
  const shortName = pkg.shortName?.trim().toLowerCase();
  if (shortName && STREAMING_PROVIDER_ALLOWLIST.has(shortName)) return true;

  const clearName = pkg.clearName?.trim().toLowerCase();
  if (clearName && STREAMING_PROVIDER_NAME_ALLOWLIST.has(clearName)) return true;

  const technicalName = pkg.technicalName?.trim().toLowerCase();
  if (technicalName && STREAMING_PROVIDER_NAME_ALLOWLIST.has(technicalName)) return true;

  return false;
}

function packageLookupKeys(pkg: JwOffer["package"]) {
  const keys = new Set<string>();
  const push = (value?: string | number | null) => {
    const normalized = normalizeProviderKey(value);
    if (normalized) keys.add(normalized);
  };

  push(pkg.packageId);
  push(pkg.clearName);
  push(pkg.technicalName);
  push(pkg.shortName);

  if (pkg.shortName?.toLowerCase() === "amp") {
    push("Amazon Prime Video");
    push("Prime Video");
    push("Amazon");
  }

  if (pkg.shortName?.toLowerCase() === "hlu") {
    push("Hulu");
  }

  return [...keys];
}

function normalizeAccessModel(monetizationType?: string | null): JustWatchAccessModel | null {
  switch ((monetizationType ?? "").toUpperCase()) {
    case "FLATRATE":
      return "subscription";
    case "FREE":
      return "free";
    case "ADS":
      return "ads";
    case "FAST":
      return "live";
    case "RENT":
      return "rent";
    case "BUY":
      return "buy";
    case "CINEMA":
      return "cinema";
    default:
      return null;
  }
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

function expandProviderShortNames(providerShortNames?: string[]) {
  const expanded = new Set<string>();

  for (const provider of providerShortNames ?? []) {
    const normalized = provider.trim().toLowerCase();
    if (!normalized) continue;
    expanded.add(normalized);
    for (const alias of PROVIDER_FAMILY_ALIASES[normalized] ?? []) {
      expanded.add(alias);
    }
  }

  return [...expanded];
}

function offerPriority(offer: JwOffer) {
  const type = offer.monetizationType ?? "";
  const index = FILTERED_DISCOVERY_MONETIZATION_TYPES.indexOf(
    type as (typeof FILTERED_DISCOVERY_MONETIZATION_TYPES)[number],
  );
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getStreamingOffer(movie: JwMovie, providerShortNames?: string[]) {
  const offers = movie.offers ?? [];

  if (providerShortNames?.length) {
    const allowedProviders = new Set(expandProviderShortNames(providerShortNames));
    const matchingOffers = offers
      .filter((offer) => {
        const packageKeys = packageLookupKeys(offer.package);
        const matchesProvider = packageKeys.some((key) => allowedProviders.has(key));
        if (!matchesProvider || offerPriority(offer) === Number.POSITIVE_INFINITY) return false;

        // Plex should only surface when JustWatch marks it as free/watchable, not rent-only.
        if (packageKeys.includes("plx")) return false;

        return true;
      })
      .sort((a, b) => offerPriority(a) - offerPriority(b));
    return matchingOffers[0] ?? null;
  }

  return (
    offers.find(
      (offer) => {
        return DEFAULT_DISCOVERY_MONETIZATION_TYPES.has(offer.monetizationType ?? "") && isAllowedProviderPackage(offer.package);
      },
    ) ?? null
  );
}

function mapCatalogMovie(movie: JwMovie, offer: JwOffer): StreamingCatalogMovie | null {
  const tmdbId = Number(movie.content.externalIds?.tmdbId);
  if (!tmdbId || Number.isNaN(tmdbId)) return null;
  const directOfferUrl = resolveDirectOfferUrl(offer.standardWebURL);

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
    primaryOfferUrl: directOfferUrl,
    providerName: offer.package.clearName?.trim() || "Streaming",
    providerShortName: offer.package.shortName?.trim() || "",
    popularity: movie.content.scoring?.tmdbPopularity ?? null,
    imdbRating: movie.content.scoring?.imdbScore ?? null,
    justWatchRating: movie.content.scoring?.jwRating ?? null,
    chartRank: movie.streamingCharts?.edges?.[0]?.streamingChartInfo?.rank ?? null,
  };
}

export async function fetchJustWatchOffers(
  title: string,
  year?: number,
  locale = DEFAULT_LOCALE,
  mediaType?: "movie" | "tv",
): Promise<JustWatchOffer[]> {
  try {
    const data = await postJustWatch<JwSearchResult>(SEARCH_QUERY, {
      q: title,
      country: locale,
      lang: DEFAULT_LANGUAGE,
    });
    if (!data) return [];
    const nodes = data.data.searchTitles.edges.map((e) => e.node);
    if (!nodes.length) return [];

    const match = bestMatch(nodes, title, year, mediaType);
    if (!match?.offers?.length) return [];

    const offers: JustWatchOffer[] = [];
    const seen = new Set<string>();
    for (const offer of match.offers) {
      const accessModel = normalizeAccessModel(offer.monetizationType);
      const directUrl = resolveDirectOfferUrl(offer.standardWebURL);
      if (!accessModel || !directUrl) continue;

      const dedupeKey = `${offer.package.packageId}:${accessModel}:${directUrl}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      offers.push({
        url: directUrl,
        accessModel,
        monetizationType: offer.monetizationType ?? null,
        providerName: offer.package.clearName?.trim() || "Streaming",
        providerShortName: offer.package.shortName?.trim().toLowerCase() || "",
        packageId: offer.package.packageId,
        lookupKeys: packageLookupKeys(offer.package),
        iconUrl: offer.package.icon ? `${JUSTWATCH_ICON_IMAGES}${offer.package.icon}` : null,
      });
    }
    return offers;
  } catch {
    return [];
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
    .filter((pkg) => isAllowedProviderPackage(pkg))
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
  const normalizedProviders = [...new Set(
    (providerShortNames ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )];
  const queryProviders = expandProviderShortNames(normalizedProviders);
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
        ...(queryProviders.length ? { packages: queryProviders } : {}),
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

  const movies = Array.from(collected.values()).slice(0, limit);
  const missingArt = movies.filter((movie) => !movie.posterUrl && movie.backdropUrls.length === 0);

  if (!missingArt.length) {
    return movies;
  }

  const artworkResults = await Promise.allSettled(
    missingArt.map((movie) =>
      fetchTmdbArtwork(movie.tmdbId, movie.contentType === "SHOW" ? "tv" : "movie"),
    ),
  );

  return movies.map((movie) => {
    if (movie.posterUrl || movie.backdropUrls.length > 0) {
      return movie;
    }

    const missingIndex = missingArt.findIndex((candidate) => candidate.tmdbId === movie.tmdbId);
    const artwork = missingIndex >= 0 && artworkResults[missingIndex]?.status === "fulfilled"
      ? artworkResults[missingIndex].value
      : null;

    if (!artwork) {
      return movie;
    }

    return {
      ...movie,
      posterUrl: movie.posterUrl ?? artwork.posterUrl,
      backdropUrls: movie.backdropUrls.length ? movie.backdropUrls : artwork.backdropUrl ? [artwork.backdropUrl] : [],
    };
  });
}
