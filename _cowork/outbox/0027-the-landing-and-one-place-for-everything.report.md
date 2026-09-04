---
id: "0027"
title: The landing screen, and one place for everything
source: 0027-the-landing-and-one-place-for-everything.md
status: complete
branch: run/0027
commit: 293e746
completed: 2026-09-04
---

## Summary

The prompt asked for a first screen, an empty state that reports no fault
before a resident has made one, two real steps instead of one crowded
screen, and a cull of the three controls that all claimed to save. All
seven tasks landed. Two pure modules carry the new decisions:
`src/core/flatState.ts` holds one phase every part of the chrome reads, and
`src/core/journey.ts` holds the six steps the landing renders and the
building app is meant to render later. The editor is now one panel at a
time, with the flat's figures in the top bar while drawing and under the
drawing while sending. Fast tests went from 198 to 223 across seventeen
files, `tsc` and `npm run build` stay clean, both fixture baselines are
still 12 and 7, and the whole thing was driven live against `netlify dev`
including a real send that the store's own poll confirms.

## What I did

- Created `src/core/flatState.ts` (79 lines): `flatPhase`, `canSend`,
  `showsDropHint`, `checksRun`, `showsLanding`, and the empty screen's own
  four strings.
- Created `src/core/journey.ts` (65 lines): `JOURNEY`, `journeyIndex`,
  `journeyMarks`.
- `index.html:19-88` — the top bar rebuilt: brand, two step tabs, the
  figures strip, a spacer, then the group chip, the view switcher, Units,
  Open and help.
- `index.html:93-112` — `#drop-hint`, `#send-caption` and `#flat-readout`
  inside the viewport.
- `index.html:179-183` — `#reset-view` moved into `#view-controls` as a
  fifth chip.
- `index.html:207-246` — the send panel: a chevron header, the headline,
  the two group fields, the red button, the names line and the results.
- `index.html:306-366` — the landing, its join form and the journey strip's
  empty container.
- `src/main.ts:1031-1044` — the DOM handles for both figure read-outs and
  the drop hint.
- `src/main.ts:1105-1128` — `placedRooms` and `habitableRooms`.
- `src/main.ts:1145-1226` — `refreshFlatFigures`, the one function that
  reads the phase and writes the numbers, the chip, the drop hint, the step
  gate and the send button.
- `src/main.ts:1230-1266` — `setStep` and `syncStepTabs`.
- `src/main.ts:1272-1391` — `BUILDING_APP_URL`, `showLanding`,
  `hideLanding`, `renderJourney` and the four door handlers.
- `src/main.ts:153-161` — `commitHistory` now refreshes the figures, the
  gate and the hint through that one function.
- `src/main.ts:673-691` — the Open menu: `Open project` and `Start over`,
  no save path.
- `src/main.ts:934-940` — the Check Layout listener removed; the chip is
  the way in.
- `src/main.ts:1896-1907` — a file opened from the landing dismisses it on
  success only.
- `src/style.css:1929-2031` — the step tabs as real tabs, the figures
  strip, the spacer.
- `src/style.css:2650-2743` — `body[data-step]`, the step-02 read-out, the
  caption and the drop hint.
- `src/style.css:2745-2978` — the landing, its join form and the journey.
- Removed: `#check-layout` from the bar, `#menu-save`, the run-0025 session
  fold (`#save-session-summary`, `syncSessionFold`, `unfoldSessionFields`)
  and the save column's three-card body.

## Findings

Two things the prompt could not have known, both found by running the app
rather than by reading it. A `disabled` button fires no click event at all,
so a step 02 tab locked with `disabled` answered a resident who pressed it
with silence; it carries `aria-disabled` now and `setStep` is what refuses,
which is why pressing it says the reason out loud. And a hidden browser tab
runs no animation frames, so the area figure's count-up tween never wrote
its own result there and the number sat on a stale dash while the storeys
and glazing beside it were right; `animateCount` writes the value straight
out when `document.hidden`, since nobody is watching it move.

