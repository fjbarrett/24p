# 24p

A Next.js 14 + App Router experience for 24p, the collaborative movie-listing app. The current build focuses on the core flows you asked for—Google authentication, half-star ratings, sharable lists, and a home surface that explains how the product works while you wire up the real data layer.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- NextAuth.js (Google OAuth provider, session management)
- React server components + client components for interactive list/rating builders

## Getting started
1. Install deps (the repo ships without `node_modules`):
   ```bash
   npm install
   ```
   If you run into cache permission issues on macOS, set a local npm cache: `npm_config_cache="$(pwd)/.npm-cache" npm install`.
2. Copy the env template:
   ```bash
   cp .env.example .env.local
   ```
3. Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `TMDB_API_KEY`, and `DATABASE_URL` (any Postgres connection string). `NEXTAUTH_URL` should match the dev server URL. Request the TMDB key from https://www.themoviedb.org/settings/api (use the “API Read Access Token (v4 auth)” or v3 key).
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Visit http://localhost:3000 to interact with the mocked rating/list builders.

## Auth configuration
- Create a Google Cloud OAuth client (Web application) and add `http://localhost:3000/api/auth/callback/google` to the authorized redirect URIs.
- Update `.env.local` with your client ID/secret and restart `npm run dev`.
- The route `src/app/api/auth/[...nextauth]/route.ts` already exports the configured handler, so `signIn("google")` from the UI works immediately once credentials exist.
- Wrap additional routes in `getServerSession(authOptions)` to protect dashboards once you connect storage.

## Lists, ratings, and sharing
- Mock curated metadata + TMDB IDs live in `src/lib/app-data.ts`. Replace it with real queries once you attach Postgres.
- `CreateListButton` (`src/components/create-list-button.tsx`) posts to `/api/lists` (backed by Postgres via the `pg` client). `ImportListForm` (`src/components/import-list-form.tsx`) ingests Letterboxd/IMDb CSV text through `/api/lists/import` (sign-in required); imported rows also store your personal rating (via the `user_ratings` table) using your Google account email. The saved lists render under the hero via `ListGallery` (`src/components/list-gallery.tsx`). List detail pages (`/lists/[slug]`) let you rename or delete a list via `ListEditor`.
- `TmdbSearchBar` (`src/components/tmdb-search-bar.tsx`) powers the prominent home search so users can jump straight into finding films and click through to detail pages.
- `ShareCard` (`src/components/share-card.tsx`) represents the social card we will hydrate with dynamic stats per list.
- Movie detail pages live under `/movies/[id]`, pulling TMDB data server-side; the page now lets you add the film to an existing list or create a new one on the fly.


## TMDB-powered list creator
- The API route `src/app/api/tmdb/search/route.ts` proxies the TMDB movie search endpoint and trims the payload to the fields the UI needs (title, release year, rating, poster).
- The detail route `src/app/api/tmdb/movie/route.ts` fetches per-film metadata (runtime, genres, tagline) used across search results and detail pages.
- The lists API (`src/app/api/lists/route.ts`, `src/app/api/lists/[id]/route.ts`, and `src/app/api/lists/[id]/items/route.ts`) reads/writes the Postgres table defined below via helpers from `src/lib/list-store.ts`.
- Provide `TMDB_API_KEY` and `DATABASE_URL` to the environment. Without them the routes respond with HTTP 500.
- Remote poster art is loaded from `image.tmdb.org`; see `next.config.ts` for the configured allowlist.

## Scripts
- `npm run dev` – local development with hot reload.
- `npm run lint` – ESLint with `eslint-config-next`. Run before committing.
- `npm run build` – creates the production bundle; best run in CI with env vars present.
- `npm run start` – serves the built app (used in production).

## Database setup
Create the backing table in your Postgres instance (adjust schema/extension names as needed):

```sql
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'public',
  movies INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_ratings (
  user_email TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, tmdb_id)
);
```

## Next steps
1. Implement sharing routes such as `/lists/[slug]` with dynamic metadata.
2. Persist ratings/lists tied to the `session.user.id` surfaced in the NextAuth callback.
3. Expand testing (Playwright or Vitest) once business logic solidifies.
4. Deploy to Vercel and register its domain as an additional Google OAuth redirect URL.
