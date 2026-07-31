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
**Branch:** the working tree is CHECKED OUT ON `reskin-1a` (tip `b6e3bd4`,
eleven commits ahead of `main`), which run 0017 left deliberately so a reload
shows the finished reskin. That branch carries the whole of the "Paper studio"
chrome reskin: the tokens, top bar, palette and overlays from run 0016, then the
layout-check bottom sheet, the Must fix / Worth a look / Note copy, themed
scrollbars and the removal of the viewport hint line from run 0017. `main` (tip
after this record) is demo-ready and contains none of it. Whether it merges is
Shrey's call after the 4 August review; if it is dropped, PROJECT_STATE's §2s
goes with it. A run that needs the pre-reskin app must check out `main` first.
**Last updated:** 2026-07-31

## What this project is

A browser-based 3D flat configurator, built with TypeScript + three.js and bundled
with Vite. The user places modular rooms, furniture and stairs on a 0.6 m grid
across multiple floors, authors entrances and interior doors, and gets an advisory
layout-rules check plus a bubble diagram of room adjacency. It is a thesis
instrument, not a product: it exists to author single dwellings that a second repo
then aggregates into buildings. Work in progress and openly messy in places — the
rules engine and the export format are the mature parts, the UI is not.

## Layout

- `src/core/` — the model and all logic: grid and occupancy, room-type presets,
  floors, doors, entrances, the adjacency graph, the rules engine, window generation,
  save/load, and the flat export. It does import three.js; see Non-obvious things.
- `src/scene/` — three.js geometry builders: room shells, walls and glazing, stairs,
  door and entrance markers, the camera-aware cutaway, voxel furniture.
- `src/interaction/` — pointer and keyboard controllers: palette drag-drop,
  selection and group ops, door and entrance placement, raycast picking.
- `src/ui/` — DOM panels: palette, validation report, bubble diagram, compass dial,
  toasts.
- `docs/` — the flat→building JSON spec, the rules reference (HTML only since run
  0013), and the analysis behind the two-repo split. The built PDFs were removed from
  the repo in commit 6d214ad and live on the Drive; `docs/build-pdf.py` regenerates
  them from the HTML on demand and `.gitignore` now keeps them from coming back.
- `dist/`, `node_modules/` — build output and dependencies, both gitignored.
- `.claude/` — dev-server launch configs, and this bridge. **Gitignored** (see
  Non-obvious things).
- `testflats/` — three example project files (`flat-configurator-project` v1) added in
  run 0009: `flat-1-two-storey.json` (2 floors, a corridor against a balcony on the
  upper one), `flat-2-single-storey.json`, `flat-3-terrace.json`. Open one with IMPORT
  to get a finished layout instead of an empty grid. In DEV, `?project=<name>` loads one
  straight from the URL (a bare name resolves against `testflats/`), so a run can set up
  any layout it wants without a human. Run 0009 reported the opposite; the cause was
  `importProjectText`'s unconditional `window.confirm`, which run 0010 made conditional
  on there being something to replace.
- `captures/` — rendered PNGs of views, written by the app itself through the dev
  server (see How to work with it). New in run 0013 and untracked, so it never shows
  up in a clone; the first capture creates it.
- `design/` — the Re_Configure design system as standalone HTML pages (tokens,
  motion, buttons, toggles, palette, toast, validation, and the interface-dissolve
  moment). `.design-sync/` beside it holds the config and conventions the sync runs
  against. Both are SOURCE and both are committed; `ds-bundle/` is generated from
  them and is gitignored. Added by A0001, committed in run 0015. This is where the
  values in `src/style.css`'s new `--ink` / `--dur-*` / `--ease-*` tokens come from.
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
- **There are TWO test suites as of run 0014.** `npm test` is the fast one, about
  0.9 s over 33 cases in three files: `src/core/exteriorEdges.test.ts` (five cases over
  `isFacadeEdge`), `src/core/unitExport.test.ts` (three pure cases over the export
  glazing invariant, whose header explains that it deliberately does not call
  `buildUnitExport`), and `src/core/rules.test.ts` (25 cases, one firing and one silent
  fixture for each of eleven rules, over HAND-BUILT `DwellingGraph` objects). `npm run
  test:slow` is the second, about 5.5 s, holding anything named `*.slow.test.ts` — today
  one file that drives a real `FloorManager` through a stubbed `FloorDeps` and calls the
  real `buildUnitExport`. The split exists because that import graph pulls in three.js;
  it is written in exactly two places, `test.exclude` in `vite.config.ts` and `include`
  in `vitest.slow.config.ts`.
- **`npm run test:slow` currently reports `4 passed | 1 expected fail`, and the
  expected fail is deliberate.** French-window edges are built but never exported
  (`unitExport.ts:311` enumerates the envelope with the strict open-sky test, which
  skips edges whose neighbour cell is occupied, and a balcony cell is occupied). It is
  recorded as an `it.fails` case so the suite stays green and turns RED the day someone
  fixes the export. Do not "fix" the red by deleting the test. Everything else is still verified the old way: `tsc`
  clean, `npm run build` clean, and driving the app in a real browser. Since run 0010 the
  Check Layout panel is fully scriptable: write a fixture into `testflats/`, open
  `?project=<name>`, and read `#validation-panel` from the DOM. That works even with the
  Browser pane hidden, because the panel is DOM rather than pixels.
- **Geometry is scriptable too, since run 0013.** In DEV the app exposes
  `window.__app` with the floor manager, camera, scene, controls, renderer, the
  plan-mode entry points, and `capture(name)`, which renders one frame and POSTs the
  canvas to `/__capture?name=…`; the `capture-sink` plugin in `vite.config.ts` writes it
  under `captures/`. So a check can read a mesh's real dimensions rather than describe a
  screenshot, and can leave a rendered plan behind as a file. Both are behind
  `import.meta.env.DEV` and `apply: "serve"`, so neither ships.
- **Check that a capture is not 0 bytes before trusting it.**
  `window.__app.capture(name)` returns `{ok: true}` and creates the file even when
  the Browser pane is HIDDEN, but the PNG is empty, because `canvas.toDataURL()`
  gives nothing back when the page is not compositing. With the pane visible the
  same call wrote 33445 bytes. Note also that a capture records the WebGL canvas
  ONLY: DOM overlays such as the drag chip and the validity label never appear in
  one, and need the pane's own screenshot instead.
- **Restart the dev server at the start of a session.** Run 0013 found one that had
  been running for four hours and was serving a transform of `src/scene/clusterShells.ts`
  from before run 0011 edited it, which threw on every page load while the source in the
  repo was fine. A long-lived server is not a trustworthy one; `rm -rf node_modules/.vite`
  clears the cache if a restart alone does not.
- Python is needed for exactly one thing: `docs/build-pdf.py`, which regenerates the
  rules PDF when `rules.ts` changes.
- `CLAUDE.md` requires that `PROJECT_STATE.md` be updated before any feature is
  reported as done. Assume that is part of the cost of every prompt.

## Non-obvious things

0. **`src/core/` DOES import three.js**, despite what an earlier version of this file
   said. `src/core/grid.ts:1` is `import * as THREE from "three"`, and `src/core/floor.ts`
   additionally imports from `../scene/`. The separation is about responsibility rather
   than about dependencies: `core/` owns the model and the logic, `scene/` owns the
   geometry builders. It matters when writing a headless test, because constructing a
   `Floor` pulls the render layer in, while the pure predicates and `Grid` are fine
   under Node.

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
