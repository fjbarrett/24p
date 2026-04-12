# TODO

## Outstanding Tasks

### TV Show Support (suggested order)
1. **Streaming catalog** (easiest): `src/lib/server/justwatch.ts:395` — change `objectTypes: ["MOVIE"]` to `["MOVIE", "SHOW"]`, add `contentType` field to `StreamingCatalogMovie` type
2. **Search** (medium): `src/lib/server/tmdb.ts:252` — add parallel `/search/tv` call, merge results, add `mediaType: "movie" | "tv"` discriminator
3. **Lists** (hardest): `src/lib/list-store.ts` — `movies: number[]` needs DB migration to `items: { tmdbId, type }[]`; all downstream functions need updating

### Reliability Follow-up
- Rename `src/middleware.ts` to the Next 16 `proxy` convention to remove the build deprecation warning before it becomes a breaking change.
- Clean up current lint warnings in `src/components/movie-actions.tsx`, `src/components/movie-trailer-toggle.tsx`, and `src/lib/server/db.ts` so the audit baseline is warning-free.

## Feature Ideas

### Monetization
- Affiliate commerce first: attach provider/referral links on `/streaming`, movie detail, TV detail, and exported/public lists; best fit because the app already resolves watch destinations and streaming providers
- Freemium Pro plan: keep core list-making free, charge for premium profile themes, advanced recommendations, unlimited imports/exports, list analytics, and collaborative list permissions/history
- Sponsored discovery: sell featured placement for distributors, festivals, repertory theaters, or streamers inside discovery surfaces, but only if clearly labeled to avoid damaging trust
- B2B curator tools: offer white-label/public-list embeds, editorial list CMS, and outbound-click analytics for creators, podcasters, newsletters, or small film publishers
- Gift/subscription path: yearly patron tier with supporter badge and early access to TV support, Apple TV app sync, and future social features
- Avoid early ads: generic display ads are likely low yield at current stage and would undercut the product's aesthetics before you have scale
- Validate before building billing: measure outbound provider click-through, repeat list sharing, recommendation usage, and import retention to see which revenue path matches actual user behavior

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
