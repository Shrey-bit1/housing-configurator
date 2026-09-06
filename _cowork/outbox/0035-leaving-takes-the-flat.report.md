---
id: "0035"
title: Leaving takes the flat, renaming keeps it, and the library counts from one
source: 0035-leaving-takes-the-flat.md
status: complete
branch: run/0035
commit: 03ac2a4
completed: 2026-09-06
---

## Summary

A person can now leave a group and their flats leave with them, and a person can
rename themselves and keep theirs. Both are one HTTP call, both refuse by the
same ownership rule the store has used since run 0026, and both were driven
against a live store as well as in memory. The library was renumbered so every
entry reads Flat 1 to Flat 30, step 02 now says when the group is looking at an
older flat than the one on the screen, and the sentence under step 01's button
says what an entrance is for. All nine tasks landed on `run/0035`, which
branched from `main` at `9ae2108` and ends at `03ac2a4`.

Two things the run found that the prompt could not have known. The flat the
library test has quarantined since run 0028 has been redrawn and is now clean,
so the quarantine was deleted rather than kept. And a thirtieth library entry
exists, saved from the app on 6 September after the prompt was written, so the
numbering runs to Flat 30.

## What I did

Nine commits, in the order the prompt asked for them. The branch state found on
`main` was `9ae2108`, "Merge run/0034: one way forward, and the landing arrives
in order", with nothing on `main` touched at any point.

`b09a59c` **store: leaving takes the flat**, two files, 81 insertions and 11
deletions. `src/session/store.ts:441-467` is the DELETE branch;
`src/session/store.ts:228-256` are the helpers over `sameResident`;
`src/session/store.ts:49` adds `delete` to `KV`;
`src/session/store.ts:199` is the CORS methods line.
`src/session/store.test.ts:28-30` gives `MemoryKV` a `delete`, and its CORS
assertion follows the new line.

`20ad284` **store: a new name keeps the flat**, one file, 34 insertions.
`src/session/store.ts:401-439` is the rename branch.

`09c6f08` **docs: leave and rename**, one file, 72 insertions and 1 deletion.
`docs/store.md:88-89` are the two call-table rows, `docs/store.md:317-381` the
two sections, `docs/store.md:47-50` the sentence in the sessions section, and
`docs/store.md:62-67` the corrected CORS line.

`55fdd10` **store: the round trip leaves and renames**, one file, 72 insertions
and 1 deletion. `scripts/store-roundtrip.mjs:200-268` is section 9.

`50918db` **copy: what the entrance is for**, two files, 7 insertions and 6
deletions. `src/core/flatState.ts:117-122` is the reworded constant.

`677c4f0` **ui: the group still has the old one**, five files, 87 insertions and
20 deletions. `src/core/flatState.ts:66-115` carries `SendState`,
`sendButtonLabel`, `GROUP_HAS_OLDER`, `staleNotice` and `afterEdit`.
`index.html:282` is `#send-stale`; `src/style.css:514-526` styles it; and
`src/main.ts` carries the wiring at the flag, the edit, the sync and the click.

`480617b` **library: Flat 1 to Flat 30**, thirty-seven files, 9484 insertions
and 993 deletions. Thirty `name` fields in `public/units/*.json`, thirty in
`public/units/index.json`, and `src/core/libraryClean.slow.test.ts:27-42` where
the quarantine was. The bulk of that diff is not this run's work and is
described under **Deviations**.

`f52ab58` **session: tests for 0035**, four files, 303 insertions and 2
deletions. `src/session/store.test.ts:621-683` is leaving and
`src/session/store.test.ts:685-752` renaming;
`src/core/flatState.test.ts:156-193` is the step 02 sentence; and
`src/library/libraryNames.test.ts` is new at 82 lines. It also carries one store
fix, `src/session/store.ts:241-247`, described under **Findings**.

`03ac2a4` **docs: PROJECT_STATE for run 0035**, one file, 108 insertions and 10
deletions.

## Findings

