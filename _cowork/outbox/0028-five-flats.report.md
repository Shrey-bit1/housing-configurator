---
id: "0028"
title: Five flats for the library, the first batch
source: 0028-five-flats.md
status: complete
branch: run/0028
commit: 5b94501
completed: 2026-09-04
---

## Summary

Five flats now sit in the library at `public/units/unit-8.json` through
`unit-12.json`, each with a preview and a manifest row, and each carrying zero
must-fix findings from the app's own `validate()`. They were not drawn by
dragging tiles. A new generator under `scripts/` turns a bubble diagram into a
`dwelling-unit` file, then loads that file through a real `FloorManager` and runs
the same two functions Check Layout runs, failing on any must-fix, any refused
placement, any pruned door or an area outside the target band. Ten real apartment
plans were read first and are written up at
`_cowork/outbox/0028-reference-plans.md`; one of the four rules the run started
from did not survive them. The five flats were meant to be drawn by five
subagents working in parallel. All ten subagent launches failed on API limits and
the flats were drawn in the main session instead, which is the run's largest
deviation.

## What I did

- Created `scripts/flatLayout.ts` (338 lines) — the pure arithmetic: rows of
  slots packed onto the 0.6 m grid, doors read back out of the packed geometry,
  an entrance found on an edge that faces the outside, and the wet-room gap
  measure the prompt asks for.
- Created `scripts/gen-flat.mjs` (238 lines) — the runner. Boots the project's
  own Vite in middleware mode and pulls `src/` through `ssrLoadModule`, so no
  dependency was added.
- Created `scripts/flats/unit-8.flat.json` through `unit-12.flat.json`, the five
  bubble diagrams.
- Created `public/units/unit-8.json` through `unit-12.json` and their five `.jpg`
  previews; added five rows to `public/units/index.json`.
- Created `src/core/libraryClean.slow.test.ts` (104 lines), which walks every
  file in `public/units/` and asserts zero must-fix.
- Created `scripts/flatLayout.test.ts` (230 lines, 21 cases), the generator's
  arithmetic on one hand-checked graph.
- Created `_cowork/outbox/0028-reference-plans.md` (315 lines) and
  `_cowork/outbox/0028-contact-sheet.png` (2800 by 812, 947247 bytes).
- `.gitignore:8` — added `build/`, where the generator writes.
- `PROJECT_STATE.md:3535` and `PROJECT_STATE.md:4178` — the library's new size,
  and a new section 15 on the generator and the batch.
- `_cowork/CONTEXT.md:249`, `:285`, `:317`, `:325` — the `scripts/` entry and the
  two suite counts.

## Findings

**One of the four starting rules is wrong.** "A bedroom opens off the hall and
never off the living room" is contradicted by three recent Swiss cooperative
plans. Manegg 1 at 3.5 rooms puts its 15.6 m2 Zimmer 1 off the kitchen and living
space, confirmed at door-swing level. Else Zueblin West at 3.5 rooms puts BOTH of
its 13.7 m2 Zimmer there. Manegg 1 at 4.5 rooms puts its 11.1 m2 Zimmer 1 there.
The rule holds in the two German plans. The corrected version, which Flat 10
follows, is that at least one bedroom opens off the hall and the rest commonly
open off the living space in flats under about 75 m2.

**The en-suite clause is wrong too.** The sample contains no en-suite at any
size, including three flats at 97 to 98 m2. Every bathroom, shower and WC in all
eight labelled plans opens off the Entree or the corridor. A second bathroom in a
large flat is a second door off the corridor.

**A flat already in the library is broken.** `public/units/unit-5.json` fails
four must-fix rules: P1 because it has no bathroom, ST2 and ST3 because no stair
reaches its second storey, and H1 because the one room up there is therefore
orphaned. It is a four-instance scratch unit with zero doors and a retired
`stair` module, not a designed flat. Nothing in the repo had ever checked it.

