---
id: "0001"
title: Bridge smoke test
source: 0001-bridge-smoke-test.md
status: complete
branch: elastic-rooms
commit: 618f026
completed: 2026-07-28
---

## Summary

First end-to-end run of the Cowork bridge. Nothing outside `_cowork/` was modified.
The loop works: the prompt was read from `_cowork/inbox/`, this report was written to
`_cowork/outbox/`, the prompt moved to `_cowork/done/`, and a row was appended to
`_cowork/LOG.md`. The bridge wiring is in place but **not yet committed** — every
bridge file is currently untracked, which is a different thing from "not ignored" and
is the one gap worth acting on.

## What I did

Read-only inspection only. No file outside `_cowork/` was created, edited or deleted.

- Ran `git rev-parse --show-toplevel`, `--abbrev-ref HEAD`, `--short HEAD`.
- Enumerated top-level directories and files.
- Ran `git check-ignore -v` against 13 paths (6 under `_cowork/`, 7 under `.claude/`).
- Compared `git ls-files` output against 6 paths to separate *ignored* from *tracked*.
- Counted `.ts` files per `src/` subdirectory and lines in 7 candidate entry points.
- Corrected one now-false paragraph in `_cowork/CONTEXT.md` (item 3 under "Non-obvious
  things"). It claimed the bridge under `.claude/` was untracked and unfixable; the
  negation rules at `.gitignore:27-30` had since made it tracked-eligible, so the file
  was telling every future planning session something this run disproved. Inside
  `_cowork/`, so within the prompt's constraints. No other section touched.

## Findings

### 1. Repo root and branch

- Root: `D:/_Studies/_DFAB/DFAB/_T3/Module Configurator`
- Branch: `elastic-rooms`
- HEAD: `618f026` ("Export: cellRooms + roomTypes -- the flat as its author made it")

### 2. Top-level directories

| Directory | What it holds |
|---|---|
| `src/` | All application code. 40 `.ts` files across 4 subdirectories plus `main.ts` and `style.css`. |
| `src/core/` | Model and logic, no three.js. 18 files: grid/occupancy, room presets, floors, doors, entrances, adjacency graph, rules engine, window generation, save/load, flat export. |
| `src/scene/` | three.js geometry builders. 12 files plus `props/` (5 files) for authored voxel furniture. |
| `src/interaction/` | Pointer and keyboard controllers. 5 files: palette drag-drop, selection and group ops, door and entrance placement, raycast picking. |
| `src/ui/` | DOM panels. 5 files: palette, validation report, bubble diagram, compass dial, toasts. |
| `docs/` | 8 files. The flat→building JSON spec, two rules documents (`rules-list.*`, `rules-reference.*`) each in HTML + generated PDF, `build-pdf.py`, and the analysis behind the two-repo split. |
| `dist/` | Vite build output. Gitignored (`.gitignore:5`). |
| `node_modules/` | Dependencies. Gitignored (`.gitignore:2`). |
| `.claude/` | Dev-server launch configs and this bridge. Partly gitignored — see finding 4. |
| `_cowork/` | Bridge traffic. Created in this setup; `inbox/`, `outbox/`, `done/`, `LOG.md`, `CONTEXT.md`. |

Top-level files: `.gitignore`, `CLAUDE.md`, `PROJECT_STATE.md`, `README.md`,
`WRITING.md`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`.

### 3. Entry points

In the order worth opening them:

- `PROJECT_STATE.md` (2338 lines) — the real orientation document, section-numbered
  and kept current. `README.md` is 96 lines and much shallower; where the two
  disagree, PROJECT_STATE is the one that has been maintained.
- `src/main.ts` (829 lines) — wires the whole app together. Start here to trace
  anything.
- `index.html` (108 lines) — the page: one canvas plus DOM panels.
- `src/core/rules.ts` (1165 lines) — every layout rule, as data in a `RULES` array.
- `docs/bridge-format.md` (221 lines) — the `dwelling-unit` JSON contract with the
  second repo.
- `src/core/modules.ts` (341 lines) — the room-type presets, as data.

Run scripts, from `package.json`: `dev` = `vite`; `build` = `tsc && vite build`;
`preview` = `vite preview`.

### 4. Bridge wiring — in place, but nothing is committed

`CLAUDE.md:27` contains `## Cowork bridge`. Confirmed.

`.gitignore` ignores **exactly one** path under `_cowork/`:

| Path | Result |
|---|---|
| `_cowork/CONTEXT.md` | IGNORED, by `.gitignore:24` |
| `_cowork/LOG.md` | not ignored |
| `_cowork/inbox/` | not ignored |
| `_cowork/outbox/` | not ignored |
| `_cowork/done/` | not ignored |
| `_cowork/inbox/0001-bridge-smoke-test.md` | not ignored |

`.claude/bridge/` and `.claude/skills/` are **not ignored** — all 5 files
(`bridge/PROTOCOL.md`, `bridge/REPORT_TEMPLATE.md`, `skills/next/SKILL.md`,
`skills/report/SKILL.md`, `skills/bridge/SKILL.md`) come back clean from
`git check-ignore`. Other files directly under `.claude/` remain ignored:
`settings.local.json` and `launch.json` both match `.gitignore:28` (`.claude/*`).
That is the intended shape.

**But not ignored is not the same as tracked.** `git ls-files` shows that none of
these are in the git index yet:

| Path | In index? |
|---|---|
| `.claude/bridge/PROTOCOL.md` | NOT tracked |
| `.claude/skills/next/SKILL.md` | NOT tracked |
| `_cowork/LOG.md` | NOT tracked |
| `_cowork/inbox/0001-bridge-smoke-test.md` | NOT tracked |
| `CLAUDE.md` | tracked (modified) |
| `.gitignore` | tracked (modified) |

`git status --porcelain` returns ` M .gitignore`, ` M CLAUDE.md`, `?? .claude/`,
`?? WRITING.md`, `?? _cowork/`. So the bridge exists on disk and is *eligible* to be
committed, but until someone commits it the record it is supposed to preserve lives
only in this working tree — one `git clean` from gone.

A related detail that has now resolved itself: git cannot commit empty directories,
so before this run `_cowork/outbox/` and `_cowork/done/` would have vanished from any
clone. This run puts a file in each, so both are now committable without needing
placeholder files.

### 5. The three least obvious things about this repo

1. **This repo is only half the system, and you can only reach this half.** It
   authors a *single flat*. A separate repo, `bottom-up-design`, packs many flats
   into a *building* — massing, aggregation, evolutionary layout, section drawings
   all live there. The two share no code, only a JSON file described in
   `docs/bridge-format.md`. Any prompt about buildings, packing, facades at building
   scale, or section cuts cannot be executed here and will come back blocked. There
   is currently no bridge in that other repo, so it cannot be driven this way at all.

2. **There is no test suite. None.** No test runner, no test files, no CI. The only
   verification available is: `tsc` clean, `npm run build` clean, and driving the app
   in a browser and looking at it. A prompt asking to "add a test for X" has no
   harness to add it to. Ask instead for a runnable check or for browser
   verification, and expect evidence to come back as screenshots rather than as a
   passing suite.

3. **Documentation upkeep is mandatory and expensive.** `CLAUDE.md:6-13` requires
   that `PROJECT_STATE.md` (2338 lines) be updated to match the code *before* any
   feature is reported done, and that `tsc` and `npm run build` both be run. If
   `src/core/rules.ts` changes, `docs/rules-reference.html` must be edited to match
   and the PDF regenerated via `python docs/build-pdf.py`. Budget for this in every
   feature prompt — it is not optional and it is not small.

## Evidence

Every claim above came from a command run in this session, not from recall.

- Repo root, branch, HEAD: `git rev-parse --show-toplevel`, `git rev-parse
  --abbrev-ref HEAD`, `git rev-parse --short HEAD` → `elastic-rooms`, `618f026`.
- Ignore results: `git check-ignore -v` run individually against 13 paths. Rule line
  numbers in the tables above are git's own output, not inferred.
- Tracked-vs-untracked: `git ls-files` compared against 6 paths, plus
  `git status --porcelain`.
- File counts: `Get-ChildItem -Filter *.ts -File` per directory — `src/core` 18,
  `src/interaction` 5, `src/scene` 12, `src/scene/props` 5, `src/ui` 5.
- Line counts: `Get-Content <file> | Measure-Object -Line` — `PROJECT_STATE.md` 2338,
  `src/core/rules.ts` 1165, `src/main.ts` 829, `src/core/modules.ts` 341,
  `docs/bridge-format.md` 221, `index.html` 108, `README.md` 96.
- Scripts: parsed from `package.json`.

Nothing here is estimated.

## Artifacts produced

- `_cowork/outbox/0001-bridge-smoke-test.report.md` — this file.
- `_cowork/done/0001-bridge-smoke-test.md` — the prompt, moved out of `inbox/`.
- `_cowork/LOG.md` — one row appended.

No plots, data files or geometry: this run was read-only by instruction.

## Decisions and rationale

- Reported *tracked* separately from *ignored*. The prompt asked whether
  `.claude/bridge/` and `.claude/skills/` are "tracked by git", and the honest answer
  is no even though the ignore rules were just fixed to allow it. Answering only with
  `git check-ignore` would have been technically responsive and materially
  misleading.
- Did not add `.gitkeep` files to `_cowork/outbox/` or `_cowork/done/`. The
  constraint was read-only outside `_cowork/`, so it would have been permitted — but
  this run puts real content in both directories, which solves the problem without
  leaving placeholder files behind in the permanent record.

## Deviations from the prompt

None. The prompt was executed as written, including its corrected question 4.

## Blocked / did not do

Nothing was blocked. The prompt's constraints (read-only outside `_cowork/`, no
installs, do not run the project) were followed; no part of the task required
exceeding them.