**The store had no way to delete anything at all.** `KV` named three methods,
`get`, `getWithMetadata` and `set` (`src/session/store.ts:41-50` after the
change, where `delete` is line 49). Withdrawing a flat by writing an empty string over it would have left
a body that `/export` still reads, since `/export` walks every id in the index
and fetches its blob, so `delete` was added. `@netlify/blobs`' `Store` already
has it, and the interface is satisfied structurally, so the Netlify entry at
`netlify/functions/session.mts:9` needed no change.

**One ownership rule, reached three ways rather than answered twice.**
`sameResident` at `src/session/store.ts:263-265` is unchanged. Three helpers sit
over it. `residentKey(index, who)` at `src/session/store.ts:228-230` finds the
key a row is filed under, because a row is keyed by the name AS TYPED and "ana"
must still find "Ana"'s. `flatsOwnedBy(index, who)` at
`src/session/store.ts:250-255` finds that person's flats, sorted so a removal
and a rename report the same list in the same order. `storedName` at
`src/session/store.ts:241-246` gives the spelling the store already holds.

**That last helper is a fix the tests found.** A person who published a flat and
never sent any wishes has no resident row at all. Before the fix, `DELETE
.../residents/dan` answered `{"resident":"dan"}`, echoing the URL, while the
store held "Dan" on the flat. `docs/store.md:328-330` promises "the name in the
answer is the name as it was stored, not as it was typed in the URL", so the
helper now falls back to the name recorded against a flat they own before
falling back to what was typed. The test that found it is
`src/session/store.test.ts:663-668`.

**Renaming to another spelling of one's own name had to be allowed.** The
prompt says `409` if the new name already has a row or a flat. Read literally
that refuses "ana" renaming to "Ana", because "ana" already holds both. That is
the case the call mostly exists for, since it is how a person who typed their
name two ways stops being two people, so the clash check at
`src/session/store.ts:420-425` skips itself when `sameResident(who, to)`.

**Leaving takes the profile and the flat and nothing else.** The messages and
the building run keep the person's name. A message is an append-only record of
something that was said and a building run records who asked for it; neither is
a profile or a flat. After Ben leaves, `messages` still carries what he said and
`building.by` still reads "Ben". This is raised as an open question because the
prompt's wording, that the index and `/export` "no longer mention them", can be
read the other way.

**Under `netlify dev`, a 404 from the function is not the last word.** The dev
server retries the same path with `.html` appended, and again as
`/index.html`, and the client sees THAT response. Measured in the dev server's
own log during this run:

```
Request from ::1: GET /api/session/probe-0035/flats/nope
Response with status 404 in 355 ms.
Request from ::1: GET /api/session/probe-0035/flats/nope.html
Response with status 400 in 377 ms.
```

The `400` is correct on its own terms, since a dot is not a legal flat id, but a
caller that reads only the status of the last response sees a `400` it cannot
explain. It cost about twenty minutes of this run before the log made it plain.
`scripts/store-roundtrip.mjs:247-254` now checks that a withdrawn flat's body
does not come back rather than checking for a bare `404`, and says why.

**The quarantined flat is no longer rotten.** `unit-5.json` was written at 17:27
on 6 September, before this run started, and now reports zero must-fix
violations where it used to report four. The quarantine's own header
(`src/core/libraryClean.slow.test.ts:27-34` as it stood on `main`) said that fixing
the flat would break the test and that breaking it was the reminder to delete
the entry, so the entry was deleted. On the working tree as this run found it,
the slow suite was already failing for that reason before any change of mine.

**One boolean could not carry the step 02 sentence.** Run 0034's `hasSent` is
false both before a send and after an edit that follows a send, and those two
moments want different words. The prompt asked for one flag and no second one,
so the flag grew a third state instead of gaining a neighbour: `SendState` at
`src/core/flatState.ts:80` is `never`, `sent` or `edited`. Two booleans would
have had four combinations and only three of them mean anything.

**The manifest has nowhere to put a descriptor.** `checkEntry` at
`src/library/manifest.ts:50-80` accepts exactly id, name, color, file, preview,
storeys, areaM2 and savedAt, and returns an object with those eight keys and no
others, so anything else in a row would be dropped on the way through the
parser. The descriptors are therefore gone from the library and survive only in
the table below.

