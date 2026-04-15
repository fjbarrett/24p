import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-static";

export function GET() {
  const base = getAppUrl();

  const body = `# 24p

> 24p is a clean, ad-free film and TV tracking site. It surfaces streaming availability, ratings, and curated lists — with no clutter and no algorithmic noise.

## Key pages

- [Home](${base}/) — landing page and signed-in dashboard
- [Streaming](${base}/streaming) — browse what's available across providers (Netflix, Max, Prime, etc.), sorted by popularity
- [Changelog](${base}/changelog) — product release notes

## Title pages

Each film and TV show has a detail page with:
- Canonical title and release year
- Synopsis, genre, runtime
- Director and top cast (movies)
- IMDb rating and link
- Streaming providers with deep links

Movie page pattern: ${base}/movies/{tmdb_id}
TV show page pattern: ${base}/tv/{tmdb_id}
Artist page pattern: ${base}/artists/{tmdb_id}

## Public lists

Users can create and share watchlists. Public list pages are indexed:
Pattern: ${base}/{username}/{list-slug}

Public list API (JSON): ${base}/api/lists/public

## Search

Search endpoint (JSON): ${base}/api/tmdb/search?q={query}
Returns combined movie, TV, and person results ranked by relevance.

## Notes

- All title pages include JSON-LD structured data (Movie / TVSeries schema)
- Primary facts (title, year, synopsis, providers) are server-rendered
- External IDs (TMDB, IMDb) are present in structured data on every title page
`.trim();

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
