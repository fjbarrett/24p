# History

| Date | Agent | Action |
|------|-------|--------|
| 2026-04-09 | Claude | Added /recommendations page with content-based film suggestions from user lists (PR #47) |
| 2026-04-09 | Claude | Added per-list suggestions panel with one-tap add + Claude Haiku-backed recommendations (PR #48) |
| 2026-04-09 | Codex | Added a signed-in /streaming discovery page backed by JustWatch provider-filtered popular titles |
| 2026-04-10 | Claude | Fixed JSX parse errors in movies/[id]/page.tsx and movie-trailer-toggle.tsx |
| 2026-04-10 | Claude | Overhauled /streaming: poster-only grid, vignette+gradient, IMDb rating, provider icon, centered filter row |
| 2026-04-10 | Claude | Researched TV show support path: streaming catalog → search → lists (not yet started) |
| 2026-04-10 | Codex | Fixed TV watch-provider direct links so show pages like House resolve Hulu/Prime URLs instead of TMDB fallback pages |
| 2026-04-10 | Codex | Fixed Prime Video watch links by matching JustWatch direct URLs to TMDb providers via normalized provider names instead of mismatched IDs |
| 2026-04-10 | Codex | Renamed the /streaming page title and heading from "Streaming in 24p" to "Streaming" |
| 2026-04-10 | Codex | Re-centered the signed-out homepage content so the landing layout sits mid-screen again |
| 2026-04-10 | Codex | Kept the signed-out Google button pinned top-right while centering the homepage content block |
| 2026-04-10 | Codex | Nudged the signed-out homepage content slightly upward while keeping the Google button fixed |
| 2026-04-10 | Codex | Restyled the homepage Streaming On CTA to read like a text link instead of a pill button |
| 2026-04-10 | Codex | Saved /streaming selections in local storage and normalized JustWatch offers so Plex only shows free links while Pluto/Tubi keep working |
| 2026-04-10 | Codex | Removed JustWatch fallback links from title detail watch rows and forced movie/TV titles to render white |
| 2026-04-10 | Claude | Added persistent global sticky header with search bar + back/brand on all pages except home; merged PRs #47-51 to main |
| 2026-04-10 | Claude | Dismissed search results panel on route change via usePathname |
| 2026-04-10 | Claude | Built tvOS SwiftUI app in apple-tv/ — Home (public lists), Search, Detail (providers), ListDetail |
| 2026-04-11 | Codex | Assessed monetization paths and recorded affiliate, freemium, sponsorship, and B2B options in TODO |
| 2026-04-11 | Codex | Updated repo-owned domain references for prod `24p.mov` and dev `24p.actual.company` and documented required secret changes |
| 2026-04-11 | Codex | Ran a security/reliability audit: upgraded Next, pinned patched preact, escaped JSON-LD, added TMDB timeouts, and fixed ratings timestamps |
| 2026-04-11 | Codex | Finalized the pending tvOS + runtime hardening changes for commit, push, and merge |