## Evidence

Everything below was executed. Nothing is estimated.

**A leave, whole.** From `scripts/store-roundtrip.mjs` against `netlify dev`,
session `rt-mtpzdje1`. The state before, with two residents and two flats, one
of which has just had a picture stored:

```
PUT http://localhost:8899/api/session/rt-mtpzdje1/flats/flat-3/preview
200 OK  {"ok":true,"bytes":22}
```

The call and its answer:

```
DELETE http://localhost:8899/api/session/rt-mtpzdje1/residents/BEN
200 OK  37 bytes  cors=*
{"resident":"Ben","flats":["flat-3"]}
```

The URL spells his name `BEN` and the answer gives back `Ben`, the spelling the
store held. The state after:

```json
{"code":"rt-mtpzdje1","flats":[{"id":"flat-2","resident":"Ana B","label":"Flat 2 again","version":2,"changed":false,"preview":false,"bbox":[0,0,15,14],"floors":1,"areaCells":194,"publishedAt":"2026-09-06T15:42:53.149Z"}],"residents":[{"name":"Ana B","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}],"building":{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","at":"2026-09-06T15:42:57.048Z","plot":{"modulesX":11,"modulesY":11,"floors":7}},"exists":true,"messages":[{"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T15:42:55.077Z"},{"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T15:42:55.486Z"}]}
```

No resident row and no flat summary carries his name. The building run's `by`
and the second message still do, which is the behaviour described under
**Findings**. Leaving again answers `404`. His flat's body and his flat's
picture are both gone from the store, not merely unlisted. The export after,
with the one remaining body abbreviated:

```json
{"code":"rt-mtpzdje1","flats":[{"id":"flat-2","resident":"Ana B","label":"Flat 2 again","version":2,"changed":false,"preview":false,"bbox":[0,0,15,14],"floors":1,"areaCells":194,"publishedAt":"2026-09-06T15:42:53.149Z"}],"residents":[{"name":"Ana B","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}],"building":{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","at":"2026-09-06T15:42:57.048Z","plot":{"modulesX":11,"modulesY":11,"floors":7}},"exists":true,"messages":[{"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T15:42:55.077Z"},{"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T15:42:55.486Z"}],"bodies":{"flat-2":"<37484 bytes>"},"exportedAt":"2026-09-06T15:43:07.262Z"}
```

`bodies` holds one entry where it held two.

**A rename, whole, and the refusal.** The URL spells her name `ana`, in the
wrong case on purpose:

```
POST http://localhost:8899/api/session/rt-mtpzdje1/residents/ana/rename
200 OK  46 bytes  cors=*
{"from":"Ana","to":"Ana B","flats":["flat-2"]}
```

Her record came with her, unchanged apart from the name it is filed under:

```json
{"name":"Ana B","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5,"wishes":{"corner":true,"terrace":false,"quiet":true}}
```

Nobody is called Ana any more, and her flat reads `"resident":"Ana B"`. The
refusal, again spelling the taken name in a case the store never held:

```
POST http://localhost:8899/api/session/rt-mtpzdje1/residents/Ana B/rename
409 Conflict  70 bytes  cors=*
{"error":"\"ben\" is already at the table in session \"rt-mtpzdje1\""}
```

**The round trip's own tally.** `node scripts/store-roundtrip.mjs
http://localhost:8899` exits 0 with `all checks passed for session
"rt-mtpzdje1"`. It runs 64 checks, up from 52 before this run. The preflight
line it prints is
`allow-methods=GET, POST, PUT, DELETE, OPTIONS  allow-headers=content-type`.
The full output is 207 lines and is not pasted whole here; the sections that
matter are quoted above, and the script prints every response raw when run.

**The step 02 sentence, quoted.** It reads: "Your group still has this flat as
you sent it. Sending again replaces it." It is `GROUP_HAS_OLDER` at
`src/core/flatState.ts:98-99`.

**Its four states, driven live** in the browser at 1440x900 against
`netlify dev`, reading the DOM rather than a screenshot.

| moment | `#save-go-label` | `#send-stale` | rendered |
|---|---|---|---|
| loaded, never sent | `Send it` | empty | no |
| sent, no edit since | `Go to your group` | empty | no |
| sent, then edited | `Send it` | the sentence | yes, `rgb(214, 52, 28)` |
| sent again | `Go to your group` | empty | no |