The bar's own layout had to be told what may give way. Without it the
figures strip first squeezed the brand down to its 22px mark, and once the
brand was pinned it pushed Open and the help button off the right edge
entirely. The rule now is that the brand and the controls hold their width
and the strip's hint is the one thing that shrinks, ellipsing at 1440×900
with the full sentence still on its `title`.

Two numbers were wrong in ways only a real flat showed. Step 02's fourth
figure counts rooms, and counting every placed instance made
`flat-2-single-storey` read 29 rooms, because a 1×1 hall tile and a
balcony tile are placed the same way a bedroom is; counting only what
`unitExport.ts`'s own `kindOf` calls a room gives 7. And the flat's name in
that read-out said "Unit 1" beside a line promising "Flat 6 and Unit 6",
because the design number is proposed asynchronously and the figures are
drawn long before the manifest and the group's flats come back; the name is
written by `syncSaveDialog` now, which is the function that runs again when
the number lands.

Run 0026 showed `0 m²` for a flat with rooms but no way in. That reads as a
measurement rather than as the absence of one, so a figure is now shown
only when the unit builds and reads a dash otherwise, with the chip beside
it saying which case it is. `unitStats` over one build stays the only
source any of these numbers has.

Fast tests went from 198 passed in fifteen files to 223 in seventeen. Slow
tests are unchanged at 26 passed plus the one expected fail, so both
Check-Layout baselines are still 12 and 7, and `src/core/saveFiles.ts` was
not touched, so the three downloads are still byte-identical.

## Evidence

Everything below ran against `netlify dev` on `http://localhost:8888`, at a
1440×900 viewport in the Browser pane, except where a plain Vite server on
`http://localhost:5173` is named. The branch state found on `main` was
`94cb98b`, "Merge run/0026: the flat app on paper, and two small store
fixes", so assumption 1 held and nothing had to stop.

**1. The commits.**

```
bad7704 landing: how it goes                      src/core/journey.ts        | 65 +
b8f5ca2 flat: nothing to check yet                src/core/flatState.ts      | 79 +
31b0ed7 ui: one panel at a time, and one thing…   index.html                 | 231 +-
                                                  src/main.ts                | 485 +-
                                                  src/style.css              | 595 +-
                                                  3 files, 1031 insertions(+), 280 deletions(-)
0f971f6 flat: tests for 0027                      src/core/flatState.test.ts | 97 +
                                                  src/core/journey.test.ts   | 63 +
                                                  src/session/session.test.ts| 29 +
f336598 design: the brief's screens section…      13 files, 838 insertions(+), 60 deletions(-)
8fd98ff state: the landing, the two steps…        PROJECT_STATE.md           | 117 +-
                                                  _cowork/CONTEXT.md         | 30 +-
293e746 landing: a file opened from it dismisses  src/main.ts                | 7 +-
```

**2. The landing, live.** Screenshots are viewed inline in this
environment and do not persist as files, as every report from run 0019
onward records, so this is the DOM's own answer. Reading `getComputedStyle`
at 1440×900: the headline "Draw the flat / you want / to live in." is
`"Big Shoulders Display", "Archivo Narrow", Impact, sans-serif` at 78px,
uppercase, `rgb(22, 22, 22)`; the two-sentence lead is `Jost, Futura,
"Century Gothic", sans-serif` at 18px in the same ink; the primary door is
`rgb(214, 52, 28)` on `rgb(236, 230, 216)` text at 76px tall in the display
face; the two other doors are transparent with a `rgb(22, 22, 22)` border;
the ground is `rgb(236, 230, 216)`; the top rule is `rgb(214, 52, 28)` and
10px tall; the two discs are `rgb(242, 180, 28)` and `rgb(29, 79, 163)`.
Those are the brief's ink, red, paper, yellow and blue exactly.

