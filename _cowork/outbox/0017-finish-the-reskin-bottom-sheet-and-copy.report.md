---
id: "0017"
title: Finish the reskin, bottom sheet and copy rewrite
source: 0017-finish-the-reskin-bottom-sheet-and-copy-rewrite.md
status: complete
branch: reskin-1a
commit: b6e3bd4
completed: 2026-07-31
---

## Summary

Stages 2e and 2f both landed, so `reskin-1a` now carries the whole of Part 2 of
the design handoff rather than the four fifths run 0016 finished. The layout
check moved from a 300px column pinned to the top left of the viewport to a
256px horizontal sheet across the bottom, with a header of counts and metrics
over a rail of one card per issue, and the severity tiers now read Must fix,
Worth a look and Note wherever a person sees them while the code keeps
`hard`, `soft` and `note`. Two things arrived from Shrey mid-run and were built
as well: the scrollbars were still drawing the browser's own chrome bar and now
match the paper, and the hint line that ran across the bottom of the viewport
was removed and its content moved into the palette and the shortcuts panel.
The branch is five commits further on at `b6e3bd4`, eleven ahead of `main`.
`main` gained nothing but this record: its tip is the single commit carrying
this file, whose parent is run 0016's record `a974583`, and no code change from
this run is on it. The tree is left checked out on `reskin-1a` so a reload shows
the finished reskin.

The five commits this run added to `reskin-1a`, oldest first, are `a74841e`
(the sheet: 3 files, 619 insertions, 287 deletions), `cd37a3e` (the scrollbars:
1 file, 35 insertions), `7cc6af1` (the copy: 11 files, 185 insertions, 162
deletions), `6cfa20b` (the hint line: 4 files, 20 insertions, 43 deletions) and
`b6e3bd4` (PROJECT_STATE: 1 file, 86 insertions, 19 deletions).

## What I did

The dev server was restarted and `node_modules/.vite` was cleared before any
code was written, because the server that was running had started at 16:11,
which is before both run 0015 and run 0016, and a Vite transform cache that old
is the thing that produced a phantom `ReferenceError` in run 0011. The pane came
back on port 5173, `?project=flat-1-two-storey.json` loaded two floors,
`window.__app` exposed its nine keys, and the console held no errors. Only then
did the run check out `reskin-1a`, which was already the checked-out branch
rather than `main` as assumption 1 expected.

**Stage 2e, the sheet, commit `a74841e`** (3 files, 619 insertions, 287
deletions).

- `src/ui/validationPanel.ts` was rewritten around two builders. `buildHeader`
  emits the title, a 340px block holding an 8px proportional severity bar over
  the tier counts, one metrics line and the close control. `buildRail` emits one
  300px card per violation followed by the two informational cards.
- `src/style.css:557-800` replaces the old `#validation-panel` block with the
  sheet: `position: absolute; left: 0; right: 0; bottom: 0; height: 256px;
  border-top: 1px solid var(--line-paper)`, plus the `vs-*` classes for the
  header, the rail and the cards. The `vp-*` rules that only the vertical panel
  used were deleted, but `.vp-header`, `.vp-title` and `.vp-close` stayed,
  because `#shortcuts-panel` and the unit-export dialog read them.
- `src/main.ts:663-701`: `runCheck` adds `sheet-open` to `#viewport` and
  `clearValidation` removes it, and the Check Layout button became
  `validated ? clearValidation() : runCheck()`.
- `src/main.ts:59` moved the `viewport` const up from line 933, because
  `clearValidation` now reads it and can run during the `?project=` load, which
  would have hit the temporal dead zone.

**Scrollbars, commit `cd37a3e`** (1 file, 35 insertions). `src/style.css:82-114`
sets `scrollbar-width: thin` and `scrollbar-color: var(--line-paper) var(--bg)`
on `*` for Firefox, then a `::-webkit-scrollbar` block for Chromium giving a
10px bar with a paper track, a hairline thumb inset by a 2px paper border and
`var(--meta)` on hover. Nothing is rounded.

**Stage 2f, the copy, commit `7cc6af1`** (11 files, 185 insertions, 162
deletions). Every changed string is listed under Findings below.

