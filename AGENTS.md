# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## On Every Conversation Start

`.persist/` is gitignored — it lives only on your local machine and is never committed.

1. Create `.persist/` if it does not exist, then proceed with the steps below.
2. Read `.persist/CONTEXT.md` — current project state. Create from template if missing.
3. Read `.persist/HISTORY.md` — prior agent actions. Create from template if missing.
4. Read `.persist/TODO.md` — outstanding tasks. Create from template if missing.
5. Read `.persist/COMMANDS.md` only if the request involves scripts, commands, or tooling.
6. Read `.persist/PIPELINE.md` only if you need to understand how project files connect or data flows between components.
7. Read `README.md` only if project purpose is unclear from `CONTEXT.md`.
8. Read relevant repo files based on context (skip `venv/`, `__pycache__/`, `.git/`, cache/build dirs).

If `.persist/` content conflicts with what you observe in the current code or repo state, trust what you observe — then update the stale `.persist/` entry.

## After Every Significant Request

- Append to `.persist/HISTORY.md`: `| YYYY-MM-DD | <AgentName> | <one-line description> |`
  - Skip trivial queries or repeated lookups.
  - Always trim to the 20 most recent rows immediately after appending.
- Update `.persist/CONTEXT.md` whenever project structure, purpose, or current state changes. Overwrite stale lines rather than appending.

## When Building Commands or Scripts

Add commands to `.persist/COMMANDS.md` with a short description. Remove entries that are no longer valid.

## When Discussing New Features

Add to `.persist/TODO.md` with enough detail to act on later. Remove completed or abandoned items.

## New File Templates

When creating a `.persist/` file for the first time, initialize with:

- **CONTEXT.md** — `# Project Context` with sections `## Purpose` (one line), `## Current State` (stage), `## Structure` (file tree)
- **HISTORY.md** — `# History` with table header `| Date | Agent | Action |`
- **COMMANDS.md** — `# Commands` with table header `| Command | Description |`
- **TODO.md** — `# TODO` with sections `## Outstanding Tasks` and `## Feature Ideas`
- **PIPELINE.md** — `# Pipeline / Workflow` followed by a description of how project files connect

## Git Workflow

If the project directory contains a `.git` repo:

- Create a new branch before making any code changes. Name branches descriptively: `<type>/<short-description>` (e.g., `feat/add-auth`, `fix/null-pointer`, `refactor/split-pipeline`).
- Commit messages must follow Conventional Commits: `<type>(<scope>): <summary>` with a body explaining _why_, not just _what_.
- One logical change per commit — do not bundle unrelated edits.
- When work is complete, open a pull request and **immediately merge it** — do not leave PRs open or unmerged.
- Do not leave changes on a branch or push directly to main.
- Never force-push, reset --hard, or rewrite history on shared branches without explicit user instruction.

## Token Efficiency

- One line per fact in all `.persist/` files — no filler.
- Edit existing lines rather than appending when information supersedes what's there.
- Do not re-read files already in context unless the file may have changed.
