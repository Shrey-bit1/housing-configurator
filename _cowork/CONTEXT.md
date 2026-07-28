# Repo context for the planning session

## Read this first

You are the planning session. Before writing any prompt, read
`.claude/bridge/PROTOCOL.md` — it holds the numbering rule, the slug rule, the
prompt front-matter schema. There is no mode field and no read-only fallback: what a
run may touch is set in the desktop app at the moment it runs. A prompt that must
leave something alone says so in its own Constraints section.

Prompts go in `_cowork/inbox/`. Reports come back in `_cowork/outbox/`. The running
index is `_cowork/LOG.md`; past prompts are in `_cowork/done/`.

## How I want you to work

**Never write a prompt file without showing it to me first.** When I ask you to
queue something, draft the full prompt — front matter and all — and show it in the
chat. Then stop and wait. I will either edit it or tell you to send it. Only when I
say send do you write the file into `_cowork/inbox/`.

Writing straight to the inbox is the one thing that would break this workflow: I run
these against my thesis repo, and I want to read a prompt before it exists as a
queued instruction.

When I say send, write the file and confirm with one line: the path and the id.
Nothing else.

**Absolute path:** recorded in `_cowork/CONTEXT.local.md`, which git ignores, so a fresh clone has to write that file by hand.
**Branch:** `main`
**Last updated:** 2026-07-28

## What this project is

A browser-based 3D flat configurator, built with TypeScript + three.js and bundled
with Vite. The user places modular rooms, furniture and stairs on a 0.6 m grid
across multiple floors, authors entrances and interior doors, and gets an advisory
layout-rules check plus a bubble diagram of room adjacency. It is a thesis
instrument, not a product: it exists to author single dwellings that a second repo
then aggregates into buildings. Work in progress and openly messy in places — the
rules engine and the export format are the mature parts, the UI is not.

## Layout

- `src/core/` — the model and all logic, no three.js: grid and occupancy, room-type
  presets, floors, doors, entrances, the adjacency graph, the rules engine, window
  generation, save/load, and the flat export.
- `src/scene/` — three.js geometry builders: room shells, walls and glazing, stairs,
  door and entrance markers, the camera-aware cutaway, voxel furniture.
- `src/interaction/` — pointer and keyboard controllers: palette drag-drop,
  selection and group ops, door and entrance placement, raycast picking.
- `src/ui/` — DOM panels: palette, validation report, bubble diagram, compass dial,
  toasts.
- `docs/` — the flat→building JSON spec, the rules reference (HTML plus a generated
  PDF), and the analysis behind the two-repo split.
- `dist/`, `node_modules/` — build output and dependencies, both gitignored.
- `.claude/` — dev-server launch configs, and this bridge. **Gitignored** (see
  Non-obvious things).
- `_cowork/` — the bridge traffic. Tracked in git on purpose.

## Entry points

- `index.html` — the page itself; the app is a single canvas plus DOM panels.
- `src/main.ts` — wires the whole app together. Start here to trace anything.
- `PROJECT_STATE.md` — the real orientation document, ~2500 lines, section-numbered
  and kept current. Far more accurate than the README. Read this before assuming
  anything about how a system works.
- `README.md` — feature overview and the full layout-rules tables.
- `src/core/rules.ts` — every layout rule, as data in a `RULES` array.
- `docs/bridge-format.md` — the `dwelling-unit` JSON contract with the other repo.

## How to work with it

- `npm run dev` starts Vite on port 5173. `npm run build` runs `tsc && vite build`.
- **Node is not on PATH** in shells spawned by tooling. It lives at
  `C:\Program Files\nodejs` and has to be prepended before `npm` will resolve.
  `.claude/dev.cmd` exists purely to work around this.
- **There is no test suite.** None. Verification means: `tsc` clean, `npm run build`
  clean, and driving the app in a real browser and looking at it. A prompt that says
  "add a test for X" has no harness to add it to — ask for a runnable check or a
  browser verification instead, and expect the answer to come back as screenshots.
- Python is needed for exactly one thing: `docs/build-pdf.py`, which regenerates the
  rules PDF when `rules.ts` changes.
- `CLAUDE.md` requires that `PROJECT_STATE.md` be updated before any feature is
  reported as done. Assume that is part of the cost of every prompt.

## Non-obvious things

1. **This is one of two repos, and you can only reach this one.** This repo authors
   a *single flat*. A separate repo, `bottom-up-design`, packs many flats into a
   *building* — that is where massing, aggregation, evolution and section drawings
   live. The two share no code at all, only a JSON file described in
   `docs/bridge-format.md`. A prompt about buildings, facades at building scale,
   packing or section cuts cannot be run here, and will come back blocked.

2. **"Derive, don't store" is a hard architectural rule.** Cluster shells, stair
   holes, the adjacency graph, generated windows and wall heights are all recomputed
   from placement data on every change and are never serialized. A prompt that asks
   to cache, persist or hand-edit any of them contradicts a standing convention in
   `CLAUDE.md` and will be pushed back on.

3. **`.claude/` is mostly gitignored, but the bridge is deliberately exempt.** A
   pre-existing rule ignores `.claude/` wholesale; four negation rules at
   `.gitignore:28-31` carve `.claude/bridge/` and `.claude/skills/` back out, so the
   protocol and the three skills are versioned alongside the records they produce.
   Everything else directly under `.claude/` — `settings.local.json`, `launch.json` —
   stays ignored as machine-local.

4. **Three.js is Y-up, so the plan is the X/Z plane, not X/Y.** `CELL_SIZE` is
   0.6 m, floor height is derived rather than configured, and rooms are hollow
   shells (floor plate plus perimeter walls) rather than solids. Prompts written
   with an X/Y plan in mind read as correct and are subtly wrong throughout.
