import "server-only";

import type { SimplifiedMovie } from "@/lib/tmdb";
import { listListsForUser, loadFavoritesForUser, getListByIdForEditor } from "@/lib/server/lists";
import { fetchTmdbMovies, fetchTmdbRecommendationsForMovie, fetchTmdbDiscoverByGenreIds } from "@/lib/server/tmdb";

const MAX_SEEDS = 10;
const MAX_RESULTS = 24;
const LIST_MAX_SEEDS = 8;
const LIST_MAX_RESULTS = 18;

// Maps genre keywords (lower-case) → TMDB genre IDs
const GENRE_KEYWORD_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  animated: 16,
  comedy: 35,
  comedies: 35,
  crime: 80,
  documentary: 99,
  documentaries: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  historical: 36,
  horror: 27,
  music: 10402,
  musical: 10402,
  mystery: 9648,
  romance: 10749,
  romantic: 10749,
  "science fiction": 878,
  "sci-fi": 878,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

function detectGenreIds(title: string): number[] {
  const lower = title.toLowerCase();
  const found = new Set<number>();
  for (const [keyword, id] of Object.entries(GENRE_KEYWORD_MAP)) {
    if (lower.includes(keyword)) found.add(id);
  }
  return [...found];
}

export async function getRecommendationsForUser(userEmail: string): Promise<SimplifiedMovie[]> {
  const [ownLists, favoritedLists] = await Promise.all([
    listListsForUser(userEmail, false),
    loadFavoritesForUser(userEmail),
  ]);

  // Collect all film IDs the user has already seen across own lists + favorites
  const ownIds = new Set<number>(ownLists.flatMap((list) => list.movies));
  const favoriteIds = new Set<number>(favoritedLists.flatMap((list) => list.movies));
  const allKnownIds = new Set<number>([...ownIds, ...favoriteIds]);

  if (allKnownIds.size === 0) {
    return [];
  }

  // Score each known film — own list films score higher than just favorited
  const scores = new Map<number, number>();
  for (const id of ownIds) scores.set(id, (scores.get(id) ?? 0) + 2);
  for (const id of favoriteIds) scores.set(id, (scores.get(id) ?? 0) + 1);

  // Pick the highest-scored films as seeds for TMDB recommendations
  const seeds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SEEDS)
    .map(([id]) => id);

  // Fetch TMDB recommendations for each seed in parallel
  const resultSets = await Promise.all(seeds.map((id) => fetchTmdbRecommendationsForMovie(id)));

  // Count how many seeds recommended each film — frequency is our score
  const frequency = new Map<number, number>();
  for (const results of resultSets) {
    for (const movie of results) {
      if (!allKnownIds.has(movie.tmdbId)) {
        frequency.set(movie.tmdbId, (frequency.get(movie.tmdbId) ?? 0) + 1);
      }
    }
  }

  if (frequency.size === 0) {
    return [];
  }

  // Sort by frequency, take top results
  const topIds = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RESULTS)
    .map(([id]) => id);

  return fetchTmdbMovies(topIds);
}

export async function getRecommendationsForList(listId: string, userEmail: string): Promise<SimplifiedMovie[]> {
  const list = await getListByIdForEditor(listId, userEmail);
  if (!list || list.movies.length === 0) return [];

  const knownIds = new Set<number>(list.movies);
  const seeds = list.movies.slice(0, LIST_MAX_SEEDS);
  const genreIds = detectGenreIds(list.title);

  const [resultSets, discoverResults] = await Promise.all([
    Promise.all(seeds.map((id) => fetchTmdbRecommendationsForMovie(id))),
    fetchTmdbDiscoverByGenreIds(genreIds),
  ]);

  // Score by frequency across seeds
  const frequency = new Map<number, number>();
  for (const results of resultSets) {
    for (const movie of results) {
      if (!knownIds.has(movie.tmdbId)) {
        frequency.set(movie.tmdbId, (frequency.get(movie.tmdbId) ?? 0) + 1);
      }
    }
  }
  // Genre-discover gets a half-point boost as a secondary signal
  for (const movie of discoverResults) {
    if (!knownIds.has(movie.tmdbId)) {
      frequency.set(movie.tmdbId, (frequency.get(movie.tmdbId) ?? 0) + 0.5);
    }
  }

  if (frequency.size === 0) return [];

  const topIds = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIST_MAX_RESULTS)
    .map(([id]) => id);

  // Build a movie lookup from all fetched data (no extra round-trips needed)
  const movieLookup = new Map<number, SimplifiedMovie>();
  for (const results of resultSets) {
    for (const movie of results) movieLookup.set(movie.tmdbId, movie);
  }
  for (const movie of discoverResults) {
    if (!movieLookup.has(movie.tmdbId)) movieLookup.set(movie.tmdbId, movie);
  }

  return topIds
    .map((id) => movieLookup.get(id))
    .filter((m): m is SimplifiedMovie => Boolean(m));
}
