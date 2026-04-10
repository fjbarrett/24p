import "server-only";

import type { FilmographyEntry, PersonLink, SimplifiedArtist, SimplifiedMovie } from "@/lib/tmdb";

const TMDB_API_ROOT = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";
const DEFAULT_STRAWBERRY_BASE_URL =
  process.env.NODE_ENV === "development" ? "https://strawberry.fjbarrett.workers.dev" : "";

type TmdbMovie = {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
  vote_count?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number | null;
  tagline?: string | null;
  imdb_id?: string | null;
  genres?: Array<{ name?: string | null }> | null;
  credits?: {
    cast?: Array<{ id: number; name?: string | null; character?: string | null; order?: number | null }> | null;
    crew?: Array<{ id: number; name?: string | null; job?: string | null; department?: string | null }> | null;
  } | null;
  videos?: {
    results?: Array<{
      key?: string | null;
      name?: string | null;
      official?: boolean | null;
      published_at?: string | null;
      site?: string | null;
      size?: number | null;
      type?: string | null;
    }> | null;
  } | null;
};

type TmdbPerson = {
  id: number;
  name?: string | null;
  profile_path?: string | null;
  popularity?: number | null;
};

type TmdbMovieCredit = {
  id: number;
  title?: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  character?: string | null;
  job?: string | null;
  department?: string | null;
};

function getApiKey() {
  return process.env.TMDB_API_KEY?.trim() || null;
}

function getStrawberryBaseUrl() {
  const candidate =
    process.env.STRAWBERRY_BASE_URL ??
    process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL ??
    DEFAULT_STRAWBERRY_BASE_URL;
  return candidate.replace(/\/$/, "");
}

function applyQueryParams(
  url: URL,
  params?: Record<string, string | number | boolean | undefined>,
) {
  url.searchParams.set("language", "en-US");
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });
}