The journey strip rendered six labels in order, "Draw your flat", "Send
it", "Your wishes", "The group", "Your flat in it", "Vote", with classes
`now, ahead, ahead, ahead, ahead, ahead`; the current dot computes
`background rgb(214, 52, 28)` with an ink border and the rest compute
transparent with `rgb(163, 156, 141)`.

What each door did:

- *Start a flat* hid the landing and left `body[data-step]` on `draw`.
- *Join a group* swapped the three doors for two fields. Submitting
  `room 42` / `Ana` wrote nothing and answered
  `a group code is 1 to 32 of a-z, 0-9, - and _`, the store's own rule
  through `whyPublishDisabled`. Submitting `  Room-42 ` / `Ana` stored
  `{"resident":"Ana","code":"room-42"}` under `reconfigure.session`, filled
  the send panel's own two fields with `room-42` and `Ana`, put
  `Group room-42 · Ana` in the bar, hid the landing and left step `draw`.
- *Open a file* opens the same picker the bar's Open menu uses. Driving the
  same `readAndImport` the picker feeds, by dropping
  `testflats/flat-3-terrace.json` on `#viewport`, loaded the flat (the bar
  read 60 m², 1 storey, "All checks pass") and the landing hid itself.
- *Go to your group* is an `<a>` whose `href` is
  `BUILDING_APP_URL + "?session=" + code`, rebuilt from the current group
  every time the landing shows.

**3. Both steps, live.** With `?project=flat-2-single-storey.json`, which
also proves the skip rule, the landing stayed hidden
(`#landing.hidden === true`) and step 01 read:

```
fig-area 70   fig-storeys 1   fig-glazing 3.6   chip "All checks pass"
step-send aria-disabled=false
```

There is no right-hand panel in step 01: `#save-column`, `#flat-readout`
and `#send-caption` all compute `display: none` under
`body[data-step="draw"]`. Pressing 02 switched `body[data-step]` to `send`
and gave:

```
sidebar        display: none
.tb-figures    display: none
fr-name        "Unit 6"      fr-area 70    fr-rooms 7
save-names     "It becomes Flat 6 and Unit 6, next free in the library and room-42"
save-go        disabled: false
```

On a flat with no way in, a single Living Room dropped on an empty grid,
step 02 read `aria-disabled="true"` with the title "Place an entrance on an
outside edge first, so the flat has a way in.", pressing it left
`body[data-step]` on `draw`, and the toast carried that same sentence.
After the entrance exists, which the loaded fixture shows, the tab reads
`aria-disabled="false"` and opens.

The send itself is run 0026's path with only its location changed. From
step 02, with the three file outputs unticked so the run left nothing on
disk, pressing the red button gave the result line
`Group — Sent to run0027 as Unit 6 · open Units to see your group.` and
`GET /api/session/run0027` answered:

```json
{"code":"run0027","flats":[{"id":"unit-6","resident":"Ana","label":"Unit 6",
"version":1,"changed":true,"preview":true,"bbox":[0,0,15,14],"floors":1,
"areaCells":194,"publishedAt":"2026-09-04T08:32:20.575Z"}],
"residents":[],"building":null}
```

**4. The empty state, live.** On a cold load with nothing placed:

```
fig-area — ,  fig-storeys — ,  fig-glazing —
chip     "Drag a room onto the grid to start. Nothing is checked until you do."
         class "chip chip-hint", disabled
drop-hint .show = true          step-send aria-disabled = "true"
fr-name  "Untitled"
```

Immediately after one Living Room was dropped on the grid the same three
reads gave `— / — / —` again but for a different reason, the chip turned to
`1 must fix` with class `chip chip-acc`, `drop-hint` lost `.show`, and step
02 stayed shut. Loading a flat that does build turns all three into
`70 / 1 / 3.6` with `All checks pass`, which is the transition in full.

**5. The redundancy cull.** Every control that moved:

