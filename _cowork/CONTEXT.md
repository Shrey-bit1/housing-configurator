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
**Branch:** the working tree is on `main`, and everything is merged. Runs 0018,
0019, 0020 and 0021 were each built on their own `run/NNNN` branch and merged
into `main`; every branch record still exists on the remote with all of its
commits already in `main`'s history. `main` holds
both the "Paper studio" reskin from runs 0016/0017 (paper ground and ink
rules, a 52px top bar with a MODEL / PLAN / DIAGRAM segmented control, a
resizable PLACE / FLOORS / BRIEF palette, three viewport overlay clusters,
the layout check as a 256px bottom sheet — PROJECT_STATE §2s) and run 0018's
unit library: `public/units/` (dwelling-unit JSON + JPEG preview per unit
under a validated `index.json` manifest), `src/library/` (self-contained
browser module + manifest/id logic, documented in `docs/library-format.md`),
a Units top-bar button, and a Save to library action in the export dialog
backed by a dev-only Vite endpoint. PROJECT_STATE §10 describes it.

Run 0019 (on `run/0019`) then collapsed saving into ONE dialog. Save / Open
now holds just `Save…` and `Open project`; the separate Export project, Export
unit and Save to library actions are gone. The dialog takes a DESIGN NUMBER
and three checkboxes, writing `Flat n` (project file), `Unit n` (unit file)
and the library entry in any combination, reporting one result line per output
inside itself. Names follow Shrey's convention, a capitalised word and a
number, one number per design across both kinds, and the dialog opens on the
next free number read from the library manifest. Library entries can now be
replaced instead of silently duplicated, and renamed from their card.
PROJECT_STATE §11 describes it.

Run 0020 replaced the stairs and added bathrooms. The old 0.6 m-wide stair is
retired from the palette, kept in `MODULE_DEFS` so pre-0020 files still load.
Five palette entries now: straight 2×8, dogleg 3×6 (the default, 1.8 m tight),
dogleg generous 4×6, spiral 4×4, C of three flights 4×6. All proportions derive
from the storey height in `src/core/stairSpec.ts` (pure, tested), at riser
target 170 mm and tread 270 mm, and stairs are BUILT at the floor's true height
rather than scaled; each flight is a raking slab with a soffit. Three new wet
rooms: `wc` 2×3, `bathroom_full` 4×4, `bathroom_full_compact` 3×4. An inactive
floor renders TRANSLUCENT rather than flat grey, its furniture is hidden, and
the shadow-catcher ground plane no longer writes depth, which was making lower
storeys blink out as the camera orbited. PROJECT_STATE §2a and §2t.
**The storey height is derived, not configured**: (tallest room, min 4 cells,
+ 1 clearance cell) × 0.6 m, so 3.0 m by default.

Run 0021 added DOUBLE-HEIGHT ROOMS. A placed room can be marked to take the
volume of the storey above its own footprint: the mark lives on the room below,
the footprint becomes a hole on the floor above through the same
`FloorManager.voidCells` list stairwells use, the walls rise through both
storeys, marking CREATES the storey above when there is none, and it is REFUSED
with the obstructing cells named when something is already up there. The
derived storey height is deliberately unchanged. The control is a tool in
Structure & Access beside Entrance and Doorway. It crosses the bridge as
`storeys[i].openCeilings`, a per-cell list of the seams that carry no floor,
additive and still v1 (`docs/bridge-format.md`). PROJECT_STATE §2u. A sample
export for the building repo is committed at
`_cowork/outbox/0021-double-height-unit.json`.

**The Netlify site is `reconfigure-flat`**, so
a branch deploy is `https://run-NNNN--reconfigure-flat.netlify.app`; it is
password-protected, so an unauthenticated check gets 401 rather than 200, and
404 means the build has not finished.
Run 0022 built THE SESSION STORE and nothing visible: a Netlify Function at
`netlify/functions/session.mts` whose whole handler is `src/session/store.ts`,
routed under `/api/session/{code}` (whole session as summaries, one flat
verbatim, publish a flat, a resident's counts/share/ballot with partial merge,
the last building run whose write clears `changed`), backed by Netlify Blobs
(store `sessions`, one index blob per session plus one blob per flat, index
writes under the blob's ETag). `@netlify/blobs` is the one new dependency;
`tsconfig.json` now includes `netlify/`. `scripts/store-roundtrip.mjs
<base-url>` proves it from the shell (22 checks) and passed against `npx
netlify dev --port 8888`. `docs/store.md` is the contract. PROJECT_STATE §12.
**The deployed store is unreachable while the site password is on**: the
`reconfigure-flat` gate answers 401 to `/api/session/*` and even to an OPTIONS
preflight, so run 0023 and the building side cannot call it until that changes.

Run 0023 CONNECTED THE APP TO THE STORE. The save dialog has two fields at the
top, resident name and session code (localStorage key `reconfigure.session`,
`?session=room-42` in the URL wins and is stored, codes lowercased), a top-bar
line shows the session, and a fourth checkbox, Publish to session, PUTs the
unit download's exact bytes to `/api/session/<code>/flats/unit-<n>` on the same
origin and reports "Published as Unit 6 to room-42, version 2". A failed
publish never cancels a file. The Units panel lists the session's flats in a
group ABOVE the library (resident, version, storeys, area, a changed mark),
each openable as a copy. `GET /api/session/<code>/export` returns the state
plus every flat body as a string. **The site password is off since 2 September
2026** and the deployed round trip passes 26/26. PROJECT_STATE §10, §11, §12.
Dev needs `netlify dev` (port 8888) for the store; plain `vite` has no function.

Run 0024 fixed the DESIGN NUMBER for a room and gave every flat ONE PICTURE.
With a session set, the save dialog proposes the lowest number free in BOTH
the library manifest and the session's own flats (nextFreeNumber now takes
any number of lists), so two residents in the same room are no longer both
offered the same number. Publishing over a flat another resident owns now
answers 409 with their name; the dialog shows it on the Session result line
and offers a Replace checkbox, off by default, that sends ?replace=1. Every
flat, published or saved to the library, gets the SAME axonometric
(captureFlatPreview in main.ts, framed by the pure axoFrame in
src/core/previewFrame.ts): every floor visible and un-dimmed, cutaway and
the view overlays off, a fixed 800x600, camera and view state restored
exactly after. GET/PUT /api/session/{code}/flats/{id}/preview carries the
JPEG; a flat's summary gains preview: true. The picture travels as a
SIBLING of the flat's own storage key, never a child of it — the first key
shape hung every write under netlify dev, since Netlify Blobs' local
sandbox maps keys onto a real filesystem path and the flat's key was
already a file where the child shape needed it to be a directory. All
seven committed library JPEGs were re-rendered through the same function.
PROJECT_STATE §10, §11, §12.

