---
id: "0019"
title: One save, and say what you are saving
source: 0019-one-save.md
status: complete
branch: run/0019
commit: 2d17867
completed: 2026-08-10
---

## Summary

Saving is one dialog now. A single Save item opens it, a design number names
both files, three checkboxes say what to write, and one click writes any
combination of the project file, the unit file and the library entry. The
three outputs stay three separate things in the model and on disk; only the
doing collapsed. The dialog opens on the next free number, so authoring a run
of units needs no typing, and it reports one result line per output, which is
what lets a unit fail its hard gate while the project file still writes.

The branch is `run/0019`, pushed to
`origin/run/0019` at `2d1786770052fff3e4486c3473cc7ffdb47df73f`. `main` gained
nothing. Both downloads are proven byte-identical to what the retired paths
wrote, by test and by diff. The library also gained the two things an author
hits while saving a run: a replace prompt instead of a silent second entry,
and a rename control instead of hand-editing the manifest.

## What I need back — answers

### 1. Commits, remote hash, deploy link, checkout

Five commits, oldest first, each figure from `git show --shortstat`:

- `beb5193` library: Shrey's authored units 1 to 3 — 7 files, +6788.
- `0b8607e` save: one dialog, three outputs — 7 files, +694, −179.
- `fc1e0b4` library: name and overwrite — 2 files, +138, −23.
- `67ac8a3` save: tests — 4 files, +324, −2.
- `2d17867` save: PROJECT_STATE section 11, library-format for rename and
  replace — 2 files, +160, −27.

`git push -u origin run/0019` succeeded, and `git rev-parse origin/run/0019`
returned `2d1786770052fff3e4486c3473cc7ffdb47df73f`, equal to local HEAD. One
further commit carrying this report, the prompt's move to `done/` and the LOG
row lands on the same branch after this file is written and is pushed with it;
the code under review is exactly `2d17867`.

The Netlify branch link works: `https://run-0019--reconfigure-flat.netlify.app`
answered HTTP 401 when checked after the push. 401 rather than 200 because the
site is password-protected, which is the same answer the production site and
the run/0018 branch deploy give, so it is the site responding rather than a
missing deploy. Checked once immediately after pushing and it was 404, so the
build takes a minute or two. Nothing in the repository names the site: there is
still no `netlify.toml`, and the name came from the prompt.

```bash
git fetch origin run/0019 && git checkout run/0019 && npm install && npm run dev
```

The app is then at `http://localhost:5173`, and Save / Open → Save… opens the
new dialog.

### 2. The tree at the start, and Shrey's uncommitted files

`git status --short` on `main` at the start of the run showed one modified file
and seven untracked ones:

```
 M public/units/index.json
?? _cowork/inbox/0019-one-save.md
?? public/units/unit-1.jpg
?? public/units/unit-1.json
?? public/units/unit-2.jpg
?? public/units/unit-2.json
?? public/units/unit-3.jpg
?? public/units/unit-3.json
```

Those are three units Shrey saved through the run 0018 library endpoint while
authoring, plus the three manifest rows recording them. They are real and
complete: each is `format: "dwelling-unit"`, `version: 1`, carries a
`sourceProject`, and reads 136, 172 plus 181, and 147 cells respectively, with
`unit-2` a two-storey design. File timestamps run 16:41, 16:52 and 16:57 on 10
August.

I committed all seven unchanged as `beb5193`, before writing any code, so the
branch cannot lose them. Nothing was edited, renamed or regenerated. The
manifest at that point held five entries: the two run 0018 seeds and Unit 1 to
Unit 3.

One consequence found later and worth stating plainly: **those files break the
test suite on `main`.** Run 0018's `manifest.test.ts:79` asserts
`expect(m.units.length).toBe(2)`, and a second case there requires every
manifest entry to have an imported unit file. Measured by checking out `main`
into a temporary worktree, copying Shrey's files in, and running `npx vitest
run`:

```
 FAIL  src/library/manifest.test.ts > the committed manifest > parses through the same validator the browser uses
AssertionError: expected 5 to be 2
 FAIL  src/library/manifest.test.ts > the committed manifest > agrees with each unit file on storeys, area, name, and colour
AssertionError: unit file for unit-1 is imported above: expected undefined to be defined
 Test Files  1 failed | 4 passed (5)
      Tests  2 failed | 45 passed (47)
