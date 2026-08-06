---
id: "0018"
title: The unit library and browser
source: 0018-the-unit-library-and-browser.md
status: complete
branch: run/0018
commit: b7ec1ca
completed: 2026-08-06
---

## Summary

The unit library machinery is built and seeded on branch `run/0018`, pushed to
`origin/run/0018` at `b7ec1ca171f170f230347e74e5ca696bad229df4`. `main` gained
nothing. A `public/units/` folder stores one `dwelling-unit` JSON plus one JPEG
preview per unit under a validated manifest; a dev-only Vite endpoint writes
saves into it from a new "Save to library" action in the export dialog; a
"Units" top-bar button opens a card browser whose one action, Open a copy,
loads the entry's `sourceProject` through the normal import path. The browser
lives in `src/library/` as a self-contained module documented in
`docs/library-format.md` for the bottom-up repo. Both permitted fixtures are
seeded through the real path, all suites are green at higher counts, and the
existing "Export unit" download is proven byte-identical.

## What I need back — answers

### 1. Commits, remote hash, deploy link, checkout

Seven commits, oldest first, each `git show --shortstat`:

- `34a8d03` boot: guard the north badge against the zero-size first frame — 1 file, +3.
- `1ac22cd` library: storage and manifest — 3 files, +149.
- `36f5900` library: save — 3 files, +182, −4.
- `1592333` library: browser — 4 files, +476, −5.
- `9efdca1` library: seed units — 5 files, +3948, −1.
- `226f331` library: tests — 4 files, +229, −1.
- `b7ec1ca` library: PROJECT_STATE section 10 — 1 file, +80, −2.

`git push -u origin run/0018` succeeded; `git rev-parse origin/run/0018`
returned `b7ec1ca171f170f230347e74e5ca696bad229df4`, equal to local HEAD at
report time. One further commit (`bridge: 0018 …`, this report plus the prompt
move and the LOG row) lands on the same branch after this file is written and
is pushed with it; the code state under review is exactly `b7ec1ca`.

There is no deploy link. The repo has no `netlify.toml`, and a repo-wide
search for "netlify" matches only the prompt file itself
(`_cowork/inbox/0018-the-unit-library-and-browser.md:36` at run time).
`_cowork/CONTEXT.md` and `README.md` name no site either. The checkout
commands stand in:

```bash
git fetch origin run/0018 && git checkout run/0018 && npm install && npm run dev
```

The app is then at `http://localhost:5173`; the browser is the Units button,
and `http://localhost:5173/?project=flat-2-single-storey.json` reproduces a
seed's source layout directly.

### 2. The seeded `units/index.json`, in full

`public/units/index.json`, 624 bytes, exactly as committed in `9efdca1`:

```json
{
  "format": "unit-library",
  "version": 1,
  "units": [
    {
      "id": "flat-2-single-storey",
      "name": "Flat 2 — single storey",
      "color": "#f783ac",
      "file": "flat-2-single-storey.json",
      "preview": "flat-2-single-storey.jpg",
      "storeys": 1,
      "areaM2": 69.84,
      "savedAt": "2026-08-06T20:44:56.100Z"
    },
    {
      "id": "flat-3-terrace",
      "name": "Flat 3 — terrace",
      "color": "#4dabf7",
      "file": "flat-3-terrace.json",
      "preview": "flat-3-terrace.jpg",
      "storeys": 1,
      "areaM2": 60.48,
      "savedAt": "2026-08-06T20:59:43.145Z"
    }
  ]
}
```

`areaM2` is gross: every storey cell of every kind times 0.36 m². 69.84 is 194
cells, 60.48 is 168 cells, both verified by
`src/library/manifest.test.ts:87-99`, which recomputes the figure from the
unit file and compares.

### 3. The module interface as it ended up

`src/library/` holds three modules and two test files, 575 source lines total,
importing nothing from the rest of the app.

From `src/library/unitBrowser.ts` (281 lines):

