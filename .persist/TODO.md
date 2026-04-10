# TODO

## Outstanding Tasks

### TV Show Support (suggested order)
1. **Streaming catalog** (easiest): `src/lib/server/justwatch.ts:395` — change `objectTypes: ["MOVIE"]` to `["MOVIE", "SHOW"]`, add `contentType` field to `StreamingCatalogMovie` type
2. **Search** (medium): `src/lib/server/tmdb.ts:252` — add parallel `/search/tv` call, merge results, add `mediaType: "movie" | "tv"` discriminator
3. **Lists** (hardest): `src/lib/list-store.ts` — `movies: number[]` needs DB migration to `items: { tmdbId, type }[]`; all downstream functions need updating

## Feature Ideas

### Ratings System (Phase 1)
- `user_film_ratings` table: `user_id`, `film_id` (TMDB ID), `rating` (1–10), `rated_at`
- Unique constraint on `(user_id, film_id)`
- Aggregate view: `avg_rating` + `vote_count` per film
- Rating only allowed if film is in user's watched list
- UI: rating picker on film detail page; aggregate displayed alongside TMDB rating
- Needs design prototype before implementation

### Recommendations (Phase 2 — content-based)
- Use TMDB metadata (genre, director, cast) to score film similarity
- For a user: find films similar to their top-rated, exclude already-watched
- Can be on-demand or pre-computed nightly into `film_recommendations` table

### Recommendations (Phase 3 — collaborative filtering)
- "Users who rated similarly also liked X"
- Defer until enough ratings data exists to make it meaningful