```

So `main`'s suite was already red against the library as it actually stood.
Commit `67ac8a3` fixes both cases, described under point 6.

### 3. The dialog as built

The dialog is `#save-dialog` in `index.html:143-177`, wired in
`src/main.ts:727-1059`. It carries exactly these controls:

- **Design number**, `#save-number`, `type="number"` with `min="1"`. It is the
  only text input. `saveDesignNumber` (`src/main.ts:798-801`) floors it at 1,
  so a cleared or nonsense field cannot write `Flat NaN`.
- **Colour**, `#save-color`, unchanged in behaviour: proposed by hashing the
  unit name through `defaultUnitColor` (`src/main.ts:749-753`), so the same
  name always proposes the same colour, and left alone for the rest of the
  session once touched by hand.
- **A names line**, `#save-names`, restating what the number resolves to:
  "Writes Flat 4 and Unit 4". The two names are never a guess.
- **Three checkboxes** under a "What to write" fieldset: Project file, Unit
  file, Library entry, each with a one-line note saying what that output is
  ("the whole design, the only thing that reopens for editing" / "the contract
  with the building" / "the unit plus a preview, browsable under Units").
- **Close and Save.** Save runs the save and leaves the dialog open; Close is
  the only way out. That is deliberate, see the result block below.
- **A result block**, `#save-results`, one line per selected output.

**Defaults.** All three boxes start checked. That is the choice I made, and the
reason is that three trips through the menu is what they replace: Shrey was
doing all three per unit, so all three is the honest default, and anything less
would silently drop an output he was previously getting. The Save button
disables itself when nothing is ticked (`isEmptySelection`).

**What is remembered between saves.** The three checkbox states, in the
module-level `saveSelection` (`src/main.ts:783`), re-applied every time the
dialog opens. Also `saveColorTouched`. Both are session-only, never serialized:
this is how you save, not part of the design, so it follows the same rule as
every other view-state default and resets on reload. The design NUMBER is not
remembered, because it is re-derived on every open, which is strictly better.

**How the next free number is found.** `nextFreeNumber`
(`src/library/naming.ts:54-66`) takes the library manifest and returns the
**lowest positive integer no entry holds**, counting both ids and names through
`numberFromName`, which reads `Unit 4` and `unit-4` alike and returns null for
anything not following the convention. `openSaveDialog`
(`src/main.ts:834-844`) re-fetches `units/index.json` on every open, so a save
made a moment ago is already counted. With the committed library holding
`unit-1` to `unit-3` it proposes 4, verified live and pinned by
`naming.test.ts:80-83`.

**What happens when the numbering has a gap.** The gap is filled. Lowest-free
rather than highest-plus-one, so `unit-1`, `unit-2`, `unit-4` proposes 3, and
`unit-2`, `unit-3` proposes 1 (`naming.test.ts:57-62`). I chose that over
highest-plus-one because a gap is nearly always a deletion the author meant,
and stranding numbers makes the set drift away from the count of units. The
risk it creates, proposing a number whose old file is still around, is covered
by the replace prompt.

Two consequences I record rather than hide. A **renamed** entry still holds its
number, because rename keeps the id and `nextFreeNumber` reads ids too, so
`unit-4` renamed to "Studio A" does not free 4 (`naming.test.ts:73-78`). And a
design saved **without** a library entry does not consume its number, because
the manifest is the only persistent record the app can read back; project and
unit files are downloads that leave no trace. Saving Unit 5 as a file only, then
opening the dialog again, proposes 5 a second time.

### 4. The byte-identical proofs

Two halves, and the method for each.

**By construction and diff.** The two serialization expressions moved into
`src/core/saveFiles.ts` unchanged. On `main`, `exportProject` built its payload
at `src/main.ts:723-724`:

```ts
const data = serializeProject(floors.floors, floors.northAngle, floors.orientationPreference);
const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
```

and `exportUnit` built its own at `src/main.ts:790`:

```ts
const blob = new Blob([JSON.stringify(result.file, null, 2)], { type: "application/json" });
```

On the branch the same two expressions are `saveFiles.ts:24`
(`return JSON.stringify(data, null, 2);`) and `saveFiles.ts:30`
(`return JSON.stringify(file, null, 2);`), with the identical
`serializeProject(floors.floors, floors.northAngle, floors.orientationPreference)`
call at `src/main.ts:929`. Nothing wraps, reorders or post-processes them.

**By test.** `src/core/saveFiles.test.ts` runs both against a real committed
unit file and the real project embedded in its `sourceProject`, asserting
`projectFileText(project) === JSON.stringify(project, null, 2)` and
`unitFileText(unit) === JSON.stringify(unit, null, 2)`, that both round-trip to
an equal object, and that the unit text plus one newline reproduces the stored
file's own bytes exactly, which is how the download and the sink's copy relate
(`vite.config.ts` writes `JSON.stringify(unit, null, 2) + "\n"`).

**One thing did change, and it is not the contents.** The filenames now follow
the convention: `flat-4.json` and `unit-4.json`, from
`projectFileName`/`unitFileName` (`saveFiles.ts:35-42`), instead of
`flat-project-<timestamp>.json` and `unit-<name>-<timestamp>.json`. The prompt's
naming scheme asks for exactly this, and the file a consumer of either format
reads is byte-for-byte what it was.

### 5. The unit gate fails and the project save was asked for

The project file still writes. Measured on an empty project with all three
boxes ticked, read out of the dialog's own result block:

```
Project file    flat-4.json downloaded — 1 floor(s), 240 bytes
Unit file       not written — No usable entrance: the unit needs at least one
                NON-blocked entrance on floor 0 (see rule E2 — a blocked
                entrance no longer faces the outside). Place or free one, then
                export.
Library entry   not written — No usable entrance: the unit needs at least one
                NON-blocked entrance on floor 0 (see rule E2 — a blocked
                entrance no longer faces the outside). Place or free one, then
                export.
```

The first line is green, the other two red. The rule behind it is
`unitGateResults` (`src/core/savePlan.ts:77-90`), which fails only the
unit-derived outputs and leaves every other selected output alone, and
`runSave` writes the project file before touching the unit at all
(`src/main.ts:927-940`). `savePlan.test.ts:110-118` pins it in both directions:
the project row is never `failed` or `skipped` in any selection that includes
it, and nothing is marked failed that was not asked for.

The same holds for a declined advisory confirm, which marks the two unit
outputs `skipped` with "you chose not to continue past the layout check" and
leaves the project alone. The confirm itself is raised once per save, and only
when a unit is actually being written: a project-only save never asks, because
rules describe what the unit promises the building (`needsRuleConfirm`,
`savePlan.ts:66-68`).

### 6. Test counts, and both fixture baselines

Before, on `main` as it stood: 47 cases in 5 files fast, and 6 passed plus 1
expected fail slow. Against the library as it actually stood, 2 of those 47
failed, quoted under point 2.

After, measured on the branch: **`npm test` 84 passed in 8 files, 787 ms**, and
**`npm run test:slow` 6 passed plus 1 expected fail, 4.10 s**. The expected
fail is the standing french-window case at
`src/core/unitExport.slow.test.ts:194`, untouched. `npx tsc --noEmit` exits 0
and `npm run build` completes in 5.53 s.

The 37 new fast cases are `savePlan.test.ts` (all eight checkbox combinations
and the gate rule), `saveFiles.test.ts` (the byte-identity half above) and
`naming.test.ts` (the convention, the gap behaviour, the collision lookup).
`manifest.test.ts` lost its hardcoded count of 2, which is what was failing; it
now checks the two seeds it actually imports, skips authored units it does not,
and asserts that skip cannot make the loop vacuous
(`manifest.test.ts:105-108`).

Both fixture baselines re-read from `#validation-panel` after Check Layout,
unchanged:

- `flat-1-two-storey.json` — "1 must fix, 11 worth a look, 5 note", the 12 of
  the baseline.
- `flat-1-no-stair.json` — "1 must fix, 6 worth a look, 4 note", the 7.

Neither fixture is touched by the diff: `git diff main..2d17867 --stat` lists
nothing under `testflats/`.

### 7. Screenshots

Pane screenshots do not write files in this environment, the same limit runs
0016 and 0018 recorded, so they exist in the session record and are described
here with their measured content.

**The save dialog**, opened on the flat-2 fixture. Title SAVE, a Design number
field reading 4 beside a pink Colour swatch, the line "Writes Flat 4 and Unit
4", then the What to write fieldset with all three boxes ticked and their notes,
then CLOSE and a filled SAVE. The DOM behind it read
`{"open":true,"number":"4","names":"Writes Flat 4 and Unit 4","boxes":[true,true,true],"saveDisabled":false}`.

**The result line after a save that wrote all three**, same session, one click
later:

```
Project file    flat-4.json downloaded — 1 floor(s), 6550 bytes
Unit file       unit-4.json downloaded — 1 storey(s), 34290 bytes
Library entry   added unit-4 in units/ — 69.84 m², preview 140 kB
```

All three lines green. On disk that produced `public/units/unit-4.json` at
34,305 bytes and `public/units/unit-4.jpg` at 143,274 bytes, with `unit-4`
appended to the manifest. Those artefacts were test output, not content, so
they were removed before committing and the library is back to exactly its
committed five entries, confirmed by `git status --short public/units/`
returning nothing.

**A third**, the gate failure, is quoted in full under point 5.

### 8. Skills read

I read two and used parts of both.

**`design-automation`** contributed the shape of the thing. Section 8.1 names
the fan-out pattern, one input producing N outputs evaluated independently,
which is what one save writing three files is, and section 8.3's "graceful
degradation: if optional step fails, continue with defaults" is exactly the
rule the prompt asked for in task 2 and the reason the project write happens
first and unconditionally. Section 8.4 on audit trails pushed me toward the
result block being a persistent record in the dialog rather than three toasts
that stack and expire. Its opening distinction between hard rules that
invalidate and soft rules that penalise also matches what this codebase already
does with hard gates against advisory violations, and reading it made me keep
that split visible in `savePlan.ts` rather than collapsing both into one
"cannot save" state.

**`interoperability`** contributed one specific check. Its section 1.4 data
loss taxonomy names metadata drift, the same fact recorded in two places
diverging, and that is precisely the risk when a library entry's display name
lives in the manifest row while the unit file carries its own `name` field that
the building reads. So the rename endpoint updates both together
(`vite.config.ts:210-219`) rather than the manifest alone, which was my first
sketch. Its repeated discipline of validating at every exchange boundary is
also what the byte-identity tests are.

**Rejected, with reasons.** `design-automation` section 8.2 recommends workflow
engines, naming Airflow, n8n and Speckle Automate: refused, because the run
forbids new runtime dependencies and this is a three-branch function, not a
DAG, so an engine would be more machinery than the thing it runs. Its sections
3, 4 and 7, on constraint satisfaction, space planning and code compliance
automation, are about generating layouts and have nothing to say about a save
dialog. From `interoperability` I refused the entire platform layer, IFC,
Speckle streaming, Rhino.Inside and the Autodesk APIs: this repo shares exactly
one JSON file with exactly one other repo by deliberate design, recorded in
`_cowork/CONTEXT.md` as non-obvious point 1, and a streaming platform would
dissolve the two-repo split the thesis argument rests on. I also declined its
advice to prefer open standards over proprietary formats, on the grounds that
`dwelling-unit` is a documented format between two codebases nobody else
consumes, so the standard it would be measured against does not exist.

### 9. Contradictions with the Assumptions, then my own

The prompt's assumptions:

1. Held, and the warning was correct. `main` carries run 0018 merged at
   `9089329`, the library was live with five entries, and the tree was dirty
   with exactly the files described. Nothing was discarded; they are commit
   `beb5193`. The assumption did not anticipate that those files make `main`'s
   own suite fail, which they do, quoted under point 2.
2. Held. Export project, Export unit and Save to library were the three
   actions, reached from the Save / Open menu and the unit-export dialog. All
   three are retired.
3. Held. The fixtures are untouched and still read 12 and 7.
4. Held. `docs/bridge-format.md` is untouched, the unit format stays at
   version 1, and nothing this run added went into it.

My own assumptions, where the prompt left room:

- **The design number is a number field, not a free-text name.** The convention
  fixes names to a word and a number, and the prompt wants no typing, so the
  dialog collects the number and derives both names. The effect is that an
  arbitrary name can no longer be typed at save time; the rename control is
  where a non-conforming name comes from now, which is also how the two
  pre-convention entries are meant to be fixed.
- **The number is shared across both kinds**, as the prompt's first reading
  says: design 4 writes `Flat 4` and `Unit 4`. I did not build per-kind
  numbering. The effect is that the numbering is driven by the library, since
  it is the only persistent record, so a project-only save does not advance it.
- **Next free means lowest free.** Gaps refill. Effect described under point 3.
- **Filenames follow the ids** (`flat-4.json`, `unit-4.json`), replacing the
  timestamped names. Effect: two saves of design 4 to the same folder collide
  in the browser's download handling and get the browser's own `(1)` suffix,
  where before every download was unique by timestamp. I judged that the right
  trade for names that pair by eye, which is what the convention is for.
- **All three checkboxes default on**, reasoning under point 3.
- **The result block lives in the dialog and the dialog stays open after Save.**
  The prompt says the dialog must say the unit did not write, which a toast
  cannot do reliably; it also fixes a real hazard the automation environment
  exposed in run 0018, where dialog close events were deferred unpredictably.
- **Rename changes the display name only**, keeping the id and both filenames.
  Effect: ids stop being derivable from current names, which is why
  `findLibraryEntry` matches on either.

## What I did

- `beb5193` preserved Shrey's three authored units unchanged.
- `src/core/savePlan.ts` (92 lines), the pure decision layer: `planOutputs`,
  `isEmptySelection`, `needsUnitBuild`, `needsRuleConfirm`, `unitGateResults`,
  `outputLabel`.
- `src/core/saveFiles.ts` (42 lines), the payload bytes and the two filenames.
- `src/library/naming.ts` (79 lines), the convention: `projectNameFor`,
  `unitNameFor`, `numberFromName`, `nextFreeNumber`, `findLibraryEntry`.
- `index.html:143-177`, the dialog; `index.html:36-38`, the menu reduced to
  Save… and Open project.
- `src/main.ts:727-1059`, the save flow: `openSaveDialog`, `syncSaveDialog`,
  `runSave`, `saveLibraryEntry`, the result rendering.
- `src/style.css:1289-1445`, the dialog and result-line styling in the existing
  Paper studio tokens, with the three status colours drawn from the app's
  existing accent, note and soft.
- `vite.config.ts`, `replace` handling in `/__library/save` and the new
  `/__library/rename` endpoint, plus `readManifest`/`findEntryIndex` shared by
  both.
- `src/library/unitBrowser.ts`, the optional `onRename` callback and the
  Rename control on each card.
- Three test files, 312 lines; `manifest.test.ts` repaired.
- `PROJECT_STATE.md` §11, plus §9 and §10 corrected where the retirement made
  them stale; `docs/library-format.md` gained the naming section, the replace
  rule and the rename endpoint.
- Removed three dead callbacks (`onExport`, `onImport`, `onExportUnit`) from
  `PaletteDeps` in `src/ui/palette.ts`, declared but never used since the
  reskin moved those controls to the top bar.

## Findings

- **`main`'s test suite was already failing** against the library as Shrey had
  grown it, 2 cases of 47, because run 0018 pinned the manifest entry count at
  a literal 2. A test that has to be edited every time content is added will be
  edited carelessly, so the replacement checks the seeds it actually imports and
  asserts that check is not vacuous. Numbers under point 2.
- **Replace works and keeps the id.** Saving Unit 4 twice with the prompt
  accepted left the manifest at 6 entries with `unit-4` overwritten in place,
  and the result line read "replaced unit-4 in units/". Declining produced
  `unit-4-2` and a seventh entry, which is the old behaviour preserved as the
  fallback.
- **Rename updates both copies of the name.** Renaming
  `flat-2-single-storey` through the card changed the manifest row and the unit
  file's own `name` field, keeping the id and both filenames; renaming it back
  returned the working tree to byte-identical committed state, confirmed by an
  empty `git diff public/units/`.
- **The stale dev server was real.** A Vite server had been running since
  16:36, predating the branch and my cache clear, which is the exact condition
  `_cowork/CONTEXT.md:140-144` warns produces stale transforms. I stopped it and
  started a fresh one; Shrey's work was already committed, so nothing was lost.
- The dialog result block also sidesteps the deferred-`close`-event trap run
  0018 hit in this automation environment, since the work now happens on the
  Save button's own click handler rather than on dialog close.

## Evidence

- Fast suite: `npm test` → "Test Files 8 passed (8), Tests 84 passed (84)",
  787 ms. Slow: "Test Files 2 passed (2), Tests 6 passed | 1 expected fail
  (7)", 4.10 s. Build: "built in 5.53s". `npx tsc --noEmit` silent.
- Byte identity: expressions quoted under point 4 from `git show main:src/main.ts`
  against the branch, plus `src/core/saveFiles.test.ts`.
- `main`'s failure: temporary worktree at `main`, Shrey's files copied in,
  `npx vitest run`, output quoted under point 2. The worktree was removed
  afterwards and `git worktree list` shows only the repository.
- Save behaviour: result lines read directly out of `#save-results` in the live
  app, quoted under points 5 and 7.
- Baselines: `#validation-panel` text after Check Layout on each fixture URL.
- Library state: `git status --short public/units/` empty at the end of the run.

## Artifacts produced

- `src/core/savePlan.ts`, `src/core/saveFiles.ts`, `src/library/naming.ts` and
  their three test files.
- `PROJECT_STATE.md` §11 and the amended `docs/library-format.md`.
- No new library content. `unit-4.json`/`unit-4.jpg` were written during
  verification and removed; the committed library is the five entries it had at
  the start.

## Decisions and rationale

- **The decision rules are pure and separate** (`savePlan.ts`) so all eight
  checkbox combinations and the gate rule are testable without a DOM, canvas or
  dev server. main.ts is wiring.
- **The payload bytes are separate too** (`saveFiles.ts`), which turns the
  byte-identity promise from an assertion into a test.
- **The advisory confirm fires at most once per save**, and never for a
  project-only save. Three trips used to ask up to twice.
- **The project file is written first**, before the unit is even built, so its
  independence is structural rather than a matter of catching errors carefully.
- **Rename keeps the id.** Changing filenames on rename would break anything
  already pointing at the entry and would free a number that is still in use.

## Deviations from the prompt

- **The menu retirement is not its own commit.** The prompt names
  `save: retire the separate menu items` as commit 3; it happened inside
  `0b8607e` instead. The old items called `exportProject` and
  `openUnitExportDialog`, which that commit deletes, so keeping them alive for
  one commit would have meant writing code for the sole purpose of removing it
  in the next. Everything the prompt asked that commit to do is done.
- **`Open project` survives**, as the prompt allows when reading the code shows
  a reason. It is the import, not a save, and nothing in the save dialog covers
  loading a file.
- **Three dead palette callbacks were removed** beyond the prompt's scope,
  described above. They were unreachable and named the retired actions.
- **WRITING.md still does not exist** in this repository, the same absence run
  0018 recorded. I followed the style the prompt describes.
- **Screenshots exist only in the session record**, as in runs 0016 and 0018;
  point 7 carries their measured content.
- The run also fixed `manifest.test.ts`, which the prompt did not ask for but
  "existing suites stay green" required.

## Blocked / did not do

None. The library housekeeping the prompt allowed to slip is in.

## Open questions for you

1. **A project-only save does not consume its number**, because the manifest is
   the only record the app can read back. An author who saves a few designs as
   project files before deciding which deserve library entries will see numbers
   repeat. The fix is either to accept it, or to let the app remember issued
   numbers locally, which introduces a second record that can disagree with the
   manifest. Which do you want?
2. **Two saves of design 4 now collide in the browser's downloads folder** and
   get its `(1)` suffix, where timestamped names never collided. Is the pairing
   by eye worth that, or should the filenames keep a short timestamp after the
   number?
3. **The two pre-convention entries still carry descriptive names.** The rename
   control now exists and the prompt says they are Shrey's to rename. If they
   become `Unit 4` and `Unit 5`, they take those numbers and the next free
   number moves to 6; if they are renamed to something else non-conforming they
   keep holding no number at all. Worth deciding before the baseline set is
   authored, since it changes what numbers the ten units get.
4. Nothing in the repository names the Netlify site, so the branch-link format
   lives only in prompts and reports. A line in `_cowork/CONTEXT.md` would make
   it discoverable to a run that is not told.

## Suggested next prompt

Author the baseline unit set, now that saving costs one click. On a fresh
branch from main after this merges: decide the fate of the two pre-convention
library entries first, using the new rename control, since that fixes which
numbers the baselines get. Then author each baseline dwelling and save it with
all three boxes ticked, letting the dialog propose each number. Return the full
`units/index.json`, per-unit area and storey counts, any unit the hard gates
refused with the reason, and a note of any point where the one-save flow got in
the way, since this is its first real use at volume. The machinery needs
nothing new; the run is content plus judgement about the ten dwellings.
