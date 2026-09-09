---
id: "0043"
title: Flat 31, the plain room names, and the test group says so
source: 0043-flat-31-and-the-plain-room-names.md
status: complete
branch: run/0043
commit: 26f6f86
completed: 2026-09-09
---

## Summary

Three things, all six tasks landed. The library entry saved from the app on
8 September now reads "Flat 31", and the path that let a "Unit" name through is
closed by naming a library entry and filing it separately. Every screen shows a
plain room name, "Small bedroom" for the stored "Bedroom — Small", through one
table that no file ever reads. A group filled by the script says so in its last
message. The fast suite goes from 496 to 517 and the three tests that were red
for two days are green.

## What I did

Eight commits on `run/0043`, cut from `main` at `47150a1`, which is the merge of
run 0042 and does carry it. Nothing was staged with `git add -A`.

| Commit | Title | Stats |
|---|---|---|
| `6321a42` | library: Flat 31, and no way to name a Unit | 7 files, +3524 −22 (3446 of them the new `unit-31.json`) |
| `8760338` | words: the rooms by their plain names | 7 files, +932 −831 |
| `89a21a2` | script: a filled group says it was filled | 3 files, +52 −3 |
| `ea8c95d` | tests for 0043 | 3 files, +186 −1 |
| `f6ac40a` | words: what the finishing pass found on screen | 6 files, +35 −3 |
| `289570e` | docs: PROJECT_STATE for run 0043 | +79 |
| `26f6f86` | fix: graphView.ts and dragChrome.ts keep their line endings | +21 −30 over `src/ui/` |

`8760338` and `26f6f86` are one change and its repair, described under
Deviations. The whole run against `main` is 23 files, +4007 −59.

## Findings

**The path that produced "Unit 31", and what closed it.**
`src/library/naming.ts:29` returned `Unit N` for the library entry, from the
convention of 10 August, and run 0035 renamed every row to `Flat N` without
moving it. `src/main.ts:2059` passed that name to `saveLibraryEntry`, and the
sink at `vite.config.ts:102` derived the entry's id from its name. So no one
string could be both the name a person reads, `Flat 31`, and the id the live
store links a published flat by, `unit-31`. A `flat-31` id would collide with
the project file's own slug, which `src/library/libraryNames.test.ts:67`
forbids outright. Every library save since run 0035 would have written a row
reading `Unit N`; the entry of 12:47 on 8 September is the first one anybody
saved.

It is closed by naming the two separately. `libraryNameFor` at
`src/library/naming.ts:38` gives `Flat N` and `libraryIdFor` at `:49` gives
`unit-N`. Both are sent to the sink, and the sink files under the id it is
given (`vite.config.ts:156`), falling back to the name for a caller that sends
none. `findLibraryEntry` takes the id too, so a row renamed to something else
is still found by the design number it owns. The library's own copy of the file
is built with the library's name, so a row and the file it points at agree,
which `src/library/libraryNames.test.ts:74` requires. The unit file a person
downloads is built beside it with `unitNameFor` and is unchanged.

**The display-name table, all twenty-two rows.** Twenty are the stored preset
names. The twenty-first and twenty-second are group labels, found on screen by
the finishing pass and explained below.

| Stored | On screen |
|---|---|
| `Stair — Straight` | Straight stair |
| `Stair — Dogleg` | Dogleg stair |
| `Stair — Dogleg, generous` | Generous dogleg stair |
| `Stair — Spiral` | Spiral stair |
| `Stair — C, three flights` | C stair, three flights |
| `Stair (dogleg, retired)` | Dogleg stair, retired |
| `Living Room` | Living room |
| `Kitchen` | Kitchen |
| `Bedroom — Small` | Small bedroom |
| `Bedroom — Large` | Large bedroom |
| `Bathroom — Small` | Small bathroom |
| `Bathroom — Large` | Large bathroom |
| `WC — minimal` | Minimal WC |
| `Bathroom — Full` | Full bathroom |
| `Bathroom — Full, compact` | Compact full bathroom |
| `Recreation Room` | Recreation room |
| `Circulation — Single` | Single hall |
| `Circulation — Double` | Double hall |
| `Outdoor — Single` | Single outdoor space |
| `Outdoor — Double` | Double outdoor space |
| `Circulation` | Hall |
| `Outdoor` | Outdoor space |

`ROOM_NAMES` in `src/core/words.ts:546` holds it and `roomName()` reads it with
the stored name as the fallback. The same table is in
`_cowork/design/room-names.md` for the building app to copy.

**Nineteen presets, twenty-two rows.** The palette offers nineteen. The retired
dogleg stair at `src/core/modules.ts:220` is kept in `MODULE_DEFS` so an old
flat holding one still renders and nothing new can be created from it, so it is
a name a file can carry and the palette never offers. The last two are the
group labels: circulation and outdoor cells that touch become ONE node in the
adjacency graph, and `src/core/adjacencyGraph.ts:192` labels that node with the
preset's group rather than its name.

