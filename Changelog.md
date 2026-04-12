# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Added Next route handlers and server-side Postgres/TMDB modules so the app no longer depends on a separate Rust service at runtime.
- Added a `apple-tv/` tvOS SwiftUI client for browsing public lists, searching titles, and viewing provider-backed detail pages against the existing 24p API.
- Added a public `/changelog` page plus a signed-in home footer link so users can see recent product updates in-app.
### Changed
- Unified app action buttons and button-style links to use the sign-out button's white background and black text styling.
- Refined movie and list detail views with clearer action placement, stronger section alignment, and more consistent control sizing.
- Softened the Movie Detail Apple TV button reveal with a reserved slot and bubble-in transition to avoid layout jumps during async load.
- Simplified the homepage, strengthened the create-list modal backdrop, and refreshed wireframes to match current home, list, and movie detail views.
- Centered the home and list detail layouts, converted list creation to an inline expanding pill, and streamlined list detail controls and export actions.
- Replaced list-card accent lines with poster mosaics and refined the list detail edit affordance into a lighter icon plus dialog flow.
- Collapsed the backend architecture into the Next app, updated deployment/docs accordingly, and restored IMDb rating enrichment through the server TMDB helper.
- Tightened detail-view alignment, improved list edit dialog behavior on mobile, and adjusted homepage/list-detail presentation polish.
- Hardened site-wide response headers and kept no-index environments from publishing sitemap entries.
- Reworked streaming discovery to persist selected providers/sort locally, simplify the homepage entry point, and normalize JustWatch deep-link handling across movie and TV watch surfaces.
- Updated the documented dev hostname to `https://24p.actual.company` and aligned project notes and PR guidance with the current prod/dev domain split.
- Added a user-friendly release timeline that explains recent additions, changes, and removals in product language instead of repo-only notes.
### Fixed
- Swapped middleware nonce generation to an Edge-safe Web Crypto path so deployed hosts no longer crash on every request.
- Fixed watch-provider deep links for TV titles, restored working Pluto TV and Tubi outbound links, and limited Plex links to free/watchable offers instead of rent-only listings.
- Upgraded Next.js to 16.2.3, pinned patched `preact` 10.29.1, escaped JSON-LD on movie/TV detail pages, added TMDB/Strawberry fetch timeouts, and returned persisted `updatedAt` values from `/api/ratings`.

## [0.1.0] - YYYY-MM-DD
### Added
- Initial release.
