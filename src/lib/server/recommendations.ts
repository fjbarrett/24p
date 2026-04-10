import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { listListsForUser, loadFavoritesForUser, getListByIdForEditor } from "@/lib/server/lists";
import { fetchTmdbMovies, fetchTmdbRecommendationsForMovie, findTmdbMovieId } from "@/lib/server/tmdb";

const MAX_SEEDS = 10;
const MAX_RESULTS = 24;
const LIST_SUGGEST_COUNT = 18;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey });
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

  // Fetch titles for all movies in the list so Claude has human-readable context
  const listMovies = await fetchTmdbMovies(list.movies);
  const knownIds = new Set<number>(listMovies.map((m) => m.tmdbId));
  const movieLines = listMovies
    .map((m) => (m.releaseYear ? `${m.title} (${m.releaseYear})` : m.title))
    .join("\n");

  // Ask Haiku to suggest films that would fit this list
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a film recommendation engine. Given a list name and its current films, suggest ${LIST_SUGGEST_COUNT} other films that would fit well in the list.

List name: "${list.title}"

Current films:
${movieLines}

Rules:
- Do NOT suggest any film already in the list
- Suggest films that share thematic, stylistic, tonal, or genre qualities with the existing films, informed by the list name
- Return ONLY a JSON array of objects with "title" and "year" (number) fields — no prose, no markdown, no explanation
- Example format: [{"title":"Blade Runner","year":1982},{"title":"Alien","year":1979}]`,
      },
    ],
  });

  // Parse Claude's response
  const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
  let suggestions: Array<{ title: string; year?: number }> = [];
  try {
    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    suggestions = JSON.parse(cleaned) as Array<{ title: string; year?: number }>;
  } catch {
    return [];
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) return [];

  // Resolve each suggestion to a TMDB ID, filter already-known films, fetch full data
  const resolved = await Promise.allSettled(
    suggestions.map(async ({ title, year }) => {
      const tmdbId = await findTmdbMovieId(title, year ? String(year) : undefined);
      return tmdbId && !knownIds.has(tmdbId) ? tmdbId : null;
    }),
  );

  const tmdbIds = resolved
    .flatMap((r) => (r.status === "fulfilled" && r.value !== null ? [r.value] : []))
    .filter((id, idx, arr) => arr.indexOf(id) === idx); // dedupe

  return fetchTmdbMovies(tmdbIds);
}