Not attempted, because the prompt did not ask and the constraints forbade it:
committing the bridge. See finding 4 — it is the one loose end.

## Open questions for you

1. **Does the second repo get its own bridge, or does this one stay single-repo?**
   `bottom-up-design` is where building-scale work happens and it has no `_cowork/`
   at all. Two bridges means two inboxes and two id sequences to keep straight but
   keeps each record next to the code it describes. One bridge means prompts for the
   other repo sit here unexecutable, and the record of building-scale work ends up
   filed under the flat repo — which, for a thesis that argues the two halves are one
   method, may be the wrong shape. This is a methodology decision, not a tooling one.

2. **Is `PROJECT_STATE.md` still the right instrument now that the bridge exists?**
   It is 2338 lines, rewritten by hand after every feature per `CLAUDE.md:6-8`, and
   it describes the *current* state only — it deliberately forgets. `_cowork/outbox/`
   accumulates the same information as a dated sequence that never forgets. Keeping
   both means writing every change up twice. Whether the reference doc or the
   chronological record is the primary artifact is a thesis question about what
   counts as documentation of a design process.

## Suggested next prompt

Audit `docs/bridge-format.md` (221 lines) against what `src/core/unitExport.ts`
actually emits, read-only.

The `dwelling-unit` v1 format has grown three additive optional fields over separate
sessions — `cellKinds`, `cellRooms`, `roomTypes` — while `"version"` stayed at 1 by
design. The spec is the entire interface with the other repo, and it is exactly the
kind of document that drifts silently, because nothing fails when it does.

Should return: a field-by-field table of what the spec documents versus what the code
writes, with `unitExport.ts:line` for each; any field emitted but undocumented, or
documented but no longer emitted; and whether the invariants the spec asserts (cell
counts matching kinds and rooms arrays, the `roomTypes` legend covering every id used
in `cellRooms`) are actually enforced at export time or merely described. No edits —
the point is to find out whether the contract is still true before writing a prompt
that changes it.
