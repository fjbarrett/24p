export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

export type TmdbMovieSearchResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  vote_average?: number;
  poster_path?: string | null;
};

export type SimplifiedMovie = {
  tmdbId: number;
  title: string;
  overview?: string;
  releaseYear?: number;
  rating?: number;
  posterUrl?: string | null;
  runtime?: number;
  genres?: string[];
  tagline?: string | null;
};

export type TmdbSearchResponse = {
  page: number;
  total_results: number;
  total_pages: number;
  results: TmdbMovieSearchResult[];
};

export type TmdbMovieDetailsResult = TmdbMovieSearchResult & {
  runtime?: number;
  genres?: { id: number; name?: string | null }[];
  tagline?: string | null;
};

function baseMovieMapping(result: TmdbMovieSearchResult): SimplifiedMovie {
  const rawYear = result.release_date?.slice(0, 4);
  const releaseYear = rawYear ? Number(rawYear) : undefined;
  const rating = typeof result.vote_average === "number" ? Number(result.vote_average.toFixed(1)) : undefined;
  const posterUrl = result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null;

  return {
    tmdbId: result.id,
    title: result.title ?? result.name ?? "Untitled film",
    overview: result.overview,
    releaseYear,
    rating,
    posterUrl,
  };
}

export function mapTmdbMovie(result: TmdbMovieSearchResult): SimplifiedMovie {
  return baseMovieMapping(result);
}

export function mapTmdbMovieDetails(result: TmdbMovieDetailsResult): SimplifiedMovie {
  const base = baseMovieMapping(result);
  return {
    ...base,
    runtime: typeof result.runtime === "number" ? result.runtime : undefined,
    genres: Array.isArray(result.genres)
      ? result.genres.map((genre) => genre.name).filter((name): name is string => Boolean(name))
      : undefined,
    tagline: result.tagline ?? null,
  };
}