The send that produced the second row answered "Sent to run-0035 as Unit 28 ·
open Units to see your group." The edit was an undo and a redo through the
app's own buttons, each of which reaches `refreshFlatFigures`. In the third
row the sentence sits at y 426 with the button spanning y 360 to 406, so it is
directly under the button. The second send answered "Sent to run-0035 as Unit
30". `rgb(214, 52, 28)` is `--accent`, `#d6341c`. When empty the element is not
in the layout, through `.send-stale:empty` at `src/style.css:524-526`.

**The library manifest after, all thirty rows.** The descriptors are in the
middle column and exist nowhere else now.

| id | was | now |
|---|---|---|
| unit-8 | Flat 08 — one bedroom, corner | Flat 1 |
| unit-9 | Flat 09 — two rooms, hall between | Flat 2 |
| unit-10 | Flat 10 — two rooms, off the living room | Flat 3 |
| unit-11 | Flat 11 — three rooms, deep hall | Flat 4 |
| unit-12 | Flat 12 — four rooms, maisonette | Flat 5 |
| unit-13 | Flat 13 — one bedroom, patio corner | Flat 6 |
| unit-14 | Flat 14 — one bedroom, inner kitchen | Flat 7 |
| unit-15 | Flat 15 — one bedroom, stepped | Flat 8 |
| unit-16 | Flat 16 — two rooms, inner kitchen | Flat 9 |
| unit-17 | Flat 17 — two rooms, wide hall | Flat 10 |
| unit-18 | Flat 18 — two rooms, stepped south | Flat 11 |
| unit-19 | Flat 19 — two rooms, maisonette | Flat 12 |
| unit-20 | Flat 20 — two rooms, corner turn | Flat 13 |
| unit-21 | Flat 21 — three rooms, through | Flat 14 |
| unit-22 | Flat 22 — three rooms, deep hall | Flat 15 |
| unit-23 | Unit 23 | Flat 16 |
| unit-24 | Flat 24 — three rooms, inner core | Flat 17 |
| unit-25 | Flat 25 — four rooms, maisonette | Flat 18 |
| unit-26 | Flat 26 — four rooms, long spine | Flat 19 |
| unit-27 | Flat 27 — four rooms, upside down | Flat 20 |
| flat-2-single-storey | Flat 2 — single storey | Flat 21 |
| flat-3-terrace | Flat 3 — terrace | Flat 22 |
| unit-1 | Unit 1 | Flat 23 |
| unit-2 | Unit 2 | Flat 24 |
| unit-3 | Unit 3 | Flat 25 |
| unit-4 | Unit 4 | Flat 26 |
| unit-5 | Unit 5 | Flat 27 |
| unit-6 | Unit 6 | Flat 28 |
| unit-7 | Unit 7 | Flat 29 |
| unit-29 | Unit 29 | Flat 30 |

`unit-23` and `unit-5` had already lost their descriptors before this run, having
been redrawn and re-saved from the app on 6 September, which is why their "was"
column reads as a bare number. Every id is unchanged, every `file` is still
`{id}.json` and every `preview` still `{id}.jpg`, and everything in the manifest
other than the thirty name strings is byte-identical to what it was before the
rename: the script that did it asserted that, comparing every row with its
`name` key removed. The names were changed by editing the files, not through the
library's own dev rename path at `src/main.ts`: thirty renames through a browser
is thirty chances to mis-click, and the flat's own name is one line in each
file, the first `  "name":` at indent two. The other seven `"name"` keys in each
file are room-type names and were not touched. The contact sheet at
`_cowork/outbox/0029-contact-sheet.jpg` was NOT regenerated and still carries
the old names.

**Test counts.** Measured, not recalled: `main` at `9ae2108` was checked out
into a throwaway `git worktree` with `node_modules` junctioned in, and both
suites were run there.