| Control | Was | Is now | What it does |
|---|---|---|---|
| Save / Open | top bar, a menu with `Save…` and `Open project` | top bar, labelled `Open` | holds `Open project` and `Start over` only |
| `Save…` menu item | opened the column's "More" | gone | "More" is one click away on step 02 |
| Check Layout | top bar button | the check chip, in the bar in step 01 and under the drawing in step 02 | opens the same `runCheck()` report, which still closes from its own ✕ |
| Frame View | top bar button | `#view-controls`, a fifth chip | frames the whole flat, unchanged |
| The column's `SAVE` toggle | a labelled header on the save column | a chevron on the send panel | collapses the panel to its tab |
| The three group fields' fold | run 0025's summary line and "change" | gone | both fields stay open on step 02 |
| The flat's three numbers | the column's "Your flat" card | the bar's strip in step 01, under the drawing in step 02 | live figures, unchanged arithmetic |
| Send | the column's red button | the send panel's red button on step 02 | the same `runSave` |
| Model / Plan / Diagram, Units, ? | top bar | top bar | unchanged |

Searching the live DOM for "save", over every text node plus every `title`,
`aria-label` and `placeholder`, returns exactly one hit:

```
"Saved with the project, never in the unit export. \"Avoid\" drives rule OR2,
 which reports any habitable room or kitchen glazed ONLY that way. \"Prefer\"
 is recorded for the brief and drives no rule."
```

That is the palette's orientation-preference note, and it describes where a
setting is stored rather than offering to save anything. Zero attribute
hits. The bar's own controls read `Model, Plan, Diagram, Units, Open ▾,
Open project, Start over, ?` and the view cluster reads `Cutaway, Seeds,
Structure, Interface, Frame`.

**6. The journey model.** `src/core/journey.ts`, 65 lines: `JOURNEY` as six
`{id, label, app}` records, `journeyIndex(id)`, and `journeyMarks(currentId)`
returning one of `done`/`now`/`ahead` per step. There is one call site in
this repo, `renderJourney` in `src/main.ts:1314-1336`, which builds the
strip's dots and labels and the rules between them from that array and
nothing else. The building app is the intended second call site, which is
why the module is exported and documented rather than inlined; nothing in
this repo can prove that half.

**7. What was applied, and what was not.** `Landing.dc.html` was applied
whole: the red rule, both discs, the brand and the ETH credit line, the
88px headline (78px here, so three lines still fit at 1440 wide), the
two-sentence lead, the three doors, the "Already sent your flat?" aside and
the journey strip. `FlatDraw.dc.html` was applied for the bar and the
layout: brand, two steps, the numbers strip behind a rule, the view chips
and the three bring-things-in controls at the right, the palette at the
left, the drawing filling the middle and the view cluster in the bottom
right corner. `FlatSend.dc.html` was applied for its screen: no palette,
the caption above the flat, the flat framed whole, the figures and the
check chip beneath it, and the headline, two fields, red button, note and
folded More at the right. `FlatEmpty.dc.html` was applied for its VALUES,
the dashes, "Untitled", the hint sentence, the sleeping Send and the one
ghost tile, but not for its layout, which still shows run 0026's
three-card right column that tasks 3 and 4 replace.

Not applied, with reasons. The wireframe's view cluster reads
`Cutaway / Solid / Frame`; this app's cluster reads
`Cutaway / Seeds / Structure / Interface / Frame`, because the constraint
says no control is deleted and Seeds, Structure and Interface are three
real view layers with no home elsewhere. The wireframe's bar carries no
group chip; `#tb-session` stayed, because the cull's own list does not name
it and it is a read-out rather than a control. The wireframe's input is a
static div with a blinking red block; the app uses real inputs with
`caret-color: var(--accent)`, which is the same idea on a field a resident
can type in. The brief's building-app screens, its six numbers and its
radar belong to the packer's runs rather than to this one.

