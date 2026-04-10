# History

| Date | Agent | Action |
|------|-------|--------|
| 2026-04-04 | Codex | Replaced list-card accent lines with poster mosaics and moved owner edit into a lighter icon-triggered dialog |
| 2026-04-05 | Codex | Show ✓ instead of + on AddToListButton when the movie is already in any of the user's lists |
| 2026-04-05 | Codex | Deduplicated watch-button destinations and show Amazon branding for Amazon-bound links |
| 2026-04-05 | Codex | Expanded watch providers to fill the action row and fade out AddToList while open |
| 2026-04-05 | Codex | Reverted watch-row takeover and restored the working side-by-side action layout |
| 2026-04-05 | Codex | Hid the public-list back button for signed-out viewers so direct links no longer dead-end |
| 2026-04-05 | Codex | Added outside-tap search dismissal and tightened watch/list-detail export UI behavior |
| 2026-04-05 | Codex | Added an explicit search clear button and made empty create-list close on second X press |
| 2026-04-05 | Codex | Audited the VirtualBox deployment path and confirmed the VM bootstrap expects the same Docker env-driven app stack as other deploys |
| 2026-04-05 | Codex | Synced prod env to the VBox host, repointed its app URLs to 24p-dev.actual.company, and installed cloudflared |
| 2026-04-05 | Codex | Audited 24p-dev.actual.company, merged header/no-index hardening, and flagged that the dev VM image needs a fresh deploy to reflect current repo behavior |
| 2026-04-09 | Claude | Added /recommendations page with content-based film suggestions from user lists (PR #47) |
| 2026-04-09 | Claude | Added per-list suggestions panel with one-tap add + Claude Haiku-backed recommendations (PR #48) |
| 2026-04-09 | Codex | Added a signed-in /streaming discovery page backed by JustWatch provider-filtered popular titles |
| 2026-04-10 | Claude | Fixed JSX parse errors in movies/[id]/page.tsx and movie-trailer-toggle.tsx |
| 2026-04-10 | Claude | Overhauled /streaming: poster-only grid, vignette+gradient, IMDb rating, provider icon, centered filter row |
| 2026-04-10 | Claude | Researched TV show support path: streaming catalog → search → lists (not yet started) |