| suite | on `main` | on `run/0035` |
|---|---|---|
| fast | 309 in 19 files | 338 in 20 files |
| slow | 55 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

The 29 new fast cases are 17 in `src/session/store.test.ts`, 6 in
`src/core/flatState.test.ts` and 7 in the new
`src/library/libraryNames.test.ts`, less one that was rewritten rather than
added. The 3 extra slow cases are the three library files that reached the
working tree on 6 September, `unit-6.json`, `unit-7.json` and `unit-29.json`,
which the glob in `src/core/libraryClean.slow.test.ts` picks up automatically.

**Both fixture baselines are unchanged at 12 and 7.** `flat-1-two-storey.json`
reads 1 hard plus 11 soft and `flat-1-no-stair.json` 1 hard plus 6 soft; both
are asserted inside the slow suite, which passes.

**The three downloads are byte-identical and the store contract changed only as
asked.** `git diff --stat main HEAD` over `src/core/rules.ts`,
`src/core/saveFiles.ts`, `src/core/savePlan.ts`, `src/core/modules.ts`,
`docs/bridge-format.md` and `testflats/` returns nothing at all. `docs/store.md`
changed by exactly the two call-table rows, the two new sections, the CORS line
and one sentence in the sessions section.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 10.17 s**, 84 modules,
`dist/index.html` 25.37 kB, CSS 40.86 kB, JS 3430.75 kB.

## Artifacts produced

- `_cowork/outbox/0035-leaving-takes-the-flat.report.md` — this file.
- `src/library/libraryNames.test.ts` — new, 82 lines, 7 cases.
- `public/units/index.json` and thirty `public/units/*.json` — renamed.
- `docs/store.md` — two new sections and two new call-table rows.
- `scripts/store-roundtrip.mjs` — section 9, 64 checks in total.
- `PROJECT_STATE.md` — new §16.
- `_cowork/CONTEXT.md` — one paragraph for run 0035, **Last updated** 2026-09-06.

## Skills read from disk