```ts
export interface UnitBrowserOptions {
  manifestUrl: string;
  onOpen: (file: File, entry: UnitManifestEntry) => void;
  mount?: HTMLElement;            // default document.body
}
export interface UnitBrowser {
  el: HTMLElement;
  open(): void;                   // opens and (re-)fetches the manifest
  close(): void;
  toggle(): void;
  refresh(): Promise<void>;       // no-op while closed
  readonly isOpen: boolean;
}
export function createUnitBrowser(opts: UnitBrowserOptions): UnitBrowser;
```

From `src/library/manifest.ts` (104 lines):

```ts
export interface UnitManifestEntry {
  id: string; name: string; color: string; file: string; preview: string;
  storeys: number; areaM2: number; savedAt: string;
}
export interface UnitLibraryIndex {
  format: "unit-library"; version: 1; units: UnitManifestEntry[];
}
export class ManifestParseError extends Error {}
export function parseUnitLibraryIndex(text: string): UnitLibraryIndex; // throws ManifestParseError
```

From `src/library/ids.ts` (40 lines):

```ts
export function slugifyUnitName(name: string): string;
export function assignUnitId(name: string, taken: Iterable<string>): string;
```

`onOpen` receives the fetched `dwelling-unit` file unparsed, wrapped as a
`File` named `<id>.json`, plus the manifest entry. The wiring in
`src/main.ts:987-1020` extracts `sourceProject` and feeds
`importProjectText`; the module itself never learns this app's formats, which
is the boundary the bottom-up repo builds against. Styles are injected once
under a `ulb-` class prefix (`src/library/unitBrowser.ts:50-144`), reading the
host's tokens with hardcoded Paper-studio fallbacks.

### 4. The save flow, and the export-unchanged proof

The dialog `#unit-export-dialog` (index.html:147-151) now has three submit
values: cancel, `library` ("Save to library"), export. The close handler
branches on `returnValue` (`src/main.ts:765-769`). The library branch,
`saveUnitToLibrary` (`src/main.ts:821-894`), runs the same two hard gates and
the same advisory hard-rule confirm as `exportUnit`, restated rather than
factored out so the export path stays untouched. It then renders one frame,
reads `canvas.toDataURL("image/jpeg", 0.9)`, and byte-checks the result;
below 1000 bytes it refuses with an error toast, because a hidden canvas
"succeeds" with an empty image.

In dev it POSTs `{name, color, unit, preview}` to `/__library/save`. The
`library-sink` plugin (`vite.config.ts:53-146`, `apply: "serve"`) assigns the
id via `assignUnitId` against manifest ids plus stray file basenames, writes
`<id>.json` and `<id>.jpg` into `public/units/`, derives `storeys` and
`areaM2` from the posted unit file itself, appends the manifest entry, and
re-byte-checks the preview server-side. In a production build the same action
downloads the identical pair as `<slug>.json` and `<slug>.jpg` and shows a
sticky toast saying they belong in `units/` beside a hand-added manifest
entry; the slug carries no collision suffix there because only the dev server
owns the manifest.

The proof that "Export unit" is unchanged: extracting `function exportUnit`
from `main:src/main.ts` and from `run/0018:src/main.ts` and diffing yields no
output (verified with `diff` on the two extractions; the marker line printed
was "exportUnit IDENTICAL between main and run/0018"). The entire diff
touching that region of main.ts is the close handler:

```diff
 unitDialog.addEventListener("close", () => {
-  if (unitDialog.returnValue !== "export") return;
-  exportUnit(unitNameInput.value.trim() || "Unit", unitColorInput.value);
+  const name = unitNameInput.value.trim() || "Unit";
+  if (unitDialog.returnValue === "export") exportUnit(name, unitColorInput.value);
+  else if (unitDialog.returnValue === "library") saveUnitToLibrary(name, unitColorInput.value);
 });
```

The download filename, JSON serialization (2-space, trailing behaviour), and
toast text of the export path are therefore byte-identical to main's.

### 5. Screenshots and byte sizes

Pane screenshots do not write files in this environment; run 0016 recorded the
same limit (`_cowork/outbox/0016-paper-studio-reskin-on-a-branch.report.md:285`).
Both required states were captured in the session and are described here, with
the library's own files as the on-disk image evidence:

