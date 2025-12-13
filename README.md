# 24p

A Next.js 14 + App Router experience for 24p, the collaborative movie-listing app. The current build focuses on the core flows you asked for—Google authentication, half-star ratings, sharable lists, and a home surface that explains how the product works while you wire up the real data layer.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- NextAuth.js (Google OAuth provider, session management)
- React server components + client components for interactive list/rating builders
- Bun for package management (`bun.lock`)

## Backend architecture
- Rust Axum API is the sole backend for lists, ratings, and TMDB queries; it runs on the same host as Postgres, using `APP_HOST`/`APP_PORT` to bind and `DATABASE_URL` to reach the local database.
- The Next.js API folder now houses NextAuth plus a `/api/rust/*` proxy that forwards requests to the Rust service to keep browser calls same-origin.

## Getting started
1. Install deps (the repo ships without `node_modules`):
   ```bash
   bun install
   ```
2. Copy the env template:
   ```bash
   cp .env.example .env.local
   ```
3. Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `TMDB_API_KEY`, `DATABASE_URL` (any Postgres connection string), and `RUST_API_ORIGIN=http://localhost:8080` so the server knows where to proxy. Browsers default to calling `/api/rust/*` (same origin), but you can override with `NEXT_PUBLIC_RUST_API_BASE_URL` if you need a direct absolute origin. `NEXTAUTH_URL` should match the dev server URL. Request the TMDB key from https://www.themoviedb.org/settings/api (use the “API Read Access Token (v4 auth)” or v3 key). The TMDB key is consumed by the Rust API now, so export it in the shell that runs `cargo run -p rust-api` (or add it to a `.env` file in `rust-api/`).
4. Start the Rust API (`cargo run -p rust-api` from the `rust-api/` directory) and then run the dev server:
   ```bash
   bun run dev
   ```
5. Visit http://localhost:3000 to interact with the mocked rating/list builders.

## Auth configuration
- Create a Google Cloud OAuth client (Web application) and add `http://localhost:3000/api/auth/callback/google` to the authorized redirect URIs.
- Update `.env.local` with your client ID/secret and restart `bun run dev`.
- The route `src/app/api/auth/[...nextauth]/route.ts` already exports the configured handler, so `signIn("google")` from the UI works immediately once credentials exist.
- Wrap additional routes in `getServerSession(authOptions)` to protect dashboards once you connect storage.

## Lists, ratings, and sharing
- All list and rating reads/writes now go through the Rust API (`http://localhost:8080` by default) via the `/api/rust/*` proxy; there is no Next.js/Postgres fallback, so keep the Rust service running and the origin env var set.
- `CreateListButton` (`src/components/create-list-button.tsx`) posts directly to the Rust API `/lists` endpoint. `ImportListForm` (`src/components/import-list-form.tsx`) now sends CSV/text imports to the Rust API `/lists/import` route (sign-in required) and forwards your email so imported ratings are persisted in `user_ratings`. The saved lists render under the hero via `ListGallery` (`src/components/list-gallery.tsx`). List detail pages (`/lists/[slug]`) let you rename or delete a list via `ListEditor`.
- `TmdbSearchBar` (`src/components/tmdb-search-bar.tsx`) powers the prominent home search so users can jump straight into finding films and click through to detail pages using the Rust TMDB proxy.
- Movie detail pages live under `/movies/[id]`, pulling TMDB data server-side through the Rust API; the page now lets you add the film to an existing list or create a new one on the fly.
- Point list reads/writes at the Rust service through the built-in `/api/rust/*` proxy; override with `NEXT_PUBLIC_RUST_API_BASE_URL` only if you want the browser to call the Rust origin directly.


## TMDB-powered list creator
- The Rust API exposes `/tmdb/search` (movie search) and `/tmdb/movie/{tmdbId}` (detail) and trims payloads to the fields the UI needs (title, release year, rating, poster, runtime, genres, tagline).
- The Rust lists API (`/lists`, `/lists/{id}`, `/lists/by-slug/{slug}`, `/lists/{id}/items`) reads/writes the Postgres table defined below via helpers from `src/lib/list-store.ts`.
- Imports are handled by the Rust `/lists/import` route, which parses Letterboxd/IMDb CSV text, looks up TMDB IDs, creates the list, and upserts any personal ratings under your email.
- Provide `TMDB_API_KEY` and `DATABASE_URL` to the Rust API environment. Without them the endpoints respond with HTTP 500.
- Remote poster art is loaded from `image.tmdb.org`; see `next.config.ts` for the configured allowlist.

## Scripts
- `bun run dev` – local development with hot reload.
- `bun run lint` – ESLint with `eslint-config-next`. Run before committing.
- `bun run build` – creates the production bundle; best run in CI with env vars present.
- `bun run start` – serves the built app (used in production).

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
