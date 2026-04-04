# agent-starter

Drop-in configuration for CLI AI agent sessions. Gives agents structured persistent files for history, context, commands, and tasks — loaded automatically at session start.

## Approach

- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## File Storage

All markdown files created or maintained by agents (e.g. `CONTEXT.md`, `HISTORY.md`, `PIPELINE.md`, `COMMANDS.md`, `TODO.md`) must be stored in the `.persist/` directory at the project root. Always use the `.persist/` prefix. Create `.persist/` if it does not exist.

## On Every Conversation Start

Before responding to the user:

1. Create `.persist/` if it does not exist.
2. Read `.persist/CONTEXT.md` — current project state. Create from template if missing (see **New File Templates**).
3. Read `.persist/HISTORY.md` — prior agent actions. Create from template if missing.
4. Read `.persist/TODO.md` — outstanding tasks. Create from template if missing.
5. Read `.persist/COMMANDS.md` only if the request involves scripts, commands, or tooling. Create from template if missing.
6. Read `.persist/PIPELINE.md` only if you need to understand file relationships or workflow. Create from template if missing.
7. Read `README.md` only if project purpose is unclear from CONTEXT.md.
8. Read relevant repo files based on context above (skip `venv/`, `__pycache__/`, `.git/`, and cache/build directories).

## After Every Significant Request

After completing any request that meaningfully changes the project:

- Append a row to `.persist/HISTORY.md` in this format: `| YYYY-MM-DD | <AgentName> | <one-line description> |`
  Only log significant actions — skip trivial queries or repeated lookups. **Trim to the 20 most recent rows** after appending.
- Update `.persist/CONTEXT.md` only if project structure or purpose changed. Overwrite stale lines rather than appending.

## When Building Commands or Scripts

Add useful commands, flags, or invocations to `.persist/COMMANDS.md` with a short description. Remove entries that are no longer valid.

## When Discussing New Features

Add new feature ideas or plans to `.persist/TODO.md` with enough detail to act on later. Remove completed or abandoned items.

## New File Templates

When creating a `.persist/` file for the first time, initialize it with the following structure:

**CONTEXT.md** — `# Project Context` with sections `## Purpose` (one line), `## Current State` (stage), `## Structure` (file tree)

**HISTORY.md** — `# History` with table header `| Date | Agent | Action |`

**COMMANDS.md** — `# Commands` with table header `| Command | Description |`

**TODO.md** — `# TODO` with sections `## Outstanding Tasks` and `## Feature Ideas`

**PIPELINE.md** — `# Pipeline / Workflow` followed by a description of how project files connect

## Token Efficiency

- Write entries in all `.persist/` files as tightly as possible — one line per fact, no filler.
- Do not re-read files already in context.
- Prefer editing existing lines in `.persist/` files over appending new ones when the information supersedes what's already there.
