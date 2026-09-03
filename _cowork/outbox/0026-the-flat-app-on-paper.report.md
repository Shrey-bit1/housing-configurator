---
id: "0026"
title: The flat app on paper, and two small store fixes
source: 0026-the-flat-app-on-paper.md
status: complete
branch: run/0026
commit: 04ddcf4
completed: 2026-09-03
---

## Summary

The prompt asked for two small store fixes carried over from run 0025's own
questions and the flat app's reskin into the 3 September brief
(`_cowork/design/DESIGN-BRIEF-3sep.md`, its wireframe committed alongside
it). All eight of its tasks landed. The store's building run now carries an
opaque `plot` object next to `genome` and `summary`, and the ownership
check treats "ben" and "Ben" as the same resident. The save dialog is gone:
`#save-column`, an always-visible panel over the viewport's right edge,
shows the flat's name, three live numbers and a check line, the group with
one red "Send it to your group" button, and a folded "More" holding what
used to be the whole dialog. Fonts, colours, a paper grain, cards and pills
follow the brief's own values throughout the app's chrome, and every label
a resident reads now says "group" rather than "session" or "room". Fast
tests went from 190 to 198 across fifteen files, `tsc` and `npm run build`
stay clean, and the app was driven live against `netlify dev` in the
Browser pane through several of these paths, including a full "Send it to
your group" with a real fixture. A user then ran the column live and found
four more problems in one pass, horizontal overflow, no way to minimize
it, the shortcuts panel rendering underneath it, and the area number
restarting from zero on every edit; all four are fixed, in the commit `ui:
fix the save column's live feedback`.

## What I did

- `src/session/store.ts:73-84` — `BuildingRun` gained `plot?:
  Record<string, unknown>` (the field itself at line 83).
- `src/session/store.ts:267-270` — `PUT …/building` stores `plot` if
  present, after checking it is a JSON object; `400` otherwise.
- `src/session/store.ts:103-112` — `sameResident(a, b)`, trimmed and
  case-insensitive, exported.
- `src/session/store.ts:197` — the ownership check now reads
  `!sameResident(existing.resident, resident)` in place of
  `existing.resident !== resident`.
- `src/library/unitBrowser.ts:87-93` — `isMine` restates the same
  comparison inline rather than importing `sameResident`, since this
  module stays self-contained on purpose.
- `docs/store.md:257-273` — `plot` documented as opaque, with the example
  `{"modulesX": 11, "modulesY": 11, "floors": 7}`.
- `scripts/store-roundtrip.mjs:107-115` — the building-run step now sends
  a `plot` and checks it comes back identical on both the `PUT` response
  and the session state.
- `index.html:9-236` — the save dialog's markup replaced by `#save-column`
  (three `<section class="card">` blocks), the top bar's brand split into
  `(Re)<b>Configure</b> / Flat` with a `.tb-steps` widget, and one Google
  Fonts `<link>`.
- `src/main.ts:977-1053` — `refreshFlatCard`, `animateCount`,
  `setMoreOpen`, the "More" and "Your flat" DOM refs.
- `src/core/unitStats.ts` (new, 39 lines) — `unitStats(storeys)`: area,
  storey count, glazing length, off an already-built unit's storeys, with
  no dependency on `unitExport.ts`'s runtime exports.
- `src/main.ts:141-148` — `commitHistory` now calls `refreshFlatCard()`
  too, so an entrance or a door refreshes the card the same way a room
  does.
- `src/main.ts:1225-1243` — `openSaveDialog` (name kept) drops
  `saveDialog.showModal()`; the modal, its backdrop and `#save-close` are
  gone.
- `src/main.ts:1391-1402` — the publish result line reads `Sent to <code>
  as <label>` with the version appended only when it moved, then `· open
  Units to see your group.`
- `src/core/savePlan.ts:92-102` — `outputLabel("publish")` returns
  `"Group"`.
- `src/session/session.ts:73-90` — `whyPublishDisabled` and `sessionLine`
  reworded to "group".
- `src/style.css:14-76` — `:root` tokens repointed at the brief's values;
  `--blue`, `--yellow`, `--dim`, `--card`, `--grain`,
  `--font-display`/`--font-body`/`--font-mono` added.
- `src/style.css` (appended, ~90 lines) — `.card`, `.chip`/`.chip-ok`/
  `.chip-acc`, the grouped button-font override.