**The hint line, commit `6cfa20b`** (4 files, 20 insertions, 43 deletions).
`index.html` lost the `#hint` div from `#bottom-left` and gained two entries at
the top of the shortcuts list. `src/ui/palette.ts:63-69` adds a caption under
the PLACE heading through a new `caption()` helper that reuses the existing
`.hint-text` class. `src/style.css` lost the `#hint`, `#hint kbd` and
`#bottom-left #hint` blocks, and `#bottom-left` dropped the `right: 256px` it
held to clear the Display card. `src/main.ts:513` no longer hides `#hint` when
the diagram opens.

**PROJECT_STATE, commit `b6e3bd4`** (1 file, 86 insertions, 19 deletions).
Section 2s now covers runs 0016 and 0017 and describes the sheet's wiring, the
three decisions the handoff left open, the wheel condition, the lift values and
the copy mapping. Four references elsewhere in the file described the vertical
panel as the only thing that exists and now name both, since `main` and the
branch disagree until someone merges: the systems table at line 62, the
selection readout at 708, the glazing line at 1105 and the run-0012 QA note at
2482.

## Findings

**The sheet against what the handoff specified.** Every value the README gives
was met. The sheet is 256px tall spanning the viewport with a 1px
`var(--line-paper)` hairline on top. The header row carries `LAYOUT CHECK`, then
a 340px summary block whose bar is 8px, then the metrics line, then the ✕. The
rail holds 300px cards with a 3px top border in the severity colour, each
carrying the tier label, the rule id, the message, a target chip and a suggested
action. Opening runs `--dur-panel` with `--ease-out` through one `vs-rise`
keyframe, and because re-running Check Layout replaces the sheet's children
rather than the container, the slide does not run a second time.

The handoff was silent on three points and each was decided here.

Repeated rules keep one card each, and where a rule fires more than once its
chip carries an ordinal, so flat-1 shows `OR1 (1/2)` and `OR1 (2/2)`. Merging
them into one `OR1 ×2` card was the obvious alternative and it cannot work,
because hover emphasis highlights one violation's rooms in both the diagram and
the 3D view, and a merged card would have two different sets to point at with no
way to choose. The ordinal makes the duplication legible without breaking that.

The severity bar's fourth segment counts rooms that appear in no violation's
`nodeIds`, computed by `clearRooms` at `validationPanel.ts:103`. The first
version subtracted the violation total from the room count, which measured
nothing useful: flat-1 carries 17 violations across 13 rooms, so the subtraction
floored at zero and the bar rendered as three colours at full width, losing
exactly the reference length the fourth segment exists to provide. Counting
unflagged rooms is bounded by the room count by construction, so a clean
dwelling reads as a bar of plate and a bad one as a bar of colour.

The suggested actions are a display-only map, `ACTION_BY_RULE` at
`validationPanel.ts:46`, keyed by rule id and covering 34 of the 41 rules. The
seven without an entry are the notes, where the point is that there is nothing
to do, and a card with no entry simply renders no action line, which is the
design prototype's own empty-hint state. Adding an `action` field to `RULES` was
the alternative, and it was rejected because the prompt's constraints put
`validate()`'s returned data out of bounds and `rules.test.ts` asserts against
that data.

**The wheel condition, quoted from `validationPanel.ts:392-399`.**

```ts
if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
const max = rail.scrollWidth - rail.clientWidth;
if (max <= 0) return;
const roomLeft = e.deltaY > 0 ? max - rail.scrollLeft : rail.scrollLeft;
if (roomLeft <= 0) return;
rail.scrollLeft += e.deltaY;
e.preventDefault();
```

The design prototype checked only `max <= 0`, which still traps a trackpad at
either end of the rail. The `roomLeft` line is the difference: the event is
consumed only while the rail can still move the way the wheel asks. Five probes
against the live rail on flat-1, where `max` is 5247, confirm it. A downward
wheel at `scrollLeft` 0 was prevented and moved the rail to 100. An upward wheel
at 0 was not prevented and the rail stayed at 0. A downward wheel at 5247 was
not prevented and the rail stayed at 5247. An upward wheel at 5247 was prevented
and moved it to 5147. A downward wheel at 2624 was prevented and moved it to
2724.

