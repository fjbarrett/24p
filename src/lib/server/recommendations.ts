import "server-only";

import type { SimplifiedMovie } from "@/lib/tmdb";
import { listListsForUser, loadFavoritesForUser } from "@/lib/server/lists";
import { fetchTmdbMovies, fetchTmdbRecommendationsForMovie } from "@/lib/server/tmdb";

const MAX_SEEDS = 10;
const MAX_RESULTS = 24;

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
