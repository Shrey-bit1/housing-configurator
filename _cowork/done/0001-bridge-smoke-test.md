---
id: "0001"
title: Bridge smoke test
created: 2026-07-28
---

## Context

First run of the Cowork bridge. This prompt touches no project code — it exists to
prove the loop works end to end and to give the planning session its first picture
of this repo.

## Task

1. Report the repo root path and the current git branch.
2. List the top-level directories, with one line each on what they hold.
3. Name the entry points — the files someone would run or open first to understand
   what this project does.
4. Confirm `CLAUDE.md` contains a `## Cowork bridge` section, and that
   `.gitignore` ignores `_cowork/CONTEXT.md` and nothing else under `_cowork/`.
   Also report whether `.claude/bridge/` and `.claude/skills/` are tracked by git.

## Constraints

- Read-only. Do not modify, create, or delete anything outside `_cowork/`.
- Do not attempt to install anything or run the project.

## What I need back

1. The directory listing and the entry points.
2. Whether the bridge wiring is fully in place, or what's missing.
3. The three things about this repo's structure that would be least obvious to a
   planning session that cannot see it — the things I'd otherwise get wrong when
   writing prompts.