Run 0025 answered whose flat is whose and made a takeover ask first. Every
session card shows its owner on its own line, at normal card size; a match
with the save dialog's own name gets a filled Yours badge and a heavier
border, and the group sorts that resident's own flats first (isMine,
sortMineFirst, pure, in src/library/unitBrowser.ts, since the project has
no DOM test environment to exercise the module's DOM-building code).
Replace no longer sends replace=1 on the first attempt: only a 409 with
Replace ticked raises a confirm naming the current owner
(takeoverConfirmText), and decideTakeover (session.ts) turns the answer
into a retry, a skipped result line, or no change, pulled out pure so the
decision is testable without driving window.confirm. A small UX pass
against _cowork/ux-guidelines.md folded the session fields into one line
once both are set, grouped the five checkboxes as Files and Session, and
added a next-step hint to a successful publish's result line; one CSS bug
(a `display` rule tying and beating the default `[hidden]` rule) was found
and fixed in the process. PROJECT_STATE §10, §11.

**Last updated:** 2026-09-03

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
- `netlify/functions/` — the one Netlify Function, `session.mts`, the entry of
  the session store (run 0022). Netlify finds the folder by default; there is
  still no `netlify.toml`. `.netlify/` (created by `netlify dev`) is gitignored.
- `scripts/` — shell-run scripts, so far only `store-roundtrip.mjs`, which
  drives the session store against a base URL and exits 1 on any failed check.
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
- **Node is on PATH on the current machine** (macOS, `/usr/local/bin/node`,
  v24.19.0 as of run 0019) and `npm`/`npx` resolve without help. The earlier
  note here described a Windows machine where node lived at
  `C:\Program Files\nodejs` and had to be prepended, which `.claude/dev.cmd`
  worked around; that is history unless the repo moves back to that machine.
- **There are TWO test suites as of run 0014.** `npm test` is the fast one, under
  a second over 190 cases in fourteen files as of run 0025 (177 in thirteen as
  of run 0024, plus 7 in session.test.ts for takeoverConfirmText and
  decideTakeover, and the new unitBrowser.test.ts at 6, isMine/sortMineFirst
  only; 153 in twelve as of run 0023, plus 4 in naming.test.ts for a second
  list, 9 in store.test.ts for the ownership refusal and the preview round
  trip, 6 in session.test.ts for ownerResident and publishPreview, and the
  new previewFrame.test.ts at 5;
  134 in eleven as of run 0022, plus `src/session/session.test.ts` 15, the
  session settings and the publish call; 126 in ten as of run 0021, plus
  `src/session/store.test.ts` 9, the session store through an in-memory KV)
  (84 in eight before run 0020,
  plus `src/core/stairSpec.test.ts` 23, the stair proportions and the spiral's
  miss, and `src/scene/props/bathroomFit.test.ts` 19, the bathroom fixture fit).
  The eight older files are:
  `src/core/rules.test.ts` (25, over HAND-BUILT `DwellingGraph` objects),
  `src/library/naming.test.ts` (14, the `Flat n` / `Unit n` convention and the
  number the save dialog proposes), `src/core/savePlan.test.ts` (14, all eight
  save-checkbox combinations and the rule that a failed unit never cancels the
  project file), `src/library/manifest.test.ts` (9, manifest schema plus the
  committed library validated through the browser's own parser),
  `src/core/saveFiles.test.ts` (8, the byte-identity guarantee for both
  downloads), `src/library/ids.test.ts` (6, id slugs and collisions),
  `src/core/exteriorEdges.test.ts` (5, over `isFacadeEdge`), and
  `src/core/unitExport.test.ts` (3 pure cases over the export glazing
  invariant, whose header explains that it deliberately does not call
  `buildUnitExport`).
  `npm run test:slow` is the second, about 3.6 s, holding anything named
  `*.slow.test.ts` — files that drive a real `FloorManager` through a stubbed
  `FloorDeps` (`unitExport.slow.test.ts`, and run 0018's
  `libraryRoundTrip.slow.test.ts`). The split exists because that import graph
  pulls in three.js; it is written in exactly two places, `test.exclude` in
  `vite.config.ts` and `include` in `vitest.slow.config.ts`.
- **`npm run test:slow` currently reports `6 passed | 1 expected fail`, and the
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