**The module catalogue's rooms are smaller than real rooms.** A `living` seed is
12.60 m2 against a reference range of 18.2 to 32.7 for a living and dining space.
`bedroom_large` is 10.80 against 13.3 to 15.9 for a main bedroom. `kitchen` is
5.76, under BBV I paragraph 36's 6 m2 minimum for a multi-room flat and under the
observed 7.0 to 11.2. The elastic void mechanism closes the gap and it costs
filler.

**Voids only work in a middle row.** The app grows elastic rooms into empty space
they enclose, and enclosure means all four orthogonal sides. The first and last
rows of a flat face the outside on one side, so a void there reaches the grid
border and is never absorbed. A void therefore needs a row above and a row below
that both span it, which a 70 m2 flat can afford and a 40 m2 flat cannot: the
enclosing filler is circulation, and in a small flat it eats the whole
circulation budget. Flat 11 uses a void and Flat 08 does not, for this reason.

**Two circulation patches that touch are one room.** A WC lobby placed against
the hall merges into the same circulation cluster, so a door between them binds
one space rather than two and the app prunes it. This cost Flat 11 one door on
its first run and was caught by the runner's door count rather than by the rules.

**Circulation in a maisonette cannot reach the reference range.** The reference
plans run 5 to 15 per cent of the flat. Flat 12 runs 29 per cent, because rule N1
counts a stair as circulation and the stair is 16 cells on each of two storeys.
Without the stair it would be 23 per cent. The reference sample is entirely
single-storey, so it offers no comparison.

## Evidence

**1. Commits, the branch state on `main`, and the preview address.**

`main` was at `ac9d84d`, "Merge run/0027: the landing screen, and one place for
everything", so assumption 1 holds and `run/0028` branched from it. Seven
commits:

| hash | message | stats |
|---|---|---|
| `45d6611` | library: what real plans do | 1 file, +315 |
| `ffdf298` | library: a flat from a graph | 2 files, +685 |
| `54fdf34` | library: five flats | 13 files, +10489 -8 |
| `3edbba7` | library: five flats, all clean | 1 file, +104 |
| `e9c8eb6` | library: five previews | 6 files, +50 |
| `c6ae771` | library: the five on one sheet | 1 file, binary |
| `5b94501` | library: tests for the five | 1 file, +230 |

The preview ran on `http://localhost:52821`. The launch config asks for 5173 and
`autoPort` moved it, because another dev server was already up.

**2. The reference study.** Written to `_cowork/outbox/0028-reference-plans.md`
before any flat was designed, and committed first as the prompt required. Ten
plans, eight of them labelled drawings with a printed area for every room. Six
come from four `wbg-zh.ch` cooperative datasheets in Zurich, which are Manegg 1
at 3.5 and 4.5 rooms, Zwischenbaechen buildings C and D, Obsthalden, and Else
Zueblin West at 2.5 and 3.5 rooms. Two come from the Volkswohnung Karlsruhe plan
sets at 68.13 and 76.48 m2. Two more, Kalkbreite and Toedistrasse, were opened
and are reported without a graph because their door positions could not be read
honestly. Every URL is in the file.

The patterns, with their numbers. The flat door opens into a dedicated Entree or
Diele in ten of ten, and that vestibule is internal and windowless in every case.
Circulation runs 5.4 to 14.8 per cent of the flat, median about 10.5, computed
from the printed areas. Every habitable room is on the facade in all eight; the
rooms allowed to be internal are the Entree, the corridor, the bath, the shower,
the WC, the Reduit and sometimes the kitchen. The wet rooms group into one block
against one internal wall with the kitchen on it, in all eight, which is exactly
what the prompt's hard requirement asks for. Room areas run: living and dining
together 18.2 to 32.7 m2, largest Zimmer 13.3 to 15.9, second Zimmer 10.5 to
14.7, kitchen 7.0 to 11.2, bath 4.0 to 6.7, separate WC 1.75 to 2.7, Entree 3.7
to 10.1, corridor 4.8 to 6.3, balcony 3.1 to 9.7.

Room proportions in metres could NOT be verified. No plan printed a width by a
depth and none was measured against its scale bar, so the study quotes areas only.
Facade-to-core depth could not be sourced for Switzerland either; the one
quantified source found measures whole-block depths of 13 to 18 m elsewhere in
Europe.