Two, from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\f1d881be-0a13-45d3-acab-472cf2886dae\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\skills\`.

`interoperability/SKILL.md`, 53097 bytes. Its section 7.1 maps REST verbs onto
what a caller may assume, and it is the reason leaving is a `DELETE` and
renaming is a `POST` rather than both being one `PUT` with a mode flag: the verb
is the part of the contract a caller reads first, and a building app that sees
`DELETE` on a resident knows what it costs without reading prose. Its section
3.5, database-mediated exchange, is the shape these two apps already have, and
it makes the case that the shared store is where a state change belongs rather
than in a message between the tools, which is why the building app can call this
directly instead of asking the flat app to do it. Its section 1.4, the data-loss
taxonomy, named the loss this run had to avoid: relationship loss. A rename that
moved the row and left the flats behind would keep every field and still break
the link between a person and their flat, which is exactly the row it describes.

Rejected from it: sections 2, 4, 5, 6 and 8 to 10, which are file formats,
Rhino, Revit, Speckle, schema mapping and coordinate systems. This run moved two
JSON records inside one store. Its section 7.5 on rate limiting was considered
for the DELETE path and rejected: a group is five people at human speed, and the
index write already retries under an ETag.

`design-automation/SKILL.md`, 45081 bytes. Its section 2.1, production rules,
decided the shape: one rule stated once and read by every consumer cannot be
inconsistent, and a rule restated at each consumer eventually is. `sameResident`
was already that rule for the publish check, so leaving and renaming reach it
through `residentKey`, `flatsOwnedBy` and `storedName` rather than each deciding
for itself who owns a flat. Its section 2.6 on conflict resolution, specifically
that a more specific rule overrides a general one, is the argument for the
self-clash exception in the rename: the general rule refuses a taken name, and
the more specific one says a person is not taken by themselves.

Rejected from it: sections 3 to 6 on constraint satisfaction, space planning,
layout generation and drawing automation. This run placed no rooms and generated
no geometry. Section 8.4 on audit trails was considered for the leave path and
rejected as beyond the prompt: nothing records that a person left, which is
raised as an open question.

## The Assumptions, checked

**Assumption 1 holds.** The store had `PUT` for a flat and for a resident and no
`DELETE` on either, and `OPTIONS` answered `GET, POST, PUT, OPTIONS`
(`src/session/store.ts:199` after the change), so a browser's preflight
would indeed have refused a `DELETE`. The building app's `TypeError: Failed to
fetch` is consistent with that.

**Assumption 2 holds.** Ownership is `sameResident` at
`src/session/store.ts:229-231`, used by the replace check at
`src/session/store.ts:366`.

**Assumption 3 holds.** `NO_WAY_IN` is at `src/core/flatState.ts:122` and is
read in three places, all through the one constant.

**Assumption 4 holds in substance and is now out of date in form.** `hasSent`
was at `src/main.ts:1005` and was cleared on any edit inside
`refreshFlatFigures`, and
`publishUnit` does return a version number. It is now `sendState`, a
three-valued flag in the same place, for the reason under **Findings**.

**Assumption 5 is wrong in two ways, and both were caused by work done on
6 September after the prompt was written.** The manifest holds thirty rows, not
twenty-nine: `unit-29` was saved from the app at 17:28 with its file, its
picture and its row. And `unit-5` is no longer rotten: it was redrawn at 17:27
and reports zero must-fix violations where it reported four. The rest of the
assumption is right, including that `unit-23` had lost its name and read
"Unit 23", and that the group `review-0023` references `unit-6`, `unit-7` and
`unit-8` by id, which is why no id was changed.

**My own assumptions, and what each costs if it is wrong.**

*That "leaving takes the flat" does not mean taking the messages.* A person's
messages and any building run they asked for keep their name. If leaving should
erase what somebody said, the change is one more loop inside the same
`updateIndex` call and the tests move with it. This is open question 1.

*That renaming to another spelling of one's own name must be allowed.* The
prompt's `409` rule, read literally, forbids it. If a pure case change should be
refused, delete the `sameResident(who, to)` guard at
`src/session/store.ts:420`.

*That `unit-29` belongs at the end.* It fits neither list the prompt gives. If
it belongs among the twenty designed flats, every number after it shifts by one
and `src/library/libraryNames.test.ts:25-40` is where the order is written down.

*That the quarantine should be deleted rather than retargeted.* The flat is
clean, and the test's own header said deleting was the right move. If the
quarantine was meant to survive as a record, it can come back as a comment;
nothing else depends on it.

*That editing the files beat driving the library's rename button thirty times.*
The result is checked by `src/library/libraryNames.test.ts`, which reads both
the manifest and every file, so the route taken does not change what can be
proved about the outcome.

## Decisions and rationale

**`DELETE` answers `404` when the person has neither a row nor a flat, and
`200` when they have either.** A person who published and never sent wishes, and
a person who sent wishes and never published, are both at the table and both can
leave. Only somebody with nothing at all is absent.

**The index is written before the blobs are deleted.** A crash between the two
leaves bytes nothing points at, which nothing reads and which costs storage. The
reverse leaves the index promising a flat `/export` cannot fetch, which is a
broken export. `src/session/store.ts:458-462` carries the note.

**Rename is `POST .../rename` rather than `PUT` on the resident with a `to`
field.** A `PUT` on `residents/{name}` already means "merge these answers into
this person", and giving that body a key that moves the row would make one call
do two unrelated things. A caller could then rename by accident.

**`flatsOwnedBy` sorts.** Object key order is not something a caller should have
to reason about, and both calls report a list.

**The library's names were changed by editing the files.** The prompt offered
either route and asked which. Thirty renames through the browser is thirty
chances to mis-click, and each file's own name is one line.

## Deviations from the prompt

**Thirty entries, not twenty-nine.** `unit-29` was saved from the app at 17:28
on 6 September, after the prompt was written. The prompt says nothing is
removed, so it was numbered Flat 30 at the end rather than dropped.

**The quarantine was deleted rather than kept.** Task 7 says `unit-5` keeps its
quarantine under its new name. It cannot: the flat was redrawn on 6 September
and now passes every rule, so the quarantine's assertion that it fails exactly
P1, H1, ST3 and ST2 fails. On the working tree as this run found it, the slow
suite was already red for that reason. `QUARANTINE` is kept as an empty table so
the next rotten arrival has the same shape to slot into. Nothing else in the
test changed, and it still globs every file.

**The quarantine was keyed by file name, not by display name.** Task 7 says it
keeps its quarantine "under its new name". The table was keyed `"unit-5.json"`,
which does not change, so no rename of that entry was ever needed.

**One commit carries work that is not this run's.** `480617b` includes Shrey's
own uncommitted library work, which the rename could not be separated from:
`unit-5.json` and `unit-23.json` redrawn, and `unit-6.json`, `unit-7.json` and
`unit-29.json` added with their pictures and their manifest rows. Renaming a
file requires the file, and three of those were untracked, so leaving them out
would have committed a manifest pointing at files git did not have. The commit
message says so. Only the `name` field of those files was touched by this run.

**`docs/store.md`'s CORS line was corrected beyond the two new calls.** It said
the store allows `GET, PUT, OPTIONS`, which stopped being true when run 0031
added `POST` for messages. Leaving it would have shipped a document that was
wrong about two methods rather than one.

**`_cowork/CONTEXT.md` was updated although the repo's shape did not change.**
No new directory, entry point, dependency or run step. Task 9 asked for it by
name, so it was updated, and the paragraph says plainly that nothing structural
moved.

## Blocked / did not do

**A second dev server was started on port 8899 and is still running.** The
`netlify dev` on 8888 was not mine to restart, so the live checks ran against a
private instance on 8899 with Vite on 5199. It should be stopped by whoever
finishes with this working tree.

**Two groups were written into the local Blobs store by the live checks**:
`run-0035`, from the browser, holding "Unit 28" and "Unit 30" published by
"verify"; and a fresh `rt-…` group per round-trip run, of which there are three.
None of them is in the repository. The round trip has always left its own
sessions behind, and nothing removes them.

## Open questions for you

1. **Does leaving erase what a person said?** Right now it takes their profile
   and their flats and leaves the messages and the building run alone, on the
   reading that a conversation is not a profile. The other reading is defensible
   and the prompt's own words, that the index and `/export` "no longer mention
   them", support it. It matters for the thesis rather than for the code: if the
   record of a session is evidence of how a group decided something, then
   removing a person's words rewrites that evidence, and if it is personal data
   then leaving them is the thing that needs defending. The change is small
   either way.

2. **Should the store record that somebody left?** Nothing does. A group's
   export after a departure is indistinguishable from one where that person
   never joined, so a reader of the thesis record cannot tell "four people took
   part" from "five took part and one withdrew". A single line appended to
   `messages`, written by the store rather than by a person, would keep the
   record honest at the cost of putting the store's own voice into a list that
   is otherwise only human speech.

3. **What happens to the counts other residents cast for a flat that has just
   left?** A resident's `counts` maps flat ids to how many of each they want,
   and nothing clears an entry when its flat is withdrawn. After Ben leaves,
   Ana's ballot may still ask for two of `flat-3`. The store cannot decide this
   alone: whether a vanished flat means "want nothing" or "the vote is now
   incomplete and must be re-cast" is a question about how the group decides,
   and the building app is where the answer would show.

## Suggested next prompt

**The building app calls the two new doors.** The store now answers `DELETE
/api/session/{code}/residents/{name}` and `POST
/api/session/{code}/residents/{name}/rename`, both documented in
`docs/store.md`, both proven against a live store, and `OPTIONS` names DELETE so
a browser can reach them. The next prompt should be run in `bottom-up-design`
and should replace its run 0059 workaround: "leave" should call the DELETE and
show the resident what is about to go before it goes, naming their flat, since
the call is not reversible; and its rename path should call the rename rather
than writing a second row, and should show the `409` text when the name is
taken. It should report the two calls' responses raw, say what its own screen
shows between the click and the answer, and say what it does with a `counts`
entry pointing at a flat that has just left, which is open question 3 above and
which that app is the right place to settle.