**The overlay lift, measured on flat-1 in the pane.** Closed, `#bottom-left` and
`#view-controls` both compute `bottom: 16px`. Open, both compute `272px`, which
is the 256px sheet plus the original 16px. `#graph-legend` and
`#selection-readout` were lifted too, which the handoff does not ask for: the
legend sits at `bottom: 16px` and the readout at `56px`, both inside the band
the sheet covers, so leaving them would have buried them. They compute `272px`
and `312px` open. All four carry a `bottom` transition over `--dur-panel` with
`--ease-out`.

**Every string the copy rewrite changed.**

| File and line | Before | After |
|---|---|---|
| `src/ui/validationPanel.ts:36` | `hard: "Hard"` | `hard: "Must fix"` |
| `src/ui/validationPanel.ts:37` | `soft: "Soft"` | `soft: "Worth a look"` |
| `src/ui/validationPanel.ts:38` | `note: "Note"` | unchanged |
| `index.html:57` | `Hard` | `Must fix` |
| `index.html:58` | `Soft` | `Worth a look` |
| `src/main.ts:780` | `${hard.length} HARD violation(s)` | `${hard.length} MUST FIX issue(s)` |
| `README.md:20` | `🔴 hard (likely failure), 🟡 soft (atypical, not wrong), 🟢 note (informational).` | `🔴 Must fix (likely failure), 🟡 Worth a look (atypical, not wrong), 🟢 Note (informational).` plus a sentence naming `hard`, `soft` and `note` as the internal names |
| `README.md` rule table | `🔴 hard` ×14, `🟡 soft` ×21, `🟢 note` ×6 | `🔴 Must fix`, `🟡 Worth a look`, `🟢 Note` |
| `README.md:113` | `**Structure** is an x-ray: it hides the walls and glazing of those same elastic rooms…` | `**Structure** shows the fixed layer: bathrooms, kitchen and stairs stand as built…` |
| `docs/rules-list.html` | 37 `<span class="tier …">` chips, the three index headings, the Severity tiers paragraph | same swap; index rewritten to `Must fix (14)` / `Worth a look (21)` / `Note (6)` |
| `docs/rules-reference.html` | 38 tier chips including the cover's Tiers row, plus the tier-introduction paragraph at line 142 | same swap; the paragraph now names both vocabularies |
| `docs/rules-list.md` | 37 headings of the form `### E2 — hard` | `### E2 — Must fix` and the two others |
| `src/ui/palette.ts:239` | `${def.name}` | `${paletteName(def)}`, which rewrites a leading `Circulation` to `Hall` |
| `src/core/floorManager.ts:110` | `"Structure" x-ray view flag` | `"Structure" fixed-layer view flag` |
| `src/core/floorManager.ts:356` | `re-apply the x-ray view` | `re-apply the Structure view` |
| `src/scene/cutaway.ts:75` | `the Structure x-ray view` | `the Structure fixed-layer view` |
| `PROJECT_STATE.md:45` | `the Structure x-ray outranks it` | `the Structure fixed-layer view outranks it` |

`Circulation` reads as `Hall` in the palette and nowhere else, which is what
assumption 4 asked for, and checking it turned up a hard reason the rename could
not go deeper. `def.name` is not only a caption: `adjacencyGraph.ts:170` and
`:202` copy it into every graph node's `label`, and `unitExport.ts:213` copies it
into the exported unit's `roomTypes`, which is a bridge-format payload the
bottom-up repository reads. Renaming the preset in `modules.ts` would therefore
have changed a file format, which the prompt's constraints put out of bounds.
`paletteName()` at `palette.ts:256` does the substitution at the point of
display, and the palette item's `title` attribute still carries `def.name` so the
underlying preset is one hover away.

**The two remaining x-ray mentions are correct and were left.**
`floorManager.ts:453` and three passages in PROJECT_STATE describe what the view
used to be before run 0013 changed it, in the past tense, so rewriting them
would have destroyed the history they exist to record.