- `src/library/unitBrowser.ts:195-238` — `.ulb-card` takes the card look;
  `.ulb-tag` is a pill; `.ulb-tag.ulb-yours` and
  `.ulb-session-card.ulb-mine`'s border move from ink to `var(--accent)`;
  an 8-step rise-in stagger.
- `PROJECT_STATE.md` — the systems table, §10, §11, §12 updated, new §13.
- `_cowork/CONTEXT.md` — a run-0026 paragraph and a `_cowork/design/`
  layout entry.
- `src/style.css:1418-1497` — `#save-column` gains `overflow-x: hidden`;
  `.save-column-toggle`/`.save-column-body` (new); `#save-column input`
  takes an explicit `width: 100%`.
- `index.html:173-177, 284-285` — `#save-column-toggle`/`#save-column-body`
  wrap the three cards.
- `src/main.ts:993-1003` — `saveColumnToggle`'s click handler, hides or
  shows `#save-column-body`.
- `src/style.css:1018-1026` — `#shortcuts-panel`'s `z-index` raised from 3
  to 21.
- `src/main.ts:1023-1059` — `animateCount` rewritten as a
  `requestAnimationFrame` tween (`countState`, a `WeakMap`), replacing the
  `@property --n`/`.cnt` CSS approach entirely.

## Findings

The store's ownership rule and the units panel's "Yours" mark were the
same string comparison written twice, and only one of the two places the
prompt named as a third site, `whyPublishDisabled`, actually compares two
names: it checks only whether one resident string is present and valid,
never against another resident. That is a real gap between the prompt's
Assumption 3 and the code, recorded under Deviations below rather than
worked around by inventing a comparison that has nothing to compare
against.

