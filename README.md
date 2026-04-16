# 24p

A collaborative movie list app. Search any film, build shareable lists, and rate with half-star precision. Friends can follow your lists and add their own picks.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Auth | NextAuth.js with Google OAuth |
| API | Next.js route handlers + server-only data modules |
| Database | PostgreSQL |
| Movie data | TMDB API |
| Container | Docker + Docker Compose |

## Features

- Google sign-in via OAuth
- Search movies powered by TMDB
- Create, name, and share movie lists
- Half-star ratings (0.5–5.0)
- Import lists from Letterboxd or IMDb CSV exports
- Public profiles with vanity URLs
- List privacy controls (public / private)

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (JavaScript runtime / package manager)
- [PostgreSQL](https://www.postgresql.org) (or run everything via Docker)

### Local development

1. Install dependencies:
   ```bash
   bun install
   ```

2. Copy the env template and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   See [Configuration](#configuration) below for where to obtain each value.

3. Start the Next.js dev server:
   ```bash
   bun run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

### Docker (recommended for full stack)

Runs Next.js and PostgreSQL together:

```bash
cp .env.example .env
docker compose up --build
```

Services:
- Next.js → `http://localhost:3000`
- PostgreSQL → `localhost:5432`

## Configuration

| Variable | Where to get it |
|----------|----------------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — create an OAuth 2.0 Web Client |
| `TMDB_API_KEY` | [TMDB API settings](https://www.themoviedb.org/settings/api) — free account required |
| `DATABASE_URL` | Your PostgreSQL connection string |

For Google OAuth, add these redirect URIs in the Cloud Console:
- `http://localhost:3000/api/auth/callback/google` (development)
- `https://24p-dev.actual.company/api/auth/callback/google` (dev deploy)
- `https://24p.mov/api/auth/callback/google` (production)

## Database setup

Run these once against your PostgreSQL instance:

```sql
CREATE TABLE IF NOT EXISTS lists (
  id          UUID        PRIMARY KEY,
  title       TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  visibility  TEXT        NOT NULL DEFAULT 'public',
  movies      INTEGER[]   NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  color       TEXT,
  user_email  TEXT        NOT NULL,
  username    TEXT
);

CREATE TABLE IF NOT EXISTS user_ratings (
  user_email  TEXT        NOT NULL,
  tmdb_id     INTEGER     NOT NULL,
  rating      INTEGER     NOT NULL,
  source      TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, tmdb_id)
);
```

## Project structure

```
24p/
├── src/
│   ├── app/          # Next.js App Router pages and API routes
│   ├── components/   # React components
│   ├── lib/          # Shared utilities, API clients, stores, server modules
│   └── types/        # TypeScript type definitions
├── public/           # Static assets
├── docker-compose.yml
└── Dockerfile
```

## License

MIT