- Browser open with both seed cards: the Units panel over the viewport,
  header "UNITS 2", two cards side by side. Flat 2 shows its isometric
  preview, a pink chip (#f783ac), "1 storey · 69.84 m²"; Flat 3 shows its
  preview, a blue chip (#4dabf7), "1 storey · 60.48 m²"; each card has the
  single OPEN A COPY action. Verified against the DOM in the same state:
  card names `["Flat 2 — single storey", "Flat 3 — terrace"]`, count "2".
- Export dialog with the new action: EXPORT UNIT title, Name and Colour
  fields, and the three actions CANCEL, SAVE TO LIBRARY, EXPORT.

On-disk image evidence, byte sizes from `ls -la public/units/`:

- `public/units/flat-2-single-storey.jpg` — 143,274 bytes, 1968×1336 JPEG.
- `public/units/flat-3-terrace.jpg` — 141,023 bytes, same dimensions.
- `public/units/flat-2-single-storey.json` — 34,323 bytes.
- `public/units/flat-3-terrace.json` — 30,301 bytes.
- `public/units/index.json` — 624 bytes.

### 6. Test counts and fixture baselines

Before this run: `npm test` 33 passed in 3 files (about 0.9 s per
`_cowork/CONTEXT.md:106-110`); `npm run test:slow` 4 passed, 1 expected fail.

After (measured this run): `npm test` 47 passed in 5 files, 380 ms. `npm run
test:slow` 6 passed, 1 expected fail, 3.60 s; the expected fail is the
standing french-window `it.fails` in `src/core/unitExport.slow.test.ts:194`,
still failing as intended. `npx tsc --noEmit` exits 0. `npm run build`
completes in 4.64 s, and `dist/units/` contains all five library files, which
is the production serving path working.

Fixture baselines, read from `#validation-panel` after Check Layout on each
fixture: `flat-1-two-storey.json` reads "1 must fix, 11 worth a look, 5 note",
which is the 12 issues of the baseline (1 + 11) with the notes beside them;
`flat-1-no-stair.json` reads "1 must fix, 6 worth a look, 4 note", the
baseline 7 (1 + 6). Both fixtures are untouched by the diff (`git diff
main..b7ec1ca --stat` lists nothing under `testflats/`).

### 7. Assumptions checked, and my own

The prompt's assumptions against the repo:

1. Held. `main` carries the finished reskin; its history includes the 0016/0017
   merges and `844426c` "The reskin is main's".
2. Failed in the discoverable-name half: no `netlify.toml`, no site name
   anywhere in the repo, so no deploy URL. The checkout commands in answer 1
   stand in, per the assumption's own fallback.
3. Held. `docs/bridge-format.md` is untouched; the unit file stays v1; every
   addition is beside the format, not in it.
4. Held. `testflats/` is untouched; flat-2 and flat-3 were read as seed
   sources; `src/library/manifest.test.ts:84` asserts no `flat-1*` id is in
   the library.
5. Held, and sharpened. The 0-byte case is real and the new byte-check catches
   it: with the pane not compositing, a save refused with "Preview capture
   read back 0 bytes" (the toast is in the session record). The check has a
   second face worth knowing: a composited but cleared canvas produces a
   valid grey JPEG above the 1000-byte floor, and one such preview was
   written by a deferred-event replay during seeding (detail under
   Deviations) and deleted before committing. Every committed preview was
   opened and inspected in the browser panel.

My own assumptions, made where the prompt was silent:

- `units/` lives at `public/units/`, served at `/units/…`. Effect: static in
  dev and copied into `dist/` by the build with zero build-config change,
  which keeps the "dev middleware is the only build-system change" constraint;
  a root-level folder would have needed a copy plugin.
- The manifest is a versioned wrapper object (`format: "unit-library",
  version: 1`) around the entry list, echoing the unit file's own
  discriminator convention, rather than a bare array.
- `areaM2` is gross: all cells of all storeys, every kind (rooms,
  circulation, stair, outdoor), times 0.36, rounded to two decimals, derived
  server-side from the posted file. Documented in `docs/library-format.md:62-66`.
- The production fallback names files by bare slug with no collision suffix,
  since only the dev server owns the manifest.
- `onOpen` hands over the whole unit file rather than a pre-extracted
  `sourceProject`, keeping app-format knowledge out of the reusable module;
  the building repo wants the whole file anyway.
- Card metadata shows storeys and area; `savedAt` stays manifest-only.

## What I did

- `src/main.ts:601-603` — three-line guard: the first animate frame can run
  before the canvas has size, the projection divides by a zero viewport, and
  the north badge logged an SVG `rotate(NaN …)` error on every page load.
  Boot is clean now; this predates the run and is recorded under Deviations.
- `public/units/index.json` — the manifest, seeded with the two entries.
- `src/library/ids.ts`, `src/library/manifest.ts` — id assignment and the
  throwing manifest validator.
- `vite.config.ts:56-146` — the `library-sink` dev middleware at
  `/__library/save`, beside the existing capture-sink.
- `index.html:29`, `index.html:149` — the Units top-bar button and the third
  dialog action.
- `src/main.ts:802-894` — `saveUnitToLibrary` and its download helper;
  `src/main.ts:987-1020` — the browser wiring; `src/main.ts:898` —
  `importProjectText` now returns a
  boolean (loaded or not) so a declined replace-confirm leaves the panel open.
- `src/library/unitBrowser.ts` — the card panel module.
- `docs/library-format.md` — folder layout, manifest schema, save endpoint,
  module interface, non-goals.
- Seeded `flat-2-single-storey` and `flat-3-terrace` through the live app:
  loaded via `?project=`, saved via the dialog's Save to library action
  against the rendered canvas, pairs and manifest written by the sink.
- `src/library/ids.test.ts`, `src/library/manifest.test.ts`,
  `src/core/libraryRoundTrip.slow.test.ts` — the three required test areas.
- `PROJECT_STATE.md` §10, plus a two-line staleness fix in §9's export-path
  paragraph (the dialog is reached from the Save / Open menu since the reskin,
  and now also carries the library action).

## Findings

- The round trip is exact, beyond the asked storeys-and-edges: for both seeds,
  `sourceProject` loaded through a real `FloorManager` and re-exported
  reproduces storeys, every classified edge, `roomTypes`, `northAngle`, and
  the re-embedded `sourceProject` itself, deep-equal
  (`src/core/libraryRoundTrip.slow.test.ts:58-77`). The one-file-serves-both-apps
  decision holds with no drift on these fixtures.
- The id-collision rule survived an unplanned stress test. Deferred dialog
  events (below) replayed six queued saves of the same name within 607 ms;
  the sink assigned `flat-3-terrace` and `-2` through `-6` in order, zero
  overwrites, manifest `savedAt` stamps 20:59:43.145 to 20:59:43.752.
- Two automation-environment behaviours worth keeping in `CONTEXT.md`:
  the pane defers the `<dialog>` close event's queued task, sometimes for
  minutes, then replays all of them at once (a fresh `dialog.close()` probe
  fired no close event within 300 ms); and `window.confirm` returns false
  without display. Both are environment traps, not app bugs; a human gets
  normal dialogs. The byte-check and the panel-stays-open behaviour make both
  loud instead of silent.
- flat-2 checks at 0 must fix, 2 worth a look, 1 note; flat-3 at 0 must fix,
  3 worth a look, 1 note. Both seeds therefore save without the advisory
  confirm ever appearing.

## Evidence

- Fast suite: `npm test` → "Test Files 5 passed (5), Tests 47 passed (47)",
  380 ms. Slow: `npm run test:slow` → "Test Files 2 passed (2), Tests 6
  passed | 1 expected fail (7)", 3.60 s. Build: `npm run build` → "built in
  4.64s", then `ls dist/units/` lists the five files.
- Export byte-identity: `sed`-extracted `exportUnit` from `main:src/main.ts`
  and `run/0018:src/main.ts`, `diff` silent.
- Baselines: `#validation-panel` text read from the DOM after clicking Check
  Layout on each fixture URL, quoted in answer 6.
- Seed authenticity: both saves produced the "Saved … to the library as …"
  toast from the live app; the flat-2 save is in the session's screenshot
  record with the pair's bytes on disk 143,274 + 34,323 within the same
  minute (`ls -la` timestamps 22:44).
- The 6-save burst and its cleanup: manifest listing before pruning held ids
  `flat-3-terrace` through `flat-3-terrace-7`; `rm` plus a python rewrite left
  the two intended entries, re-verified by `cat public/units/index.json` and
  by the manifest test.

## Artifacts produced

- `public/units/index.json`, `public/units/flat-2-single-storey.{json,jpg}`,
  `public/units/flat-3-terrace.{json,jpg}` — committed in `9efdca1`, byte
  sizes in answer 5.
- `docs/library-format.md` — 150 lines, the library's source of truth.
- `dist/units/` — build output demonstrating production serving, not
  committed (dist/ is gitignored).

## Decisions and rationale

- `public/units/` over a root-level `units/`: the constraint allowed only the
  dev middleware as a build-system change, and `public/` gets static dev
  serving plus verbatim copy into `dist/` for free.
- Gate-and-confirm logic restated in `saveUnitToLibrary` instead of factored
  out of `exportUnit`: the prompt required the export download byte-identical,
  and an untouched function is the strongest cheap proof. The duplication is
  15 lines and both sites say why they exist.
- The browser hands `onOpen` the raw file; main.ts owns `sourceProject`
  extraction. The module stays format-blind and the building repo can reuse it
  wholesale.
- `importProjectText` void → boolean: additive; the Units panel needed to know
  whether a load actually happened, and inferring it any other way would have
  meant a second state channel.
- Manifest `storeys`/`areaM2` derived server-side from the posted unit file,
  never trusted from the client, so the manifest cannot disagree with the file
  it points at; `manifest.test.ts` re-derives and checks.

## Deviations from the prompt

- Step 0 requires boot "with no console errors"; main boots with one
  pre-existing SVG error from the north badge's NaN first frame. Fixed as its
  own first commit (`34a8d03`, 3 lines) rather than reported around, so the
  gate is genuinely met; outside the five prescribed library commits.
- The report is asked to follow WRITING.md; no file of that name exists in
  this repo (`find` across the tree matches nothing). I followed the style
  the prompt itself describes.
- Seeding "through the real path" met the environment's two dialog traps
  (deferred close events, auto-false confirms). The flat-2 save ran fully on
  real UI events. The flat-3 save used the real menu, dialog, name field and
  button, with the close event hand-dispatched after the pane failed to
  deliver it; everything from the close handler down, which is all the code
  this run added, executed identically. The burst-replay side effects
  (`flat-3-terrace-2`…`-7`, one grey preview among them) were pruned before
  committing; the committed flat-3 preview was inspected in the panel.
- Pane screenshots exist only in the session record, as in run 0016; answer 5
  carries the descriptions and the on-disk stand-ins.
- Two lines of §9 in PROJECT_STATE.md were corrected in passing (stale button
  location predating the reskin) since the same paragraph now needed the §10
  cross-reference.

## Blocked / did not do

None. The seeds and the round-trip test, named by the prompt as allowed to
slip, are in.

## Open questions for you

1. `areaM2` is gross floor area, outdoor and stair cells included, so the
   flat-3 card reads 60.48 m² of which 15 cells are terrace. If the review
   audience will read cards as habitable area, the manifest needs a second,
   net figure with a definition of what it excludes; which figure should the
   card lead with?
2. The ~10 baseline units will be authored by someone driving this app. Is
   hand-curation of `units/index.json` ordering acceptable for that pass
   (there is deliberately no delete/rename/reorder endpoint), or should the
   follow-up add a curation step?
3. A production save downloads `<slug>.json` with no collision suffix, since
   only the dev server owns the manifest. If baseline authoring will happen in
   a deployed build rather than dev, that naming gap matters and is worth one
   more decision; in dev it cannot arise.

## Suggested next prompt

Author the baseline unit set as content. Working on a fresh branch cut from
main after this one merges: design or load each baseline dwelling, save it
through Save to library with an agreed name and colour convention (names
become ids per `docs/library-format.md`), curate the manifest order, and end
with `npm test` green (the manifest test validates the grown library
automatically) plus one browser screenshot per row of cards. Return the full
`units/index.json`, per-unit areaM2 and storey counts, and any unit the hard
gates refused with the reason. The machinery needs nothing new; the run is
pure content plus judgement about the ten dwellings.