Fast tests went from 190 passed in fourteen files to 198 in fifteen:
`store.test.ts` from 18 to 21 (`sameResident`'s own four cases as one
test, the case-different republish, the plot round trip with its two
rejection cases), `unitBrowser.test.ts` from 6 to 7 (`isMine("Ana ",
"ana")` and the reverse), and the new `unitStats.test.ts` at 4. Slow tests
stayed at 26 passed plus 1 expected fail, and the two Check-Layout
baselines (`flat-1-two-storey` at 1 must-fix plus 11 worth-a-look,
`flat-1-no-stair` at 1 plus 6, matching PROJECT_STATE §10's "12 and 7")
were re-confirmed live rather than only by the unchanged slow suite: the
save column's own check line showed "1 MUST FIX" against
`flat-1-two-storey.json`, and its "show me" link opened the Check Layout
panel to the same 1/11/5 breakdown the panel already reports.
`scripts/store-roundtrip.mjs` passed 28 checks against `netlify dev` (26
through run 0025, 2 new for the plot round trip). `tsc --noEmit` and `npm
run build` both finish with no errors.

The grep audit for "session" across `index.html`,
`src/session/session.ts`, `src/session/store.ts`,
`src/library/unitBrowser.ts`, `src/main.ts` and `src/core/savePlan.ts`
turns up only code identifiers (`SessionSettings`, `sessionLine`,
`tbSession`, `SESSION_STORAGE_KEY`, every `/api/session/…` path,
`?session=`) and developer comments describing the store's own concept,
which `docs/store.md` documents under that name on purpose and which this
run's constraints say stays untouched beyond the `plot` field. The same
audit for "room" turns up architectural rooms (`elastic room's authored
seed`, `wet rooms and stairs`, double-height rooms, the import toast
`"${n} room(s) could not be placed"`), which are a different sense of the
word the brief's rule was never about, plus one deliberate exception: the
save column's group-code field keeps `placeholder="room-42"`, the exact
example `docs/store.md` uses throughout its own text, on the judgement
that a placeholder example is not a label and that matching the store's
own documentation is worth more than erasing the one remaining instance of
the word. One hit the grep by word alone would have missed: `outputLabel
("publish")` returned the literal string `"Session"` as a save result's
ROW LABEL, found live while verifying a real send in the Browser pane,
because that string never contains the substring "session" to search for
in the first place.

## Evidence

Every live check in this report ran against `netlify dev` on
`http://localhost:8888`, the only address reachable from this machine. The
branch, once pushed, should build a Netlify deploy at
`https://run-0026--reconfigure-flat.netlify.app`, following the pattern
`docs/store.md` and every prior run's report record for this site; it
answered "Site not found" both times it was checked shortly after the
push, which most likely means the build had not finished yet rather than
anything wrong with the branch, but that is not confirmed.

Store, plot field, a session with a building run and a real plot, driven
through `netlify dev` at `http://localhost:8888`:

```
PUT /api/session/report-demo/building
{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","plot":{"modulesX":11,"modulesY":11,"floors":7}}

200 OK
{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","at":"2026-09-03T19:38:28.315Z","plot":{"modulesX":11,"modulesY":11,"floors":7}}

GET /api/session/report-demo
200 OK
{"code":"report-demo","flats":[],"residents":[],"building":{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","at":"2026-09-03T19:38:28.315Z","plot":{"modulesX":11,"modulesY":11,"floors":7}}}
```

The plot rides back on both calls, byte for byte, without the store
reading a single key inside it.

Store, `sameResident`, a republish by "ben" over a flat the store recorded
as "Ben", same session:

```
PUT /api/session/report-demo/flats/u9?resident=Ben   (creates it)
GET /api/session/report-demo  (before)
{"code":"report-demo","flats":[{"id":"u9","resident":"Ben","label":"Unit 9","version":1,"changed":true,"preview":false,"bbox":[0,0,0,0],"floors":1,"areaCells":1,"publishedAt":"2026-09-03T19:38:35.362Z"}], …}

PUT /api/session/report-demo/flats/u9?resident=ben   (200, not 409)
GET /api/session/report-demo  (after)
{"code":"report-demo","flats":[{"id":"u9","resident":"ben","label":"Unit 9","version":2,"changed":true,"preview":false,"bbox":[0,0,0,0],"floors":1,"areaCells":1,"publishedAt":"2026-09-03T19:38:36.333Z"}], …}
```

Version moved from 1 to 2, the `PUT` answered `200` rather than `409`, and
the resident field reads "ben" exactly as sent: only the comparison folds
case, never the stored value. `store.test.ts`'s own new case
(`src/session/store.test.ts`, "a case-different republish is the same
resident too") pins the same behaviour without a live server.
`sameResident`'s own describe block pins the four bare cases: equal, case,
leading and trailing spaces, and empty against empty (true), empty against
"Ana" (false).

The save column and the Units panel were both driven live rather than only
read from source, since the Browser pane's screenshots are viewed inline
in this environment and do not persist as files, matching every prior
run's report from 0019 onward. Loading `flat-2-single-storey.json` via
`?project=` and reading the column: heading "UNIT 11" in
`getComputedStyle(...).fontFamily` `"Big Shoulders Display", "Archivo
Narrow", Impact, sans-serif`, area counting up from its previous value to
70 m² over roughly 1.4 s before settling, 1 storey, 3.6 m glazing, a
`.chip.chip-ok` with `border-color`/`color` `rgb(78, 122, 90)` (`--note`)
and `border-radius` `999px`. Pressing "Send it to your group"
(`getComputedStyle` on `#save-go` confirms the same display font) wrote
`flat-11.json` (7507 bytes), `unit-11.json` (33332 bytes), the library
entry (69.84 m², a 61 kB preview), and a Group row reading "Sent to
test0025 as Unit 11 · open Units to see your group." Loading
`flat-1-two-storey.json` showed a red `.chip.chip-acc`, "1 MUST FIX",
naming "Orphaned room, no path of adjacencies (including stairs) reaches
an entrance," with a "show me" link that opened the Check Layout panel to
its own "1 must fix, 11 worth a look, 5 note" line, the same
`validate()`/`computeDwellingGraph()` call the button already made.
Opening the Units panel afterward showed the heading "YOUR GROUP" over
five cards, all five carrying a red "YOURS" tag
(`getComputedStyle` on `.ulb-tag.ulb-yours` gives `background-color`
`rgb(214, 52, 28)`, `--accent`), and the library grid below it visibly
staggering in, one card noticeably still mid-fade a beat after the group's
cards had settled. `#save-column` and `#view-controls` (the Display/
compass card) sat clear of each other at 1440×900 after the column's
`bottom` was set to 230px; no console error appeared across any of these
loads (`read_console_messages`, `onlyErrors: true`, empty each time this
was checked after a fresh navigation).

Test counts, before and after, and the byte-identity check: `npx vitest
run` reported 190 passed in fourteen files before this run's commits and
198 passed in fifteen after; `npm run test:slow` reported 26 passed plus 1
expected fail both before and after, unchanged, since no rule or fixture
was touched. `src/core/saveFiles.test.ts`, which pins the project and unit
downloads against a committed unit file's own bytes, is part of that
unchanged slow-adjacent count and passed both times, so the three
downloads stay byte-identical.

The four bugs a user found while running the column live were each
re-verified after the fix, in the same session. `#save-column`'s
`scrollWidth` equalled its `clientWidth` (320) with the group fields
unfolded and "More" open, where before the fix the two side-by-side text
inputs pushed it wider. Clicking the new "Save" toggle hid the three cards
and left only the tab itself, docked at the column's top-right corner, and
clicking it again restored them. Opening the shortcuts panel over the
column now renders it on top, where before the fix it rendered underneath.
Deleting a placed room twice in the same flat (`flat-1-two-storey.json`,
starting at 126 m²) settled the area number at 122 then 115 after each
deletion, matching the removed rooms' own cell counts, and it was never
observed reading 0 partway through either edit; catching the animation's
own in-flight frames through a separate tool call proved too timing-
dependent to rely on; the settled values and the mechanism's own logic,
tracking each element's shown value in a `WeakMap` rather than in a CSS
custom property tied to a class, are the evidence for this one.

## Artifacts produced

- `_cowork/design/DESIGN-BRIEF-3sep.md` and `_cowork/design/wireframe/`
  (seven `.dc.html` screens, `canvas.json`, `generate.py`), committed at
  `ac0f05b` as the source this run's skin reads from.
- No image or file artifact from the live verification: the Browser
  pane's screenshots were viewed inline and read via `getComputedStyle`/
  `read_console_messages`, and none of it writes to disk in this
  environment.

## Decisions and rationale

The save column sits as an absolutely positioned panel over the
viewport's right edge rather than as a flex sibling of the canvas. The
alternative would have meant giving the canvas a narrower box and
touching the resize observer and the camera's aspect calculation, both of
which the constraints ask to leave alone; the Units panel already proves
the overlay approach works for a right-hand panel of this kind, so the
column follows the same pattern. Its `bottom` offset is 230px rather than
16px specifically to clear `#view-controls`, the Display/compass card,
which claims the same corner and was never moved. Reading the CSS alone
never surfaced the conflict, since the two panels' actual heights only
collide once both are rendered together; running the app in the Browser
pane did.

"More" holds exactly the four checkboxes plus Replace, the design number
and the colour input, unchanged in behaviour: `runSave`, `savePlan.ts` and
`saveFiles.ts` were not touched. The wireframe's own annotation, "Today's
four checkboxes go under More," reads this as a relocation of existing
controls rather than a new action, and the red "Send it to your group"
button is the same click handler the old "Save" button called, now
labelled for what it has always done. The consequence, named under
Deviations, is that pressing it with "Send to group" unticked under More
still only writes the files that are ticked and sends nothing, despite
the label.

`unitStats` lives in its own file, `src/core/unitStats.ts`, rather than as
a function inside `unitExport.ts`. That module's own `type UnitStorey`
import is erased at compile time, but its runtime exports pull in
`./adjacencyGraph`, `./door` and `./windows`, which
`src/core/unitExport.test.ts`'s own header explains at length is the
reason that suite avoids importing `unitExport.ts` at all. A fast test for
three lines of arithmetic had no reason to pay that cost, so the function
and its test sit apart from the module whose type it reads.

`button.primary`'s own look, an ink-filled block used by the sidebar's
Grid-size "Apply" button, was left alone; `.btn-send` is a new class
carrying the brief's red block and nudging arrow, scoped to the save
column's one button. The alternative, restyling `button.primary` directly,
was tried first and caught live: the Apply button turned into an unwanted
red pill the moment the rule changed, which is exactly the kind of
"editor tool redesigned as a side effect" the constraints rule out.

Two skills were read from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`,
per the prompt's instruction, as reference rather than as a source of new
logic. `design-automation/SKILL.md` was read in full; its section 2.1,
Production Rules, frames `sameResident` as one IF-THEN rule ("if two names
match trimmed and case-insensitively, treat them as the same resident")
applied at the store's one real decision point and restated, not
duplicated as a second rule, at the one other place the same question is
asked. No other skill in that directory addresses typography, colour,
layout or UI wording; the rest of the set is AEC-specific (parametric
modelling, facade computation, structural computation, and so on), so none
of it was read or applied to the reskin itself.

## Deviations from the prompt

Assumption 3 names three places two resident names are compared:
`isMine`, the store's ownership check, and `whyPublishDisabled`. The third
is not accurate: `whyPublishDisabled` (`src/session/session.ts:77-84`)
only checks whether the CURRENT resident string is present and matches the
code's own validity pattern; it never reads a second resident to compare
against. `sameResident` is used at the two real sites, the store's
ownership check and `isMine`'s restatement, and not forced into a third
place that has nothing to compare.

`outputLabel("publish")` changed from `"Session"` to `"Group"`
(`src/core/savePlan.ts:92-102`). This was not named in the prompt's Words
section or found by the grep audit, since the string itself never
contained the word "session"; it surfaced only by watching a real send in
the Browser pane, where the save column's fourth result row still read
"Session — Sent to …" after every other label had already changed.

Task 7 asked for a dedicated commit, `flat: tests for 0026`, covering
`sameResident`'s cases, the case-different republish, the plot round
trip, and `isMine`'s case-insensitivity. All four exist and pass, but they
were committed alongside their own features in `5b27701` ("store: the
building carries its plot") and `dc89561` ("session: ana is Ana") rather
than isolated afterward, because splitting an already-made commit without
an interactive rebase, which this environment's tooling does not permit,
would mean discarding and reconstructing those two commits rather than
editing them. `unitStats.test.ts` and the wording assertions in
`savePlan.test.ts`/`session.test.ts` likewise ride with their own
feature's commit (`de025fe`, `b90dc7b`) rather than a separate tests
commit, for the same reason and by the same choice.

`index.html` and `src/style.css`'s diffs each carry more than one task's
content in a single commit. `index.html`'s Google Fonts link (task 3) and
its topbar/save-column markup (task 4) sit three lines apart in the same
file, inside one `git diff` hunk, so they landed together in the `ui: two
steps and one red button` commit; `style.css`'s tokens (task 3) and its
`#save-column`/`.btn-send`/`.tb-steps` rules (task 4) are declared in one
continuous file and landed together in `ui: paper, the fonts, the three
colours`. Both commit messages say so directly. `unitBrowser.ts` carries
task 5's visual changes and task 6's wording changes in the same small
file for the same reason, one commit, `library: the group's flats on
paper`, with a note in its message.

The save column's own name, colour and file-format checkboxes now show
inside "More," collapsed by default, rather than always visible the way
the old dialog's whole body was. The wireframe's card never shows them at
all; this run keeps them one click away rather than dropping any of them,
since nothing in the constraints asks for a control to disappear.

## Blocked / did not do

None. All eight tasks in the prompt's numbered list landed, verified live
where the change was visual or behavioural and by the test suite where it
was not.

## Open questions for you

1. The save column's "More" fold currently holds the design number and
   colour alongside the five checkboxes, which the wireframe's own
   annotation groups only the checkboxes under. If a future run wants the
   number and colour visible by default (so a resident sees "Unit 11"
   resolve to a design number without a click), that is a small, separate
   change; this run treated "nothing is invented, only relocated" as the
   safer reading given the prompt named no new layout for them.
2. `outputLabel`'s wording gap surfaced only by watching the app run, and
   the grep audit this prompt asked for missed it entirely, so a
   grep-based word audit alone cannot be trusted as the last word on copy
   correctness. A future prompt could ask for one pass
   through the save column and Units panel with every DOM string logged,
   rather than only the source files, to catch anything else assembled at
   runtime the same way.

## Suggested next prompt

Packer 0055 (the design brief's own "what the runs do" list): the
building app's skin, first two steps and Architect drawer, reading the
same `_cowork/design/DESIGN-BRIEF-3sep.md` and wireframe this run
committed. It should be free to read `src/style.css`'s tokens and
`.card`/`.chip` classes as a reference for its own CSS rather than
reimplementing the brief from scratch, since both apps are meant to share
the same look without sharing code.