**Docs drift, measured rather than guessed.** `docs/rules-list.html` and
`docs/rules-list.md` each document 37 of the 41 rules in `src/core/rules.ts`.
FAC1, OR2, ST3 and WET1 have no entry at all, and E1 is filed as a note where
the code has it hard. The tier index in `rules-list.html` claimed 11 hard, 19
soft and 7 note against the code's actual 14, 21 and 6, and four places across
the three documents claimed a rule total of 35 or 36. This run corrected the
totals and the index, because it was rewriting those exact lines and shipping a
known-wrong number under new words would be worse than leaving it, but it did
not write the four missing rule entries or move E1, because that is a docs
regeneration rather than a copy pass.

**The hint line.** Everything it listed except one sentence was already in the
shortcuts panel behind the `?` button: R rotate, M mirror, Del delete and `?`
shortcuts were all there, and click-to-select and drag-to-move were not. So the
line was removed, its unique sentence became a palette caption reading `Drag a
tile onto the grid to place it. Press ? for every shortcut.`, and the two
missing bindings were added to the shortcuts list, which went from 10 entries to
12.

## Evidence

**The two new canonical sheet texts.** Both were read from
`document.getElementById('validation-panel').innerText` in the pane immediately
after clicking Check Layout, with the fixture loaded through
`?project=<name>.json`.

`flat-1-two-storey.json`, header and counts:

```
LAYOUT CHECK
1 must fix
11 worth a look
5 note
checked just now
Circulation 24% of interior (F0 23% · F1 26%) · depth max 5, mean 2.9 · public 0.5 vs beds 3.5
✕
```

Its rail, one card per block:

```
MUST FIX      H1        Orphaned room — no path of adjacencies (including stairs) reaches an entrance.
                        Bathroom — Large (F1)   add a door on a route back to the entrance
WORTH A LOOK  C1        Orphaned corridor — a circulation space connected to nothing (dead space).
                        Circulation (F1, 8,14)  give it a door, or remove it
WORTH A LOOK  A1        Circulation narrower than 1.2 m (below accessible width) — 2 narrow cells.
                        Circulation (F1, 8,14)  widen it by one cell
WORTH A LOOK  OR1 (1/2) Room is lit only from the north (no direct sun).
                        Living Room (F0)        turn the project north, or move it to another edge
WORTH A LOOK  OR1 (2/2) Room is lit only from the north (no direct sun).
                        Bedroom — Small (F1)    turn the project north, or move it to another edge
WORTH A LOOK  G1        No bathroom is reachable without passing through a bedroom (guest access).
                        Whole dwelling          give one bathroom a door off the hall
WORTH A LOOK  AC1 (1/2) Bedroom shares a wall with a stair — stair noise against a sleeping room.
                        Bedroom — Large (F0) ↔ Stair (dogleg) (F0)   put a hall or a store between them
WORTH A LOOK  AC1 (2/2) Bedroom shares a wall with a stair — stair noise against a sleeping room.
                        Stair (dogleg) (F0) ↔ Bedroom — Small (F1)   put a hall or a store between them
WORTH A LOOK  DP1       Room is unusually deep in the layout (5 hops from the entrance).
                        Bathroom — Small (F1)   add a door that shortens the route
WORTH A LOOK  N1        Floor 1 is circulation-heavy (26% of interior area).
                        Circulation (F1, 8,10), Circulation (F1, 8,14)   absorb some corridor into the rooms beside it
WORTH A LOOK  WET1 (1/2) Floor 0: wet rooms form 2 separate groups, at (4,6), (8,14). Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.
                        Kitchen (F0), Bathroom — Small (F0, 11,14), Bathroom — Small (F0, 8,14)   move the wet rooms together
WORTH A LOOK  WET1 (2/2) Floor 1: wet rooms form 2 separate groups, at (10,14), (5,15). Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.
                        Bathroom — Large (F1), Bathroom — Small (F1)   move the wet rooms together
NOTE          DR2       Bedroom has 3 doors — unusual for a private room.
                        Bedroom — Small (F1)
NOTE          S5        Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation.
                        Kitchen (F0) ↔ Living Room (F0)
NOTE          S7 (1/3)  En-suite bathroom (accessed via bedroom).
                        Bathroom — Small (F0, 11,14)
NOTE          S7 (2/3)  En-suite bathroom (accessed via bedroom).
                        Bathroom — Small (F0, 8,14)
NOTE          S7 (3/3)  En-suite bathroom (accessed via bedroom).
                        Bathroom — Small (F1)
GLAZING ORIENTATION     Living Room (F0) N · Kitchen (F0) S · Bedroom — Small (F0) S · Bedroom — Large (F0) S · Recreation Room (F0) E · Bedroom — Small (F1) N · Bedroom — Large (F1) S
DEPTH FROM ENTRANCE · 10 ROOMS
                        Living Room (F0) 0 · Kitchen (F0) 1 · Recreation Room (F0) 1 · Bedroom — Large (F0) 3 · Bedroom — Small (F0) 3 · Bathroom — Small (F0, 11,14) 4 · Bathroom — Small (F0, 8,14) 4 · Bedroom — Large (F1) 4 · Bedroom — Small (F1) 4 · Bathroom — Small (F1) 5
```

