# Repository Guidelines

Use this guide to keep early contributions to 24p consistent while the codebase is still being assembled; update it whenever new tooling lands.

## Project Structure & Module Organization
Keep the root lean: runtime code goes under `src/`, grouped by feature (`src/game/`, `src/api/`, `src/lib/`). Tests mirror the same tree under `tests/` with fixtures in `tests/fixtures/`. Static assets or demo content should live in `assets/`, while long-form docs or RFCs belong in `docs/`. Example scaffold:
```
24p/
  src/
    api/
    game/
    lib/
  tests/
    api/
    game/
    fixtures/
  assets/
  docs/
```
Create new top-level folders only when tooling demands it (for example, a `scripts/` directory for release helpers).

## Build, Test, and Development Commands
Once `package.json` is in place, define these scripts:
- `npm install` – hydrate dependencies.
- `npm run dev` – start the hot-reload server (Vite/Next per module).
- `npm run build` – emit the production bundle to `dist/` before every PR.
- `npm run lint` – run ESLint + Prettier; fix before committing.
- `npm run test` – execute Vitest or Jest suites; add `--coverage` for CI.

## Coding Style & Naming Conventions
Adopt TypeScript strict mode, ES modules, and 2-space indentation. Use camelCase for functions, PascalCase for components/classes, and kebab-case for files that export a single component (`game-board.tsx`). Keep modules small; only create `index.ts` barrels for stable public APIs. Run `npm run lint -- --fix` before staging.

## Testing Guidelines
Every module ships with a sibling spec in `tests/<feature>/<file>.spec.ts`. Favor fast Vitest suites; fall back to Playwright for full-stack checks once UI code appears. Add fixtures when touching parsing logic. Target ≥90% statement coverage and call out intentional gaps in PRs.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat: add solver`, `fix: guard null score`) to keep the log searchable. Squash WIP commits locally. Each PR must include a concise summary, linked issue, screenshots or CLI output for behavior changes, and a list of tests executed. Request review once CI is green and rebase over `main` to avoid merge commits.

## Security & Configuration Tips
Never commit `.env` files; provide sanitized keys in `env/.example`. Read secrets from runtime configuration (`process.env`) and mock them in tests. Audit dependencies before adding tooling and document required credentials in `docs/config.md`.