**8. Test counts and the three downloads.** `npx vitest run` reported 198
passed in fifteen files before this run and 223 in seventeen after: the new
`flatState.test.ts` at 17 cases, `journey.test.ts` at 6, and 2 more in
`session.test.ts` for a landing join writing what the send panel reads
back. `npm run test:slow` reported `26 passed | 1 expected fail` both
before and after, so the `flat-1-two-storey` and `flat-1-no-stair`
baselines are still 12 and 7. `src/core/saveFiles.ts` and
`src/core/savePlan.ts` were not touched, and `saveFiles.test.ts`, which
pins both downloads against a committed unit file's own bytes, passed both
times, so the three downloads stay byte-identical. `tsc --noEmit` and
`npm run build` both finish clean.

**9. The skills.** Four SKILL.md files were read from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\…\skills\`.

`design-automation` §2.1, production rules, is what `src/core/flatState.ts`
is shaped by: one IF-THEN over one state value, with the numbers, the chip,
the drop hint, the Send button and the step tab all reading the same
answer, so none of them can drift. Its §1.4 hard-versus-soft rule split
also settled that the gate uses the build's own refusal rather than a
second opinion about entrances.

`explain-code` contributed its method rather than its voice: read what each
bar control actually does before moving it, and be able to say both what it
does and why it is where it is. That produced the table in section 5 above,
and it caught that Check Layout was a TOGGLE rather than an opener, which
is why the chip only had to open the report and the panel's own ✕ still
closes it. Rejected: its tone. It asks for analogies, ASCII diagrams and a
conversational register, all of which `WRITING.md` forbids in this report.

`interoperability` §3.1 and §3.7 settled the shape of "Go to your group":
two tools that already share a store hand over the KEY and let the far side
read, rather than pushing a payload through the link. Rejected: the rest of
it, which is IFC, Revit, Speckle and coordinate systems, none of which this
app has.

`data-driven-design` §1.3, the data-to-design pipeline, is the argument for
the journey being a model with rendering downstream of it rather than
labels written into the landing's markup, which is what lets the building
app render the same six steps without sharing code. Rejected: its GIS,
sensor and occupancy material, which has no bearing here.

No other AEC skill was read, as the prompt asked.

**10. Contradictions, and my own assumptions.** The prompt's six
assumptions all held. `main` carried run 0026 (assumption 1, `94cb98b`);
the app booted straight into the editor with no screen concept and both URL
parameters already read (2); `#save-column` and `#save-column-toggle`
labelled "Save" sat at `index.html:173` and `:174` exactly as described
(3); the bar carried the six controls named (4); the check line already
came from the same `validate()` and `computeDwellingGraph()` call (5); and
the baselines were 12 and 7 (6). Assumption 4 is complete but not
exhaustive: the bar also carried `#tb-session` and a pair of decorative,
unclickable step labels, which is what became the two real tabs.

My own assumptions, and what each costs:

- "The flat has a way in" is read as `buildUnitExport` succeeding rather
  than as an entrance existing. A flat with an entrance but a disconnected storey
  therefore also keeps step 02 shut. The cost is that the gate's reason
  names the entrance while the real fault might be the connection; the
  gain is that the tab can never open onto a send that would fail anyway.
- Step 02's fourth figure counts habitable rooms, restating
  `unitExport.ts`'s own `kindOf` test rather than importing it, since that
  function is internal to the export. If `kindOf` changes, this must be
  changed with it.
- A figure reads a dash when the unit will not build. This diverges from
  `FlatDraw.dc.html`, which shows real numbers beside a must-fix chip.
- "Start over" destroys nothing, and the landing's primary door reads
  "Back to your flat" while there is something to come back to.
- `BUILDING_APP_URL` is `http://localhost:5182/`, the address
  `.claude/launch.json` gives the bottom-up dev server, because this repo
  knows no deployed one. It is one constant at the top of its section.
