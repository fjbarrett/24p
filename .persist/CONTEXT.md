# Project Context

## Purpose
24p — a Next.js film tracking web app using Next route handlers and server-only data modules.

## Current State
Active development. Rust service removed from the runtime path; app data now flows through Next `/api/*`, PostgreSQL, and server-side TMDB helpers.

## Structure
```
src/
  app/           # Next.js app router pages and route handlers
  components/    # Client components (buttons, forms, editors, toggles)
  lib/           # Stores, API client, server modules, utilities
public/          # Static assets
```