`flat-1-no-stair.json`, header and counts:

```
LAYOUT CHECK
1 must fix
6 worth a look
4 note
checked just now
Circulation 19% of interior (F0 17% · F1 23%) · depth max 4, mean 2.3 · public 0.5 vs beds 3.0
✕
```

Its rail:

```
MUST FIX      ST3       Floor 1 is not reachable by stairs from the entrance floor. Every space there is cut off for this one reason.
                        Whole dwelling          add a stair reaching that floor
WORTH A LOOK  A1        Circulation narrower than 1.2 m (below accessible width) — 2 narrow cells.
                        Circulation (F1, 8,14)  widen it by one cell
WORTH A LOOK  OR1 (1/2) Room is lit only from the north (no direct sun).
                        Living Room (F0)        turn the project north, or move it to another edge
WORTH A LOOK  OR1 (2/2) Room is lit only from the north (no direct sun).
                        Bedroom — Small (F1)    turn the project north, or move it to another edge
WORTH A LOOK  G1        No bathroom is reachable without passing through a bedroom (guest access).
                        Whole dwelling          give one bathroom a door off the hall
WORTH A LOOK  WET1 (1/2) Floor 0: wet rooms form 2 separate groups, at (4,6), (8,14). Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.
                        Kitchen (F0), Bathroom — Small (F0, 11,14), Bathroom — Small (F0, 8,14)   move the wet rooms together
WORTH A LOOK  WET1 (2/2) Floor 1: wet rooms form 2 separate groups, at (10,14), (5,15). Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.
                        Bathroom — Large (F1), Bathroom — Small (F1)   move the wet rooms together
NOTE          DR2       Bedroom has 3 doors — unusual for a private room.
                        Bedroom — Small (F1)
NOTE          S5        Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation.
                        Kitchen (F0) ↔ Living Room (F0)
NOTE          S7 (1/2)  En-suite bathroom (accessed via bedroom).
                        Bathroom — Small (F0, 11,14)
NOTE          S7 (2/2)  En-suite bathroom (accessed via bedroom).
                        Bathroom — Small (F0, 8,14)
GLAZING ORIENTATION     same seven rooms and sectors as flat-1
DEPTH FROM ENTRANCE · 7 ROOMS
                        Living Room (F0) 0 · Kitchen (F0) 1 · Recreation Room (F0) 1 · Bedroom — Large (F0) 3 · Bedroom — Small (F0) 3 · Bathroom — Small (F0, 11,14) 4 · Bathroom — Small (F0, 8,14) 4
```

**The counts survived the rewrite.** flat-1 reported `12 issues (1 hard, 11
soft)` before this run and now reports 1 must fix and 11 worth a look, which is
the same 12. The no-stair fixture reported `7 issues (1 hard, 6 soft)` and now
reports 1 must fix and 6 worth a look, the same 7. The five and four notes are
also unchanged; they were always counted separately from the issue total and
still are, they are simply now printed beside it rather than only as a section
heading.

**The severity bar's proportions on flat-1**, read from the live elements:
`hard` flex 1 at 17px, `soft` flex 11 at 187px, `note` flex 5 at 85px, `clear`
flex 3 at 51px, summing to 20 units across the 340px block. Three of the
dwelling's 13 rooms appear in no violation.

