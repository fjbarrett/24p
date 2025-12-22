export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

export type TmdbMovieSearchResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  vote_average?: number;
  poster_path?: string | null;
  imdb_rating?: number | null;
  letterboxd_rating?: number | null;
  imdb_id?: string | null;
};

export type SimplifiedMovie = {
  tmdbId: number;
  title: string;
  overview?: string;
  releaseYear?: number;
  rating?: number;
  imdbRating?: number;
  letterboxdRating?: number;
  imdbId?: string | null;
  posterUrl?: string | null;
  runtime?: number;
  genres?: string[];
  tagline?: string | null;
  director?: PersonLink | null;
  cinematographer?: PersonLink | null;
  cast?: PersonLink[];
};

export type PersonLink = {
  tmdbId: number;
  name: string;
  imdbId?: string | null;
  role?: string | null;
};

export type SimplifiedArtist = {
  tmdbId: number;
  name: string;
  profileUrl?: string | null;
  knownFor: string[];
};

export type FilmographyEntry = {
  tmdbId: number;
  title: string;
  releaseYear?: number;
  posterUrl?: string | null;
  role?: string | null;
};

export type TmdbPersonDetail = {
  person: SimplifiedArtist;
  filmography: FilmographyEntry[];
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
  imdb_id?: string | null;
};

function baseMovieMapping(result: TmdbMovieSearchResult): SimplifiedMovie {
  const rawYear = result.release_date?.slice(0, 4);
  const releaseYear = rawYear ? Number(rawYear) : undefined;
  const rating = typeof result.vote_average === "number" ? Number(result.vote_average.toFixed(1)) : undefined;
  const posterUrl = result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null;
  const imdbRating = typeof result.imdb_rating === "number" ? Number(result.imdb_rating.toFixed(1)) : undefined;
  const letterboxdRating =
    typeof result.letterboxd_rating === "number" ? Number(result.letterboxd_rating.toFixed(2)) : undefined;
  const imdbId = result.imdb_id ?? null;

  return {
    tmdbId: result.id,
    title: result.title ?? result.name ?? "Untitled film",
    overview: result.overview,
    releaseYear,
    rating,
    imdbRating,
    letterboxdRating,
    imdbId,
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
    imdbId: result.imdb_id ?? base.imdbId ?? null,
  };
}