**The store has no public door for its own voice.** An empty `who` is what the
store speaking means, which is how "Ben left the group." reads
(`leftMessage` at `src/session/store.ts:173`). `POST /messages` refuses it:
`residentName` at `src/session/store.ts:402` answers
`400 resident name must be 1-64 printable characters` for an empty name, and
the leave line is written inside the store rather than posted. Seen live, and
now pinned by `scripts/store-roundtrip.mjs`.

## Evidence

Everything ran against `netlify dev` on `http://localhost:8888`, on the
throwaway group `walk-0043` and on the round trip's own generated codes.

**The three red tests are green, and 21 more cases exist.**

| suite | before (`47150a1`) | after |
|---|---|---|
| fast | 496 in 24 files, 3 failing | 517 in 24 files, 0 failing |
| slow | 59 passed, 1 expected fail, in 4 files | 59 passed, 1 expected fail, in 4 files |

The 21 are 8 in `src/library/naming.test.ts`, 9 in `src/core/words.test.ts` and
4 in `scripts/fillGroupTable.test.ts`.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes. That is what proves the three downloads did not move.

**The three downloads are byte-identical.** `git diff --stat 47150a1 HEAD` over
`src/core/unitExport.ts`, `src/core/saveFiles.ts`, `src/core/modules.ts`,
`src/core/projectIO.ts`, `docs/bridge-format.md` and `testflats/` returns
nothing at all. One test reads `unitExport.ts` and `adjacencyGraph.ts` as text
and fails if either ever calls `roomName`, so a display name cannot reach a
file by accident later.

**The landing fingerprint test passes at 16.**

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 23.30 s.**

**`scripts/store-roundtrip.mjs` passes 100 checks**, ending
`all checks passed`. Two of them are new: that `POST /messages` refuses an
empty `who` with 400, printed as
`an empty who: 400 {"error":"resident name must be 1-64 printable characters"}`,
and that the line a filled group carries reads back last under its name.

**The fill script's last line landed.** `node scripts/fill-group.mjs
http://localhost:8888 walk-0043 --replace` printed
`ok 201 The app said what this group is "This group was filled for a test, with
twenty people who are not real."` and the group's last message read back as
`{"who":"The app","text":"This group was filled for a test, with twenty people
who are not real.","at":"2026-09-09T09:15:22.478Z"}`.

## The finishing pass

Task 5, run at 1440 by 900 through headless Chrome driven over its debugging
protocol, on a flat loaded from `testflats/flat-1-no-stair.json` so every screen
had rooms and a fault to name.

**The palette. Seen.** It reads `Living room | Kitchen | Small bedroom | Large
bedroom | Minimal WC | Full bathroom | Compact full bathroom | Small bathroom |
Large bathroom | Recreation room | Single hall | Double hall | Single outdoor
space | Double outdoor space | Straight stair | Dogleg stair | Generous dogleg
stair | Spiral stair | C stair, three flights`, with the three tools beneath.
No em dash anywhere in it.

**The layout report. Seen, and found wrong once.** It read
`Circulation (F1, 8,14)` while the palette beside it read `Single hall`, which
is the disagreement this run set out to end. The cause is the cluster label
above. Two rows fixed it and the report now reads `Hall (F1, 8,14)`. The rest of
the panel read `This circulation is narrower than 1.2 m across 2 cells. A
wheelchair needs 1.2 m.`, `The whole flat`, `add a stair reaching that floor`,
and the strip `Circulation is 19% of the inside (17% on floor 0, 23% on floor
1) · The deepest room is 4 rooms from the entrance, 2.3 on average · Living
spaces sit 0.5 rooms in, bedrooms 3.0`.

**The diagram. Seen**, and captured.

**The library. Seen.** `UNITS 31`, every row reading `Flat N`, `Flat 31`
present at y 764 after scrolling, and the string "Unit 31" nowhere on the page.

**The selection read-out and the drag ghost. Not seen, and not verifiable this
way.** Both are driven by pointer events the 3D view raycasts, and a synthetic
`PointerEvent` at a canvas coordinate selected nothing. They take the same
`W.roomName(def.name)` call as the palette, which is one line in each
(`src/main.ts:494` and `src/ui/dragChrome.ts:92`), and the mechanism is the one
the report chips proved on screen. Marked as read from the code rather than
seen, which is what the pass is for saying.

## Artifacts produced

- `_cowork/outbox/0043-flat-31-and-the-plain-room-names.report.md` — this file.
- `_cowork/outbox/0043-step-01-plain-names.png` — the palette and the layout
  report, 1440 by 900, 375131 bytes.