**Machinery after the final stage.** `npx tsc --noEmit` exits 0 with no output.
`npx vitest run` gives 3 test files and 33 tests passed in 1.96s, and
`src/core/rules.test.ts` was not edited at any point in this run, which is the
check that the copy rewrite stayed above `validate()`. `npm run test:slow` gives
1 file with 4 passed and 1 expected fail in 8.98s, the expected fail being the
`it.fails` case that documents the balcony french-window export defect.
`npm run build` succeeded in 20.18s, emitting `dist/assets/index-BRdmxQ3Y.css`
at 24.27 kB and `dist/assets/index-B1EFbCMp.js` at 3,382.66 kB.

**Live machinery in the pane, all after stage 2f.** The loader took both
fixtures. `window.__app` exposed `floors, camera, scene, controls, renderer,
enterPlanMode, exitPlanMode, isPlanMode, capture`. `enterPlanMode()` then
`isPlanMode()` returned true and `exitPlanMode()` returned it to false. The four
Display toggles all responded and all returned to their starting state, with the
one apparent exception being Structure, which switched off when Interface was
clicked because the two are mutually exclusive by design. The console held no
errors across the whole run.

**The sheet's two close paths.** Starting from open, clicking `.vs-close` gave
`display: none` and removed `sheet-open`. Clicking Check Layout then gave
`display: flex` with the class back, clicking it again gave `none`, and a third
click gave `flex`. Escape was not touched and keeps its three existing meanings.

## Artifacts produced

Canvas captures, both byte-checked because `capture()` reports `ok: true` while
writing a 0-byte file when the pane is not compositing:

- `captures/sheet-flat1-model.png`, 112,404 bytes, flat-1 in model view with the
  sheet open.
- `captures/sheet-nostair-model.png`, 112,181 bytes, the no-stair fixture in the
  same state.

Pane screenshots, taken through the browser pane rather than the canvas
capture, because the sheet is DOM and never appears in a canvas capture. They
are in the run transcript rather than on disk:

- flat-1 with the sheet open, showing the header, the summary block, the metrics
  and the first three rail cards, with the Display card and the undo/redo pair
  lifted clear.
- flat-1 with the rail scrolled to `scrollLeft` 5247, showing the two
  informational cards that close it and their own themed scrollbars.
- The no-stair fixture with the sheet open, showing the ST3 card.
- The palette showing `Hall — Single` and `Hall — Double` under CIRCULATION &
  OUTDOOR, and the new caption under PLACE, in every one of the above.

## Decisions and rationale

The informational sections of the old panel needed a home the handoff does not
describe. The header's metrics line takes the circulation share, the depth
summary and the privacy gradient, which is what the README's example line shows,
but the per-room glazing list and the per-room depth list have no place in that
line and dropping them would have removed features, which the constraints
forbid. They became two cards at the end of the rail with a `--plate` top border
and their own vertical scroll, so the rail reads as issues first and reference
material after.

`checked just now` is rendered as a literal string rather than a live
timestamp. The report is dropped on every layout change by
`floors.onLayoutChange`, so a visible sheet can never be stale, and a ticking
"3 min ago" would be motion after arrival for no information.

`#graph-legend` and `#selection-readout` were lifted along with the two clusters
the handoff names. Both sit within the 256px band the sheet covers, so the
alternative was leaving them underneath it, and the lift is two more selectors
in a rule that already existed.

The scrollbar theming was applied through `*` rather than to the three known
scrollers by id. Naming them means the next scroller added is wrong by default,
whereas the universal rule is correct by default and costs one selector.

The hint line's content was split rather than moved wholesale. Moving the whole
sentence into the palette would have put keyboard bindings in a panel about
placing rooms, and those bindings were already listed in the shortcuts panel
that exists for exactly that. So the placement instruction went to the palette
and the two missing bindings went to the shortcuts panel, and nothing is now in
two places.

## Deviations from the prompt

Assumption 1 said the tree would be on `main` with `reskin-1a` at `6245c08` six
commits ahead. The branch and the commit were right, but the tree was already
checked out on `reskin-1a` rather than `main`, so the `git checkout reskin-1a`
in task 0 was a no-op. Nothing else followed from it.