The four rules. Rule one, living connects to kitchen and hall, HOLDS eight of
eight, with the nuance that at Obsthalden "living" has to be read as a cluster of
three rooms because it is the dining room that touches the Entree and the living
room that touches the kitchen. Rule two, a bedroom opens off the hall and never
off the living room, is CONTRADICTED with three counter-examples. Rule three, a
bathroom opens off the hall with one en-suite in the largest flats, HOLDS with
the en-suite clause DELETED. Rule four, the entrance opens into a hall and never
into a bedroom, HOLDS ten of ten.

**3. The five.**

| name | storeys | m2 | rooms | graph in one line | reference |
|---|---|---|---|---|---|
| Flat 08 - one room, corner | 1 | 38.88 | living, kitchen, bath, entree, balcony | entrance to entree; entree to living, kitchen, bath; balcony off living | plan 3, Zwischenbaechen C |
| Flat 09 - two rooms, hall between | 1 | 51.48 | living, 1 bedroom, kitchen, bath, entree, loggia | entrance to entree; entree to living, bedroom, kitchen, bath; loggia off living | plan 3, Zwischenbaechen C |
| Flat 10 - two rooms, off the living room | 1 | 56.88 | living, dining, 1 bedroom, kitchen, bath, entree, loggia | entrance to entree; entree to living, kitchen, bath; dining off living; bedroom and loggia off dining | plan 7, Else Zueblin West |
| Flat 11 - three rooms, deep hall | 1 | 70.20 | living, 2 bedrooms, kitchen, bath, WC, Diele, loggia | entrance to Diele; Diele to living, two bedrooms, kitchen, bath, WC; loggia off living | plan 9, Volkswohnung WHG 3 |
| Flat 12 - four rooms, maisonette | 2 | 110.88 | living, dining, 3 bedrooms, kitchen, bath, WC, stair, entree, corridor, loggia, terrace | entrance to entree; entree to living, dining, kitchen, bath, WC, stair; stair to corridor above; corridor to three bedrooms, terrace | plan 4, Zwischenbaechen D |

They are five plans rather than one plan at five sizes. Flat 08 is an L with the
living room on the corner and no bedroom. Flat 09 puts a hall between a north
band of rooms and a south band of services. Flat 10 hangs the bedroom off the
living side and gives the entree only 4.32 m2, which is the topology the study
found in three Swiss plans. Flat 11 serves every private room off one 10.8 m2
Diele. Flat 12 puts the whole wet block and the stair downstairs and three
bedrooms off a corridor above.

**4. The check result, raw.** This is the generator's own output for all five in
one run:

```
=== unit-8 — Flat 08 — one room, corner  (unit-8.flat.json)
  storeys 1   instances 26   area 38.88 m²
  doors written 4, kept by the app 4   skipped placements 0
  must fix 0   worth a look 0   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
  wet rooms kitchen, bath   widest gap per storey 0 cells

=== unit-9 — Flat 09 — two rooms, hall between  (unit-9.flat.json)
  storeys 1   instances 30   area 51.48 m²
  doors written 5, kept by the app 5   skipped placements 0
  must fix 0   worth a look 1   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access).
  wet rooms kitchen, bath   widest gap per storey 0 cells

=== unit-10 — Flat 10 — two rooms, off the living room  (unit-10.flat.json)
  storeys 1   instances 23   area 56.88 m²
  doors written 6, kept by the app 6   skipped placements 0
  must fix 0   worth a look 1   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access).
  wet rooms kitchen, bath   widest gap per storey 0 cells

=== unit-11 — Flat 11 — three rooms, deep hall  (unit-11.flat.json)
  storeys 1   instances 39   area 70.2 m²
  doors written 7, kept by the app 7   skipped placements 0
  must fix 0   worth a look 3   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ OR1  Room is lit only from the north (no direct sun).
    ~ OR1  Room is lit only from the north (no direct sun).
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access).
  wet rooms kitchen, wc, bath   widest gap per storey 2 cells

=== unit-12 — Flat 12 — four rooms, maisonette  (unit-12.flat.json)
  storeys 2   instances 60   area 110.88 m²
  doors written 14, kept by the app 14   skipped placements 0
  must fix 0   worth a look 4   note 1
    ~ MB1  Floor 1 has bedrooms but no bathroom.
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ N1  Circulation-heavy layout (29% of interior area).
    ~ N1  Floor 0 is circulation-heavy (32% of interior area).
    ~ N1  Floor 1 is circulation-heavy (26% of interior area).
  wet rooms kitchen, wc, bath   widest gap per storey 2, 0 cells

all clean
```

