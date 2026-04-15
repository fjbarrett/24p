export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

export type TmdbMovieSearchResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  vote_average?: number;
  popularity?: number;
  vote_count?: number;
  poster_path?: string | null;
  imdb_rating?: number | null;
  imdb_id?: string | null;
};

export type SimplifiedMovie = {
  tmdbId: number;
  title: string;
  mediaType?: "movie" | "tv";
  overview?: string;
  releaseYear?: number;
  rating?: number;
  popularity?: number;
  voteCount?: number;
  imdbRating?: number;
  imdbId?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
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

export type ListItem = {
  tmdbId: number;
  mediaType: "movie" | "tv";
};

export type SimplifiedArtist = {
  tmdbId: number;
  name: string;
  popularity?: number;
  profileUrl?: string | null;
  knownFor: string[];
  department?: string | null;
};

export type SearchResultItem =
  | (SimplifiedMovie & { resultType: "movie" })
  | (SimplifiedArtist & { resultType: "artist" });

export type FilmographyEntry = {
  tmdbId: number;
  title: string;
  releaseYear?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  creditType?: "cast" | "crew";
  department?: string | null;
  job?: string | null;
  role?: string | null;
  imdbRating?: number;
  imdbId?: string | null;
  popularity?: number;
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
  const popularity = typeof result.popularity === "number" ? result.popularity : undefined;
  const voteCount = typeof result.vote_count === "number" ? result.vote_count : undefined;
  const posterUrl = result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null;
  const imdbRating = typeof result.imdb_rating === "number" ? Number(result.imdb_rating.toFixed(1)) : undefined;
  const imdbId = result.imdb_id ?? null;

  return {
    tmdbId: result.id,
    title: result.title ?? result.name ?? "Untitled film",
    overview: result.overview,
    releaseYear,
    rating,
    popularity,
    voteCount,
    imdbRating,
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