- The landing covers the editor rather than replacing it, so the scene is
  warm when a door is picked and no router exists.

## Artifacts produced

- `src/core/flatState.ts`, `src/core/journey.ts` and their two test files.
- `_cowork/design/DESIGN-BRIEF-3sep.md` and
  `_cowork/design/wireframe/{Landing,FlatEmpty,FlatSend,FlatDraw}.dc.html`
  committed at `f336598`; written in the planning session rather than here.
- No image files: the Browser pane's screenshots are viewed inline and do
  not persist in this environment.

## Decisions and rationale

The landing is an overlay over the editor rather than a route. A router
would mean a second entry point, a second place for `?project=` and
`?session=` to be read, and a cold scene on the far side of the first
click. As an overlay it is one element, one rule decides it, and the three
seconds of three.js start-up happen while a resident is still reading the
headline.

The two steps are `body[data-step]` and CSS rather than a rebuild. Nothing moves
in the DOM between steps, so the canvas only resizes and no camera or
resize code changed, which the constraints ask for directly. It also means
a step change cannot lose work.

Step 02 carries `aria-disabled` rather than `disabled`. The prompt asks for
tabs that are clickable both ways so nothing is a trap, and a `disabled`
button is exactly a trap: it swallows the click and explains nothing.

The empty-state hint is a chip that drops its pill. The prompt gives its
exact sentence, which is 67 characters, and the bar's strip has room for a
badge rather than a paragraph. Dropping the border and the letter-spacing
makes it read as the muted sentence `FlatEmpty.dc.html` shows in its card,
and it is the one thing in the bar that ellipses when the window narrows,
with the full sentence on its `title`.

The check chip is a button in every state rather than only when something
is wrong. Check Layout used to open a report that also lists what is worth a
look and what is a note; if only a must-fix opened it, a flat that passes
its hard rules would have no way to see the other two tiers at all.

## Deviations from the prompt

The prompt names six commits. This run made four for the code, because
tasks 1, 2, 3 and 4 all land in `index.html`, `src/style.css` and
`src/main.ts` together: the bar rebuild serves the steps and the cull in
the same lines, and the landing shares the same stylesheet. `landing: how
it goes` and `flat: nothing to check yet` are their own commits, the module
each task is really about; `ui: one panel at a time, and one thing in one
place` carries tasks 1, 3 and 4 with a message naming what each
contributed; `flat: tests for 0027` is its own. Splitting the three shared
files further would have meant hand-cutting hunks whose intermediate states
do not compile.

`FlatEmpty.dc.html`'s layout was not built. It shows run 0026's three-card
right column, which task 3 removes from step 01 entirely; its values are
what the empty state uses.

## Blocked / did not do

None. All seven tasks landed.

## Open questions for you

1. The empty state and the unbuildable state now read the same three
   dashes, told apart by the chip beside them and by the drop hint. The
   wireframe shows real numbers beside a must-fix chip instead, which
   would mean measuring a flat the unit build refuses, through a second
   path that could disagree with what a send writes. Worth a decision: keep
   one source and accept two dash states, or add a second measurement for
   the unbuildable case and accept that it can drift.
2. The journey has one renderer in this repo and is meant to have two. The
   building app's own run will need the array; it can either import this
   module across repos, which they have never done, or restate it, which
   is what `docs/bridge-format.md`'s own convention would suggest. Worth
   settling before the packer's run needs it, since a drift in the six
   labels is exactly what the shared model exists to prevent.

## Suggested next prompt

Packer 0055, the building app's own skin and its first two steps, reading
the same `_cowork/design/DESIGN-BRIEF-3sep.md` and the wireframe screens
this run committed. It should render `JOURNEY`'s six steps on its Join
screen the way the landing does, decide there whether it imports
`src/core/journey.ts` across the two repos or restates it, and say which in
its report, since that is the one question run 0027 could not answer from
inside this repo.