Counts per flat. Must fix 0, 0, 0, 0, 0. Worth a look 0, 1, 1, 3, 4. Note 1, 1,
1, 1, 1. The single note is S6 in every case, which is the rules engine saying
the kitchen and the bathroom share a wall, so it is a compliment rather than a
finding.

One flat needed redrawing. Flat 11's first version wrote eight doors and the app
kept seven. The pruned one was the edge between the Diele and the WC lobby: both
are circulation and they touch, so they are ONE space, and a door between them
binds a single space, which `resolveDoorSpaces` refuses. The same version put the
WC at the end of the wet run, which gave a widest wet gap of 4 cells. Both were
fixed by dropping that graph edge and moving the WC between the kitchen and the
bath. Nothing else was redrawn.

The same run loads each file through `parseProject` and a real `FloorManager` and
calls `computeDwellingGraph` then `validate`. `src/core/libraryClean.slow.test.ts`
does the same independently over the committed files, and it passes.

**5. Wet rooms.** Every flat keeps its wet rooms on one storey, and in Flat 12
that is the lower storey as required.

| flat | storey | kitchen | bath | WC | widest gap |
|---|---|---|---|---|---|
| Flat 08 | 0 | yes | yes | none | 0 cells |
| Flat 09 | 0 | yes | yes | none | 0 cells |
| Flat 10 | 0 | yes | yes | none | 0 cells |
| Flat 11 | 0 | yes | yes | yes | 2 cells |
| Flat 12 | 0 | yes | yes | yes | 2 cells; storey 1 holds none |

The measure is the largest orthogonal cell gap between any two of the named
rooms, computed by `widestGap` in `scripts/flatLayout.ts`. Zero means they share
a wall. The 2 in Flats 11 and 12 is the kitchen and the bath separated by the WC,
which is 2 cells wide, so all three still sit in one continuous run and one shaft
serves them.

**6. The contact sheet.** `_cowork/outbox/0028-contact-sheet.png`, 2800 by 812,
947247 bytes. Five previews in a row with each flat's name, area, storey count,
room count, the reference plan it came from and its graph. It is composed on a
canvas inside the running app and written out through the dev server's own
capture sink in `vite.config.ts`, which is how a picture has got from the browser
into this repo since run 0013, so it needed no image library.

**7. Subagents. This is where the run went wrong.** Ten subagent launches, and
not one produced a flat.

Five were launched in parallel, one per flat, each given the reference study, the
module catalogue with exact footprints, the diagram format, the rule list, the
generator and its own brief. Four died with `Claude's response exceeded the 64000
output token maximum`, all four at their first turn, all four having said only
that they would start by reading the briefing and the reference plans document.
The fifth was killed later by the same error. Three were relaunched with an
explicit instruction to keep responses short, and two of those with a concrete
starting layout so the task was tuning rather than open-ended design. Those runs
were then killed by a session rate limit, HTTP 429.

The flats were drawn in the main session instead. The work split that was
intended, and that a future run should still use, is one subagent per flat, since
the five are genuinely independent and each needs perhaps ten generator runs.
Nothing a subagent produced needed catching, because none produced anything.

The one thing verification did catch is under point 4: the pruned door and the
4-cell wet gap in Flat 11's first version, both caught by the generator's own
checks rather than by reading the file.