async function fetchFromStrawberry<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const base = getStrawberryBaseUrl();
  if (!base) {
    throw new Error("TMDB_API_KEY is not configured and STRAWBERRY_BASE_URL is unavailable");
  }

  const url = new URL(`/tmdb${path}`, base);
  applyQueryParams(url, params);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error(`Strawberry TMDB request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function tmdbFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return fetchFromStrawberry<T>(path, params);
  }

  const url = new URL(`${TMDB_API_ROOT}${path}`);
  url.searchParams.set("api_key", apiKey);
  applyQueryParams(url, params);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchExternalRatings(imdbId: string) {
  const base = getStrawberryBaseUrl();
  if (!base) {
    return undefined;
  }

  const url = new URL(`/ratings/${imdbId}`, base);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { imdbRating?: number | string | null };
    const raw = body.imdbRating;
    const rating = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isFinite(rating) ? Number(rating.toFixed(1)) : undefined;
  } catch {
    return undefined;
  }
}

function parseReleaseYear(value?: string | null) {
  const year = value?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? Number(year) : undefined;
}

function posterUrl(path?: string | null) {
  return path ? `${TMDB_IMAGE_BASE}${path}` : null;
}

function normalizeTitle(value?: string | null, fallback = "Untitled film") {
  return value?.trim() || fallback;
}

function toPersonLink(id: number, name?: string | null, role?: string | null): PersonLink | null {
  const normalized = name?.trim();
  if (!normalized) return null;
  return {
    tmdbId: id,
    name: normalized,
    role: role?.trim() || null,
    imdbId: null,
  };
}

function mapMovie(movie: TmdbMovie, mediaType: "movie" | "tv" = "movie"): SimplifiedMovie {
  return {
    tmdbId: movie.id,
    title: normalizeTitle(movie.title ?? movie.name),
    mediaType,
    overview: movie.overview ?? undefined,
    releaseYear: parseReleaseYear(movie.release_date ?? movie.first_air_date),
    rating: typeof movie.vote_average === "number" ? Number(movie.vote_average.toFixed(1)) : undefined,
    popularity: typeof movie.popularity === "number" ? movie.popularity : undefined,
    voteCount: typeof movie.vote_count === "number" ? movie.vote_count : undefined,
    posterUrl: posterUrl(movie.poster_path),
    backdropUrl: posterUrl(movie.backdrop_path),
    runtime: typeof movie.runtime === "number" ? movie.runtime : undefined,
    tagline: movie.tagline ?? null,
    genres: Array.isArray(movie.genres)
      ? movie.genres.map((genre) => genre.name?.trim()).filter((value): value is string => Boolean(value))
      : undefined,
    imdbId: movie.imdb_id ?? null,
  };
}

function enrichMoviePeople(movie: SimplifiedMovie, credits?: TmdbMovie["credits"] | null) {
  const crew = credits?.crew ?? [];
  const cast = credits?.cast ?? [];
  const director = crew.find((person) => person.job === "Director");
  const cinematographer = crew.find(
    (person) => person.job === "Director of Photography" || person.job === "Cinematography",
  );

  movie.director = director ? toPersonLink(director.id, director.name, director.job) : null;
  movie.cinematographer = cinematographer
    ? toPersonLink(cinematographer.id, cinematographer.name, cinematographer.job)
    : null;
  movie.cast = cast
    .slice()
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 8)
    .map((person) => toPersonLink(person.id, person.name, person.character))
    .filter((value): value is PersonLink => Boolean(value));

  return movie;
}

function scoreMovieResult(query: string, movie: TmdbMovie) {
  const title = normalizeTitle(movie.title ?? movie.name, "").toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  let score = 0;
  if (!normalizedQuery) return score;
  if (title === normalizedQuery) score += 100;
  else if (title.startsWith(normalizedQuery)) score += 75;
  else if (title.includes(normalizedQuery)) score += 50;
  score += Math.min(Math.round((movie.popularity ?? 0) / 10), 20);
  score += Math.min(Math.round((movie.vote_count ?? 0) / 500), 10);
  return score;
}

function mapArtist(person: TmdbPerson): SimplifiedArtist | null {
  const name = person.name?.trim();
  if (!name) return null;
  return {
    tmdbId: person.id,
    name,
    popularity: typeof person.popularity === "number" ? person.popularity : undefined,
    profileUrl: posterUrl(person.profile_path),
    knownFor: [],
  };
}

export async function searchTmdb(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [], artists: [] };
  }

  const [moviesPayload, tvPayload, peoplePayload] = await Promise.all([
    tmdbFetch<{ results?: TmdbMovie[] }>("/search/movie", {
      query: trimmed,
      include_adult: false,
      page: 1,
    }),
    tmdbFetch<{ results?: TmdbMovie[] }>("/search/tv", {
      query: trimmed,
      include_adult: false,
      page: 1,
    }),
    tmdbFetch<{ results?: TmdbPerson[] }>("/search/person", {
      query: trimmed,
      include_adult: false,
      page: 1,
    }),
  ]);

  const tagged = [
    ...(moviesPayload.results ?? []).map((m) => ({ raw: m, mediaType: "movie" as const })),
    ...(tvPayload.results ?? []).map((m) => ({ raw: m, mediaType: "tv" as const })),
  ];

  const results = tagged
    .slice()
    .sort((a, b) => scoreMovieResult(trimmed, b.raw) - scoreMovieResult(trimmed, a.raw))
    .map(({ raw, mediaType }) => mapMovie(raw, mediaType))
    .filter((movie) => Boolean(movie.posterUrl))
    .slice(0, 10);

  const artists = (peoplePayload.results ?? [])
    .map(mapArtist)
    .filter((artist): artist is SimplifiedArtist => Boolean(artist))
    .slice(0, 6);

  return { results, artists };
}

export async function fetchTmdbShow(tmdbId: number): Promise<SimplifiedMovie> {
  const show = await tmdbFetch<TmdbMovie>(`/tv/${tmdbId}`, {
    append_to_response: "external_ids",
  });
  // external_ids comes back as a nested object when using append_to_response
  const externalIds = (show as unknown as { external_ids?: { imdb_id?: string | null } }).external_ids;
  const withImdbId: TmdbMovie = externalIds?.imdb_id ? { ...show, imdb_id: externalIds.imdb_id } : show;
  const mapped = mapMovie(withImdbId, "tv");
  if (mapped.imdbId) {
    mapped.imdbRating = await fetchExternalRatings(mapped.imdbId);
  }
  return mapped;
}

export async function fetchTmdbMovie(tmdbId: number, lite = false): Promise<SimplifiedMovie> {
  const movie = await tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
    append_to_response: lite ? undefined : "credits",
  });
  const mapped = mapMovie(movie);
  if (mapped.imdbId) {
    mapped.imdbRating = await fetchExternalRatings(mapped.imdbId);
  }
  return lite ? mapped : enrichMoviePeople(mapped, movie.credits);
}

export async function fetchTmdbMovies(tmdbIds: number[]) {
  const results = await Promise.allSettled(tmdbIds.map((tmdbId) => fetchTmdbMovie(tmdbId, true)));
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function fetchTmdbArtwork(
  tmdbId: number,
  mediaType: "movie" | "tv" = "movie",
): Promise<{ posterUrl: string | null; backdropUrl: string | null }> {
  const item = await tmdbFetch<TmdbMovie>(`/${mediaType}/${tmdbId}`);
  return {
    posterUrl: posterUrl(item.poster_path),
    backdropUrl: posterUrl(item.backdrop_path),
  };
}

type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
};

type WatchProvidersResponse = {
  results?: Record<string, {
    link?: string;
    flatrate?: WatchProvider[];
  }>;
};

export type StreamingProvider = {
  id: number;
  name: string;
  logoUrl: string;
  displayPriority: number;
};

export type WatchProviders = {
  providers: StreamingProvider[];
  justWatchLink: string | null;
};

export type MovieTrailer = {
  embedUrl: string | null;
  source: "youtube" | null;
};

const APPLE_TV_PLUS_ID = 350;
const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w45";

export async function fetchWatchProviders(
  tmdbId: number,
  locale = "US",
  mediaType: "movie" | "tv" = "movie",
  includeAppleTvPlus = false,
): Promise<WatchProviders> {
  try {
    const data = await tmdbFetch<WatchProvidersResponse>(`/${mediaType}/${tmdbId}/watch/providers`);
    const region = data.results?.[locale];
    if (!region) return { providers: [], justWatchLink: null };

    const providers = (region.flatrate ?? [])
      .filter((p) => includeAppleTvPlus || p.provider_id !== APPLE_TV_PLUS_ID)
      .sort((a, b) => a.display_priority - b.display_priority)
      .slice(0, 6)
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoUrl: `${TMDB_LOGO_BASE}${p.logo_path}`,
        displayPriority: p.display_priority,
      }));

    return { providers, justWatchLink: region.link ?? null };
  } catch {
    return { providers: [], justWatchLink: null };
  }
}

export async function fetchTmdbTrailerForMovie(tmdbId: number): Promise<MovieTrailer> {
  try {
    const data = await tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
      append_to_response: "videos",
    });

    const videos = data.videos?.results ?? [];
    const youtubeVideos = videos.filter((video) => video.site === "YouTube" && video.key);
    const scored = youtubeVideos
      .map((video) => ({
        key: video.key as string,
        score: scoreTrailer(video),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.key;
    if (!best) return { embedUrl: null, source: null };

    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${best}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${best}&enablejsapi=1`,
      source: "youtube",
    };
  } catch {
    return { embedUrl: null, source: null };
  }
}

