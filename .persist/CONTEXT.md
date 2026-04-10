# Project Context

## Purpose
24p — a Next.js film tracking web app using Next route handlers and server-only data modules.

## Current State
Active development. Rust service removed from the runtime path; app data now flows through Next `/api/*`, PostgreSQL, and server-side TMDB helpers.
Signed-in users now have a `/streaming` page that surfaces popularity-sorted JustWatch catalog titles, supports provider filtering, and links back into TMDB movie detail pages.
Docker Compose is the server runtime path; `scripts/server/bootstrap-vbox.sh` prepares a VBox Ubuntu host but does not deploy app config or secrets by itself.
`24p-dev.actual.company` is routed to the VBox host through Cloudflare Tunnel; the VM env now points at that hostname, but the running GHCR image appears older than the current repo and should be redeployed to pick up recent runtime/header behavior.

## Structure
```
src/
  app/           # Next.js app router pages and route handlers, including /recommendations and /streaming
  components/    # Client components (buttons, forms, editors, toggles, discovery controls)
  lib/           # Stores, API client, server modules, utilities, JustWatch/TMDB helpers
public/          # Static assets
scripts/server/  # VBox bootstrap and GitHub runner install helpers
```
