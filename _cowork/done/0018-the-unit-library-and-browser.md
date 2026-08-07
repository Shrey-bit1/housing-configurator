---
id: "0018"
title: The unit library and browser
created: 2026-08-06
---

## Context

First run of the new workflow. The run works on its own branch
`run/0018`, cut from `main`. It commits in stages and pushes the branch
at the end. `main` gains nothing. The report includes the branch deploy
link and the exact local checkout commands. The reader verifies through
one of those two.

The guest review on 4 August froze layout-rule work and set new
priorities. The first is a visual browser of saved units, with
previews. It serves this app now and the bottom-up building app later.
People see what units exist, open a copy, and adapt it. Around ten
baseline units will seed it later as content. This run builds the
machinery.

One design decision came from the planning session. The library entry
is the existing `dwelling-unit` export file. That file already carries
a full project save in `sourceProject` (src/core/unitExport.ts). So one
file serves both apps: the building app packs it, this app reopens it
for editing.

## Assumptions

These may be wrong. Check rather than trust, contradict rather than
work around. Where the prompt is silent, choose sensibly, keep going,
and record the choice in the report.

1. `main` contains the finished reskin (runs 0016 and 0017 merged). If
   it does not, stop before writing code and say so in a short report.
2. Netlify builds branches. If the site name is discoverable
   (netlify.toml, README, `_cowork/CONTEXT.md`), the report gives the
   `run/0018` deploy URL. If it is not, the report says so and the
   checkout commands stand in.
3. The `dwelling-unit` format stays at version 1. Everything this run
   adds around it is additive. `docs/bridge-format.md` stays its
   source of truth and stays untouched.
4. The two rule fixtures `testflats/flat-1-two-storey.json` and
   `testflats/flat-1-no-stair.json` stay untouched and stay out of the
   library. `testflats/flat-2-single-storey.json` and
   `testflats/flat-3-terrace.json` are free to read as seed sources.
5. `window.__app.capture()` can write a 0-byte file while reporting
   ok. Every capture this run trusts gets a byte-count check.

## Task

0. Machinery: `npm install`, restart the dev server on a clear cache
   (`node_modules/.vite` removed), probe the pane, boot via
   `?project=flat-1-two-storey.json` with no console errors. Then
   `git checkout -b run/0018`.

1. Storage, commit `library: storage and manifest`. A `units/` folder
   served statically. It holds one `dwelling-unit` JSON per unit, one
   JPEG preview per unit, and `units/index.json` as the manifest. One
   manifest entry per unit: `id`, `name`, `color`, `file`, `preview`,
   `storeys`, `areaM2`, `savedAt`. Ids are lowercase slugs of the
   name, with a numeric suffix on collision. Files are named by id.
   Two saves under one display name get two ids and two files. That
   fixes the old Unit_2 name clash.

2. Save to library, commit `library: save`. A dev-only Vite middleware
   endpoint accepts the unit JSON plus a JPEG preview. The preview is
   captured from the canvas at save time and byte-checked. The
   endpoint writes the pair into `units/` and updates the manifest.
   The unit-export dialog gains a "Save to library" action beside the
   existing download. In a production build the same action falls back
   to downloading both files, with a toast saying where they belong.
   The existing "Export unit" download stays byte-identical to today.

3. The browser, commit `library: browser`. A "Units" entry in the top
   bar opens a panel of cards built from the manifest: preview image,
   name, colour chip, storey count, area. Each card has one action,
   Open a copy. It loads the entry's `sourceProject` through the
   existing import path, confirm dialog included. The opened design
   then belongs to the user. Saving it to the library creates a new
   entry. Keep to the existing Paper studio tokens.

4. The reusable boundary, folded into commit 3 or given its own. The
   browser lives in `src/library/` as a self-contained module: plain
   TS and DOM, no imports from app internals. It takes a manifest URL
   and an `onOpen(file)` callback, wired up in `main.ts`. A new
   `docs/library-format.md` documents the folder layout, the manifest
   schema, and the module interface. The bottom-up repo will build its
   unit list against that page.

5. Seeds, commit `library: seed units`. Convert `flat-2-single-storey`
   and `flat-3-terrace` into two library entries through the real
   path: load, export, capture the preview. They give the browser
   content until the baseline units exist.

6. Tests, commit `library: tests`. Manifest schema validation. The
   id-collision behaviour: two saves under one name produce two ids.
   A round trip: a seed unit opened from the library, re-exported,
   storeys and edges unchanged. Existing suites stay green: `npm
   test`, `npm run test:slow` (the one `it.fails` stays failing as
   expected), `tsc` clean, `npm run build` clean. flat-1 still reads
   12 issues (1 must fix, 11 worth a look), no-stair still reads 7.

7. `PROJECT_STATE.md` gains the library section, on the branch.

8. The record and the push. Report to
   `_cowork/outbox/0018-the-unit-library-and-browser.report.md`. The
   prompt moves to `done/`, one LOG row, all committed on `run/0018`.
   Then `git push -u origin run/0018`. The remote hash goes in the
   report, plus the checkout commands and the deploy link per
   assumption 2.

If the run runs long: storage, save and the browser land whole. The
seeds and the round-trip test may slip to a follow-up. The
id-collision test may not slip.

## Constraints

- All work happens on `run/0018`. `main` gains nothing. Push only this
  branch.
- No new runtime dependencies, no React. The dev middleware is the
  only build-system change.
- The `dwelling-unit` format, the fixtures, the rules and their
  baselines stay untouched.
- Layout rules gain nothing. The review froze them.
- Never stage with `git add -A`.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. List every commit hash with one-line stats, the remote hash after
   the push, the deploy link or the reason it is missing, and the
   checkout commands.
2. Quote the seeded `units/index.json` in full.
3. Give the module interface as it ended up: the exact exported names
   and signatures from `src/library/`.
4. Describe the save flow: the endpoint path and what a production
   save does. Prove with a diff that the "Export unit" download is
   unchanged.
5. Attach pane screenshots: the browser open with both seed cards,
   and the export dialog with the new action. List byte sizes.
6. Give test counts before and after, and quote both fixture
   baselines again.
7. List contradictions with the Assumptions, then your own
   assumptions with their effects.

The report follows WRITING.md. Connected sentences that carry their
own logic. No em dashes as glue. No contrast constructions. Neutral
voice, plain words. Prose before any list or table. Every number
exact, and every claim names its evidence.