**8. Test counts, fixtures and downloads.** The fast suite goes from 223 passed
in seventeen files to **244 in eighteen**. The new file is
`scripts/flatLayout.test.ts` at 21 cases. The slow suite goes from `26 passed |
1 expected fail` in three files to **`41 passed | 1 expected fail` in four**. The
new file is `src/core/libraryClean.slow.test.ts` at 10 cases, one per unit file
plus one that asserts the glob found anything. The expected fail is the standing
french-window `it.fails` and is untouched.

Both canonical Check-Layout baselines reproduce exactly against
`testflats/flat-1-two-storey.json`, measured headlessly through the same
`validate()` the panel uses: 1 must-fix plus 11 worth-a-look is the **12**, and
with the stair instances removed 1 plus 6 is the **7**. The panel counts hard and
soft and lists notes separately, which is why the raw totals are 17 and 11.

The three downloads are byte-identical. `src/core/saveFiles.ts` and
`src/core/savePlan.ts` show zero changed lines against `main`, and
`saveFiles.test.ts`, which pins the downloads against a committed unit file's own
bytes, passes its 8 cases. `docs/bridge-format.md`, `src/core/rules.ts`,
`testflats/` and the seven existing unit files also show zero changed lines
against `main`.

`npx tsc --noEmit` is clean and `npm run build` finishes in 6.89 s with only the
standing chunk-size warning.

**9. The skills.** Four `SKILL.md` files were read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`design-automation` contributed the most and is the one worth keeping. Its
section 5.1, "Residential Unit Layout Generation", gives a room placement
priority order, which is entry, then kitchen, then bathrooms at the plumbing
riser, then living at the largest window wall, then bedrooms, then windowless
service. That matches what the reference plans do and it is the order the five
flats follow. Its section 1.4 hard and soft rule distinction is already how
`src/core/rules.ts` is built. Its section 4.8 room sizing table, which puts a
1-bed at 45 to 65 m2, a 2-bed at 65 to 90 and a 3-bed at 85 to 120, sits close
enough to the prompt's bands to be a useful cross-check.

`parametric-modeling` contributed section 1.3, which splits a design into what is
fixed, what varies, what is derived and what is conditional. That is the same
split this codebase already enforces as "derive, don't store", and it is why the
generator writes only placements, one entrance and doors, and lets the app
produce walls, windows and stair holes. Its section 1.7, on when parametric is
overkill, is why the generator stays a packer with a verifier rather than a
solver: the layout logic for five one-off plans is cheaper drawn than searched.

`algorithmic-patterns` was read for its section 7 and its selection guide and
contributed almost nothing usable. Its treatment of the one relevant topic, 2D
bin packing, is a single sentence about irregular polygon nesting for CNC sheets.
The rest, being L-systems, cellular automata, agent-based modelling, swarm
intelligence and reaction-diffusion, does not apply to packing eight rectangles
into a rectangle on an integer grid. **Rejected**, with that reason.

`computational-geometry` was **not read past its section outline, deliberately**.
The prompt said to read it only if a placement needed it. Its sections are NURBS
curves and surfaces, boolean CSG, tessellation, curvature analysis, point clouds
and floating-point tolerance. Everything in this run is integer cell arithmetic
on a 0.6 m grid, where two rectangles either share cells or do not, so there is
no tolerance question and no continuous geometry anywhere.

**10. Contradictions with the Assumptions, then my own.**

Assumption 3 says `src/core/rules.ts` holds "14 must-fix and 27 advisory". The
file holds **41 rules in total**, of which 14 carry `severity: "hard"`. The
remaining 27 split into `"soft"` and `"note"`, and the app's panel counts hard
plus soft and lists notes separately. Calling all 27 advisory is right in spirit
and wrong at the panel, which is why point 8's baselines read 12 and 7 rather
than 17 and 11.

Assumption 2 says seven entries exist in the library. Seven are COMMITTED. The
working tree also carries `unit-6` and `unit-7`, two pairs of files plus two
manifest rows, which are Shrey's own uncommitted work. This run left them
untouched: its manifest commit stages only the five new rows, and the two extra
rows are still sitting in the working tree as an uncommitted diff. They need
committing or discarding by hand.