Assumption 2 held. The sheet kept the id `#validation-panel`, so anything
reading that selector still works, and no new selector is needed.

Assumption 3 held on the code and was narrowed on the docs.
`src/core/rules.test.ts` was never opened, `Severity` is unchanged and
`validate()` returns exactly what it returned before. On the documents, the two
rules pages are long prose that uses `hard`, `soft` and `note` both as tier
names and as ordinary English, and mechanically replacing every occurrence would
have produced sentences like "so it fails, must fix". The swap was therefore
applied to the tier chips, the index headings, the cover's tier row and the
passages that define the tiers, and `rules-reference.html`'s narrative keeps the
short words where it is describing the code, with a sentence added at line 142
saying which vocabulary is which.

The prompt did not ask for the scrollbars or the hint line. Both arrived from
Shrey during the run and both were built, each as its own commit so the record
separates them from stages 2e and 2f.

Task 7 asked for the record to land on `main` and the tree to be left on
`reskin-1a`, and doing exactly that would have left the planning session reading
a stale file. `_cowork/CONTEXT.md` is tracked, so its content is branch-scoped,
and the copy in the working tree is whichever branch is checked out. Checking
`reskin-1a` back out therefore restored a CONTEXT.md that still said
`**Branch:** main` and knew nothing of either reskin run. So after the record
commit on `main`, `main` was merged into `reskin-1a`. The two commits it brought
across touch nothing but `_cowork/`, which means no code moved and the branch is
now a strict superset of `main`. The branch's own CONTEXT.md was then updated to
describe where the tree actually is.

Two stale numbers in the documents were corrected in passing, which the prompt
did not ask for either. The rule total read 35 or 36 in four places against an
actual 41, and the tier index read 11/19/7 against an actual 14/21/6. Both sat
on lines the copy rewrite was already replacing, so leaving them would have
meant knowingly reprinting a wrong number in new words.

## Blocked / did not do

Nothing in the prompt was left undone.

The four undocumented rules in the two rules-list documents, FAC1, OR2, ST3 and
WET1, and E1's tier being wrong there, were left as they are. Writing those
entries means writing the why-and-how prose the rest of the document carries for
every rule, which is a docs regeneration and belongs in its own run.

Neither branch was pushed, as the constraints required.

## Open questions for you

1. The palette says `Hall` while the layout check and the bubble diagram say
   `Circulation`, because the handoff scopes the rename to the palette and
   `def.name` turned out to be a serialised value rather than a caption. The
   split is now visible in one screen. Closing it means either giving the graph
   its own display-name layer, which is about fifteen lines in
   `adjacencyGraph.ts` and leaves the export untouched, or accepting that the
   two vocabularies coexist. Which reads better in the 4 August review is a
   judgement about the audience rather than the code.
2. The suggested actions on the cards are advice the tool now gives, which is a
   step past the advisory-not-blocking stance the rules have held so far. A rule
   that says "Circulation narrower than 1.2 m" describes a fact, whereas "widen
   it by one cell" tells someone what to do. If the thesis argument is that the
   tool reports and the designer decides, these 34 strings need to be defended
   or dropped, and dropping them is deleting one object literal.
3. The sheet consumes 256px of viewport height whenever it is open, which on a
   laptop is roughly a third of the model. The handoff's answer is that the
   sheet closes, and Check Layout now toggles it. Whether a checked layout
   should stay open while someone edits, or whether the sheet should collapse to
   just its header, is a question about how the check is meant to be used.

## Suggested next prompt

Regenerate the two rules-list documents from `src/core/rules.ts` so they stop
being four rules behind. `docs/rules-list.html` and `docs/rules-list.md` each
document 37 of 41 rules; FAC1, OR2, ST3 and WET1 need the same why-and-how pair
every other entry carries, and E1 needs moving from the note tier to hard, where
`rules.ts:493` puts it. The tier index and the totals were corrected in run 0017
and should be re-derived rather than trusted. The run should report which
entries it wrote, quote each new rule's why-and-how, and confirm that the two
documents and `README.md`'s table now agree with each other and with the code on
all 41 ids and tiers. `docs/rules-reference.html` is a separate narrative
document and should be left alone unless the run finds a rule described there
that no longer exists.
