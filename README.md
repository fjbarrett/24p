# 24p

A film tracking app for building and sharing movie and TV lists. Search any title, organize your watchlists, rate what you've seen, and discover what's streaming.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Auth | NextAuth.js with Google OAuth |
| API | Next.js route handlers + server-only data modules |
| Database | PostgreSQL |
| Film data | TMDB API |
| Streaming data | JustWatch |
| Container | Docker + Docker Compose |

## Features

### Lists & library
- Create named, colored lists with public or private visibility
- Add movies and TV shows from search
- Reorder items, move between lists, bulk manage
- Import lists from Letterboxd or IMDb CSV exports
- Share public lists via vanity URL (`/@username/list-slug`)

### Discovery
- Search movies, TV shows, and people with live TMDB results
- Browse person filmographies
- Streaming catalog: filter by provider, sort by popularity or rating
- Personalized recommendations based on your lists and favorites

### Ratings
- Half-star ratings (0.5–5.0) on any title
- Aggregate community ratings alongside TMDB scores

### Profiles
- Public profile pages with vanity URLs (`/@username`)
- Profile visibility toggle (public / private)
- Customizable username

### Other
- Cast credits with linked filmographies on movie detail pages
- Watch provider links (streaming, rent, buy) powered by JustWatch
- Trailer playback
- In-app changelog

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

### Docker

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
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) — powers per-list recommendations |

For Google OAuth, add these redirect URIs in the Cloud Console:
- `http://localhost:3000/api/auth/callback/google` (development)
- `https://24p.mov/api/auth/callback/google` (production)

## Project structure

```
24p/
├── src/
│   ├── app/          # Next.js App Router pages and API routes
│   ├── components/   # React components
│   ├── lib/          # Shared utilities, API clients, stores, server modules
│   └── types/        # TypeScript type definitions
├── apple-tv/         # tvOS SwiftUI client (in development)
├── migrations/       # SQL migration files
├── scripts/server/   # Server bootstrap helpers
├── public/           # Static assets
├── docker-compose.yml
└── Dockerfile
```

## License

MIT
