# Project Context

## Purpose
24p — a Next.js film tracking web app using Next route handlers and server-only data modules.

## Current State
Active development. Rust service removed from the runtime path; app data now flows through Next `/api/*`, PostgreSQL, and server-side TMDB helpers.
Signed-in users now have a `/streaming` page that surfaces popularity-sorted JustWatch catalog titles, supports provider filtering, and links back into TMDB movie detail pages.
Watch-provider action rows now pass `mediaType` through the JustWatch direct-link lookup so TV pages can resolve provider-specific outbound URLs instead of falling back to TMDB's generic watch page.
`apple-tv/` now contains a tvOS SwiftUI client that consumes the public list, TMDB search/detail, and watch-provider APIs from the main Next app.
Users can now visit a public `/changelog` page from the signed-in home footer to read product-facing summaries of recent additions, changes, and removals.
Docker Compose is the server runtime path; `scripts/server/bootstrap-vbox.sh` prepares a VBox Ubuntu host but does not deploy app config or secrets by itself.
Production should resolve at `24p.mov`; the dev environment should resolve at `24p-dev.actual.company`, and the VBox workflow still depends on `VBOX_*` GitHub secrets to supply those hostnames at deploy time.
Security/reliability hardening on 2026-04-11 upgraded Next.js to 16.2.3, forced patched transitive `preact` 10.29.1 via npm override, escaped JSON-LD output on movie/TV detail pages, added TMDB fetch timeouts, and made `/api/ratings` return DB-backed `updatedAt` timestamps.

## Structure
```
src/
  app/           # Next.js app router pages and route handlers, including /recommendations and /streaming
  components/    # Client components (buttons, forms, editors, toggles, discovery controls)
  lib/           # Stores, API client, server modules, utilities, JustWatch/TMDB helpers
public/          # Static assets
apple-tv/        # tvOS SwiftUI client scaffold that talks to the Next.js API
scripts/server/  # VBox bootstrap and GitHub runner install helpers
```