Assumptions 1, 4 and 5 hold as written.

My own assumptions, with their effects. **Names** follow the prompt's example
form, "Flat 08 — one room, corner". **Colours** come from `UNIT_COLORS` in
`src/main.ts:966`, the app's own seven, because "the existing palette" most
plausibly means that array rather than the colours already spent in the library;
reading down the library no two adjacent ids share one. **Ids** continue the
`unit-N` sequence rather than slugifying the names, so they do not collide with
`unit-6` and `unit-7`. **Room count** follows the Swiss convention the study
found, where living and dining together count as one and each Zimmer counts as
one, so Flat 10's living plus dining plus one bedroom is two rooms. **The entree
touches the outside** in every flat, because the app requires the entrance on an
outside edge while the reference plans put the vestibule against a stair core.
That difference is a consequence of modelling one flat with no building around
it, and it is recorded rather than designed away.

**11. What I would change before the next fifteen.**

The generator is not the bottleneck. It packs a flat in about two seconds and it
caught every mistake made while drawing these five. What cost the time was
deciding what to pack, and the reason is that the module catalogue is too small
and its rooms are too small. There is one kitchen at 5.76 m2, one living room
seed at 12.60, and nothing between `bedroom_small` at 7.20 and `bedroom_large` at
10.80. Real plans want a living and dining space of 18 to 33 m2 and a main
bedroom of 13 to 16. The only way to reach those sizes today is the elastic void,
and a void needs a row above and a row below to enclose it, which is affordable
in a 70 m2 flat and not in a 40 m2 one. **The change I would make first is to add
three or four larger modules to `src/core/modules.ts`: a kitchen at 7 to 9 m2, a
living room seed nearer 18, and a bedroom between the two that exist.** That is a
change to the app rather than to data, which is why this run could not make it.

The second change is to the packer's shape language. Rows of slots are honest and
they refuse notches, which is what keeps these plans from looking generated, but
they cannot describe a room that spans two bands, and every flat therefore reads
as three or four horizontal strips. Real plans are not strips. Allowing a slot to
span rows, or letting a column of the plan be described vertically, would open up
the L and the pinwheel and would make fifteen flats look less like fifteen
variations of one diagram.

The third is procedural. Do not give a subagent an open-ended design task behind
two long documents. Ten launches produced nothing, and the four that failed
identically all did so on their first turn. Give each subagent a starting layout
that already runs, and let its job be tuning against a tool that prints a
verdict. That is a much smaller task, it is verifiable, and it is what the two
relaunches were changed to before the rate limit ended them.

## Artifacts produced

- `_cowork/outbox/0028-reference-plans.md` — the reference study, 315 lines.
- `_cowork/outbox/0028-contact-sheet.png` — the five on one sheet, 2800 by 812.
- `scripts/flatLayout.ts`, `scripts/gen-flat.mjs` — the generator.
- `scripts/flats/unit-8.flat.json` through `unit-12.flat.json` — the five graphs.
- `public/units/unit-8.json` through `unit-12.json` and the five `.jpg` previews.
- `public/units/index.json` — five new manifest rows.
- `scripts/flatLayout.test.ts`, `src/core/libraryClean.slow.test.ts`.
- `build/units/` — the generator's own output, gitignored.

## Decisions and rationale

**Doors are derived from the packed geometry rather than written by hand.** A
hand-written door is a guess that two rooms share a straight boundary two cells
long, and `floorManager.ts:1006` prunes a door that does not bind two live
spaces, so a wrong guess vanishes in silence and surfaces later as an unreachable
room. Deriving it makes a bad graph edge an error at generation time that names
the pair, and the runner also compares doors written against doors kept. This is
what caught Flat 11.

**The runner boots Vite in middleware mode rather than adding a runner
dependency.** `vite-node` is not installed, Node cannot resolve the app's
extensionless TypeScript imports, and the prompt forbade a new dependency.
Fifteen lines of `createServer` plus `ssrLoadModule` gets the real modules
through the same transform the dev server uses.