function scoreTrailer(video: NonNullable<NonNullable<TmdbMovie["videos"]>["results"]>[number]) {
  let score = 0;
  if (video.type === "Trailer") score += 100;
  else if (video.type === "Teaser") score += 70;
  else if (video.type === "Clip") score += 45;
  else if (video.type === "Featurette") score += 30;
  else score += 10;
  if (video.official) score += 50;
  if (video.name?.toLowerCase().includes("official")) score += 20;
  if (video.name?.toLowerCase().includes("trailer")) score += 15;
  if (video.name?.toLowerCase().includes("teaser")) score += 8;
  score += video.size ?? 0;
  if (video.published_at) {
    const timestamp = Date.parse(video.published_at);
    if (Number.isFinite(timestamp)) score += timestamp / 1e12;
  }
  return score;
}

type TmdbVideoResult = NonNullable<NonNullable<TmdbMovie["videos"]>["results"]>[number];

export async function fetchTmdbTrailerForShow(tmdbId: number): Promise<MovieTrailer> {
  try {
    const data = await tmdbFetch<{ results?: TmdbVideoResult[] }>(`/tv/${tmdbId}/videos`);
    const videos = data.results ?? [];
    const youtubeVideos = videos.filter((video) => video.site === "YouTube" && video.key);
    const scored = youtubeVideos
      .map((video) => ({ key: video.key as string, score: scoreTrailer(video) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.key;
    if (!best) return { embedUrl: null, source: null };
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${best}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${best}&enablejsapi=1`,
      source: "youtube",
    };
  } catch {
    return { embedUrl: null, source: null };
  }
}

export async function fetchTmdbRecommendationsForMovie(tmdbId: number): Promise<SimplifiedMovie[]> {
  try {
    const data = await tmdbFetch<{ results?: TmdbMovie[] }>(`/movie/${tmdbId}/recommendations`, { page: 1 });
    return (data.results ?? []).map((m) => mapMovie(m)).filter((movie) => Boolean(movie.posterUrl));
  } catch {
    return [];
  }
}

export async function fetchTmdbDiscoverByGenreIds(genreIds: number[]): Promise<SimplifiedMovie[]> {
  if (!genreIds.length) return [];
  try {
    const data = await tmdbFetch<{ results?: TmdbMovie[] }>("/discover/movie", {
      with_genres: genreIds.join(","),
      sort_by: "vote_count.desc",
      "vote_count.gte": 200,
      page: 1,
    });
    return (data.results ?? []).map((m) => mapMovie(m)).filter((movie) => Boolean(movie.posterUrl));
  } catch {
    return [];
  }
}

export async function findTmdbMovieId(title: string, year?: string | null) {
  const response = await tmdbFetch<{ results?: TmdbMovie[] }>("/search/movie", {
    query: title,
    include_adult: false,
    page: 1,
    year: year?.trim() || undefined,
  });
  return response.results?.[0]?.id ?? null;
}

export async function fetchTmdbPersonWithFilmography(
  personId: number,
): Promise<{ person: SimplifiedArtist; filmography: FilmographyEntry[] }> {
  const [details, credits] = await Promise.all([
    tmdbFetch<TmdbPerson>(`/person/${personId}`),
    tmdbFetch<{ cast?: TmdbMovieCredit[]; crew?: TmdbMovieCredit[] }>(`/person/${personId}/movie_credits`),
  ]);

  const person = mapArtist(details);
  if (!person) {
    throw new Error("Artist not found");
  }

  const filmography = [...(credits.cast ?? []), ...(credits.crew ?? [])]
    .map((credit) => ({
      tmdbId: credit.id,
      title: normalizeTitle(credit.title),
      releaseYear: parseReleaseYear(credit.release_date),
      posterUrl: posterUrl(credit.poster_path),
      backdropUrl: posterUrl(credit.backdrop_path),
      creditType: credit.character ? ("cast" as const) : ("crew" as const),
      department: credit.department ?? null,
      job: credit.job ?? null,
      role: credit.character ?? null,
      imdbId: null,
      imdbRating: undefined,
    }))
    .sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));

  return { person, filmography };
}