- `_cowork/outbox/0043-library-flat-31.png` — the library scrolled to Flat 31,
  1440 by 900, 574243 bytes.
- `_cowork/outbox/0043-diagram-plain-names.png` — the adjacency diagram, 1440 by
  900, 379600 bytes.
- `_cowork/design/room-names.md` — the table for the building app to copy.

## Decisions and rationale

**A library entry is named and filed separately, rather than the id being
derived.** Deriving one from the other is what made the two rules
unsatisfiable. The sink still derives when it is sent no id, so nothing that
called it before behaves differently.

**The library's stored copy of the file carries the library's name.** The test
at `src/library/libraryNames.test.ts:74` requires a row and its file to agree,
and every existing library file already carries `Flat N`. The unit file a person
downloads is built separately, so no download changed.

**`shortLabel` in the diagram is gone rather than adapted.** It stripped a
"— Variant" suffix so the node read `Bedroom` and the radius carried the size.
The plain names put the variant first, so there is nothing left to strip, and
adapting it would have meant a second table of bare type words.

**The line a filled group carries is said by "The app".** The alternative was
to give the store's own voice a public door, which is a change to the store
that this run was told not to make.

## Deviations from the prompt

**"The three red tests go green without being changed" was not possible.**
`ORDER` in `src/library/libraryNames.test.ts:39` is a hand-written list of ids
and the `unit-` count at `:69` is a literal, so no 31st entry can pass either,
whatever it is called. The file's own note at `:23` says a change to that list
has to be a deliberate edit there, and `LATER` at `:37` already held `unit-29`
for exactly this case, a row saved from the app after run 0035's prompt was
written. `unit-31` joined it and the count went from 28 to 29. Only the third
test, the naming rule, went green untouched.

**Assumption 3 was wrong.** The prompt said the fill script writes messages
through `POST /messages` with a `who`, and that an empty `who` is the store's
own voice. The first half is right and the second is not: the store refuses an
empty `who` on that call. Set out under Findings. The line is said by a name
instead.

**Assumption 1 named three candidate paths and it was none of them.** It
suggested the "More" fold's library save, a rename, or the dev endpoint. The
"More" fold is the caller, but the name came from `src/library/naming.ts:29`,
two calls up, and the endpoint's id derivation is what made the two rules
unsatisfiable. Neither the rename path nor the endpoint alone could have been
fixed to close it.

**Task 2 asked for one table of twenty and it is twenty-two.** The extra two are
the cluster group labels, which a person reads in the layout report and on the
diagram and which no preset carries. The finishing pass found them.

**Two commits repair line endings I broke.** `src/ui/graphView.ts` and
`src/ui/dragChrome.ts` are stored with LF while most of this repository is
CRLF, and my edit scripts rewrote both whole, burying a two-line change in a
1356-line diff. Both were rebuilt from the blobs they had on `main` and
re-edited. This is the second run in a row it has happened, and the fix is
under Suggested next prompt.

## Blocked / did not do

None.

## Open questions for you

1. **The building app has not had the room-name table, and until it does the
   two apps name the same room differently.** `_cowork/design/room-names.md`
   holds it byte for byte and says how to read it, but a flat sent from here
   arrives there carrying `Bedroom — Small` in its `roomTypes`, and that is what
   the building app will show on the group screen and on the vote's cards. The
   thesis argument decides whether that matters enough to run before the
   presentation: a resident who draws "Small bedroom" and then sees "Bedroom —
   Small" beside their own flat is reading two names for one room, which is the
   thing run 0042 and this run set out to end.

2. **The library's name and its id have now come apart in the data, and nothing
   records which is which for a reader.** A row reads `Flat 31` and is filed
   under `unit-31`, and `unit-8` reads `Flat 1`. That is deliberate and it is
   explained in `src/library/naming.ts`, but `docs/library-format.md` still
   describes the older arrangement. Whether the library should be renumbered so
   the two agree, which would break every id the live store links by, or the
   split should simply be written down in the format document, is a decision
   about the record rather than about the code.

## Suggested next prompt

Stop the line-ending damage, because it has now cost two runs. Add a
`.gitattributes` that fixes the working-tree line ending for every text file in
this repository, and normalise the files that disagree with it in one commit
whose only content is that normalisation. Today `src/ui/graphView.ts`,
`src/ui/dragChrome.ts`, `src/core/projectIO.ts`, `src/ui/validationPanel.ts` and
`PROJECT_STATE.md` are LF while most of `src/` is CRLF, so any edit written back
in the wrong one rewrites the whole file and hides the real change. The run
should report which files moved, prove the working tree is unchanged in content
by diffing with `--ignore-all-space` before and after, and confirm both suites,
`tsc`, the build, the fingerprint test and both fixture baselines.