**The rotten `unit-5.json` is quarantined rather than fixed.** The prompt says
the seven existing flats stay exactly as they are, and the library-wide test says
zero must-fix everywhere. Both cannot hold. The test names `unit-5.json` and the
exact four rule ids it breaks, so fixing the flat breaks the test, which is the
reminder to delete the quarantine, and a fifth failure breaks it too.

**The manifest commit stages only five rows.** The working tree's `index.json`
also holds rows for Shrey's uncommitted `unit-6` and `unit-7`. Staging the file
as it stood would have written someone else's work into this run's history under
this run's message, so the five rows were staged from a reconstructed file and
the working tree was then put back the way it was.

## Deviations from the prompt

**Task 3's subagents produced nothing and the flats were drawn in the main
session.** Ten launches, all failed, detailed under point 7. The prompt's
requirement that the flats be worked on in parallel by subagents was not met. The
flats themselves meet every other requirement the prompt sets for them.

**Task 4's commit carries the library-wide test rather than task 7's.** The
prompt puts a test that walks every file in `public/units/` under task 7 and
"every flat passes" under task 4. That test IS the proof that every flat passes,
so it landed in `3edbba7`, and `5b94501` carries the generator's own arithmetic.
Both tests exist and both are described in their commits.

**Flat 12 does not reach the reference circulation range.** It runs 29 per cent
against 5 to 15 in the reference plans, and it trips advisory rule N1 three
times. The cause is that N1 counts a stair as circulation and a maisonette
carries one on each storey. The reference sample is entirely single-storey. This
is reported rather than designed around, because reducing it would mean either a
smaller hall that cannot reach every room or a stair the app does not have.

**No flat has a separate storage room.** The brief for Flat 10 asked for a
Reduit, after Else Zueblin West. There is no storage module in the catalogue, and
a small circulation patch placed next to the entree merges into the entree's own
cluster rather than becoming a separate room. It was dropped.

## Blocked / did not do

Nothing the prompt asked for is missing. The subagent parallelism in task 3 is
the one requirement not met, and it is recorded under Deviations because the
task's output exists.

## Open questions for you

**1. Should the module catalogue grow before the next fifteen?** The rooms are
smaller than the rooms in every plan the study read, and the workaround costs
circulation. Adding a larger kitchen, a larger living seed and a mid-sized
bedroom would make the next fifteen easier and better, and it would change what
every existing flat's palette offers. It is a change to the app, so it needs
deciding rather than assuming.

**2. Whose convention decides the room count?** The study found that Swiss room
counts are not defined in law, and that Else Zueblin West publishes a 2.5-room
flat at 68.9 m2 and a 3.5-room flat at 68.6 m2 on the same page. This batch
counts living and dining as one and each Zimmer as one. If the building app is
going to show residents a room count, the thesis has to say whose count it is.

**3. Is a hall-centric rule set a finding or an assumption?** RPLAN, the dataset
of 80,788 real plans behind HouseGAN, makes the living room the circulation hub
and places it first. This app's rules and these five flats encode the European
hall instead. That is defensible and it is not neutral, and the thesis is where
it should be said out loud rather than left implicit in a rules table.

## Suggested next prompt

**0029, the other fifteen.** Reuse `scripts/gen-flat.mjs` unchanged. Before
drawing anything, add the larger modules to `src/core/modules.ts` if question 1
is answered yes, and regenerate the five from `scripts/flats/*.flat.json` so the
whole batch of twenty shares one catalogue. Then draw fifteen more flats spanning
the same size range, each starting from a layout that already runs rather than
from a blank diagram, and each traced to a plan in
`_cowork/outbox/0028-reference-plans.md` or to one added to it. Return the same
evidence this run returned: the raw generator output per flat, the wet-room gap
table, and a contact sheet of all twenty. The prompt should also decide what to
do about `public/units/unit-5.json`, which is quarantined in
`src/core/libraryClean.slow.test.ts` and is the only flat in the library that
cannot be opened without four must-fix findings.
