---
id: "0038"
title: A full group in one command, and the faults under the button
source: 0038-a-full-group-in-one-command.md
status: complete
branch: run/0037
commit: 378e9e9
completed: 2026-09-07
---

## Summary

One command now fills a group with twenty residents, each with a flat, a
picture, a square-metre figure, a ballot and their three wishes, so the whole
journey can be walked by joining that code as the twenty-first. And the layout
check's faults are now under step 02's button, one line each, where before the
button carried only their number and the lines were behind the check chip in
another corner of the screen. All five tasks landed.

This run was done inside run 0037, on the branch `run/0037`, because Shrey
asked for it mid-run. Its five commits are its own, `42e8ea5` to `378e9e9`, and
it has its own report and its own LOG row. The prompt's Constraints allow this
and ask that it be said.

## What I did

Five commits. The branch was already `run/0037`, which had branched from `main`
at `d015b9b` and stood at `a30b973`, run 0037's own bridge commit, when this
work began.

`42e8ea5` **scripts: a full group in one command**, two files, 234 insertions.
`scripts/fill-group.mjs` is 164 lines, `scripts/fillGroupTable.mjs` 70.

`eb4b0cd` **docs: how to fill a group**, one file, 14 insertions, in `README.md`
under "How to run it".

`d0f65f9` **ui: the things to look at, named**, five files, 136 insertions and
32 deletions. `src/core/flatState.ts:135` is `sendButton` with its new
signature and `src/core/flatState.ts:116` the `faults` field.
`src/main.ts:1040` holds the lines, `src/main.ts:1303` fills them and
`src/main.ts:1704` prints them. `index.html:298` is the list;
`src/style.css:601-627` styles it.

`8b1393d` **ui: tests for 0038**, one file, 161 insertions.
`scripts/fillGroupTable.test.ts` is new, 18 cases.

`378e9e9` **docs: PROJECT_STATE for run 0038**, one file, 62 insertions and 1
deletion.

## Findings

**The table had to be its own file.** `scripts/fill-group.mjs` fills a group
when it is imported, because its work is at the top level, so a test that
imported it to check the twenty would fill a group as a side effect. The table
moved to `scripts/fillGroupTable.mjs` and the runner imports it. That is the
same split `scripts/flatLayout.ts` has beside `scripts/gen-flat.mjs`, for the
same reason.

**The flat ids come from the library's own names, not from the file names.**
A resident sending "Flat 1" from the app slugs it to `flat-1`, so that is what
the script publishes it as, and it reads the name out of the library file
rather than assuming it. Run 0035 renamed the library from `Unit N` to `Flat N`
and the file names stayed `unit-8` to `unit-27`, so a script that used the file
name would have written ids no resident's own send would ever produce.

**Exiting hard aborts Node on Windows when a socket is still closing.** The
refusal's first run printed exactly the right words and then crashed over them
with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file
src\\win\\async.c, line 94`. That is `process.exit` while `fetch`'s keep-alive
pool has a socket in flight. The script now sets `process.exitCode` and returns
out of one `main()`, and the refusal exits 1 cleanly.

**A 409 on starting the group is not a failure.** `POST` to a code somebody has
already started answers 409, and for this script that means the group exists,
which is what it wanted. It counts only a status outside 2xx, and neither 201
nor 409, as a failure.

**The button's rule now takes the lines, not the count.** `sendButton` in
`src/core/flatState.ts:135` used to take a number and print it. It takes the
fault lines and derives the number from them, so the "2" on the button and the
two lines under it cannot disagree; there is no second place where a count
could be computed. Empty strings are filtered out rather than counted, so a
rule with no description cannot inflate the number.

**A flat already in the group gets no faults listed.** The button then reads
"Go to your group" and is not offering to send anything, so a list of things to
look at under it would be a warning about an action nobody is about to take.
The check chip still has them.

## Evidence

Everything below was executed. Nothing is estimated.

**The script's output on a throwaway group, raw.** Run against the local store
at `http://localhost:8888`, on the code `walkthrough-0038`, which nothing else
uses. 72 lines, exit 0, no `FAIL`. The head and the tail are below; the middle
is the same three lines per resident for the other seventeen.

```
filling "walkthrough-0038" at http://localhost:8888 with 20 residents
  before: 0 flat(s), 0 resident(s), exists false
  started  201  {"code":"walkthrough-0038","flats":[],"residents":[],"building":null,"exists":true,"messages
  ok    201 Ana     sent Flat 1   as flat-1    v1  24386 B
  ok    200         its picture                       52206 B
  ok    200         its answers                       7+4 m², hall first, wishes corner+quiet
  ok    201 Bruno   sent Flat 2   as flat-2    v1  28926 B
  ok    200         its picture                       53868 B
  ok    200         its answers                       4+0 m², terrace first, wishes terrace
  ok    201 Mina    sent Flat 3   as flat-3    v1  30199 B
  ok    200         its picture                       58896 B
  ok    200         its answers                       11+6 m², social first, wishes corner+terrace
  ok    201 Leo     sent Flat 4   as flat-4    v1  37499 B
  ok    200         its picture                       52523 B
```

```
  ok    201 Karim   said  "Happy either way. I care more about the laundry being on my floor."
  ok    201 Freya   said  "Same. Terrace south is good, and can we keep one quiet stair?"

walkthrough-0038: 20 residents, 20 flats, 3 messages, exists true
  every flat has a picture: true
  square metres asked for: 7, 4, 11, 6, 9, 3, 12, 5, 8, 10, 6, 4, 12, 7, 9, 3, 11, 5, 8, 10

filled. Join "walkthrough-0038" from the landing as the twenty-first.
```

The polled state at the end reads **20 residents and 20 flats**, with 3
messages, `exists` true, and every flat carrying a picture. Those figures come
from `GET /api/session/walkthrough-0038`, the same call the building app polls.

**The refusal, quoted whole.** The same command run a second time on a code
that now holds flats:

```
filling "fill-test-0038" at http://localhost:8888 with 20 residents
  before: 20 flat(s), 20 resident(s), exists true

refusing: "fill-test-0038" already holds 20 flat(s) and 20 resident(s).
Pass --replace to fill it anyway, or choose a code nobody is using.
```

Exit code 1. Nothing was written: the refusal happens before the `POST` that
starts a group and before any flat goes out.

**The button with its faults listed.** Measured live against `netlify dev` at
1440 by 900, on a flat built from `unit-6`'s own project with its kitchen and
both bathrooms removed, which leaves it buildable and breaks two hard rules.
Step 02 read, from the top of the send panel down:

- the headline "Send it to your group."
- the line "As Shrey, to hall-14." with "change" beside it
- the red button reading "Send anyway · 2 things to look at"
- under it, two lines in `rgb(107, 102, 92)`:
  - "A dwelling needs a bathroom."
  - "A dwelling needs a kitchen."
- then "It becomes Unit 33, the next free number in the library and in hall-14"
- then "Your neighbours see it within seconds."

The check chip beside the flat read "2 must fix" at the same moment, which is
the same two violations counted rather than named.
`rgb(107, 102, 92)` is `--text-dim`, `#6b665c`. The two sentences are
`RULES_BY_ID.P1.description` and `RULES_BY_ID.P2.description` in
`src/core/rules.ts:562` and `571`, printed as the rules write them.

**Test counts.**

| suite | before this work | after |
|---|---|---|
| fast | 390 in 22 files | 410 in 23 files |
| slow | 58 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

"Before" is the state at `a30b973`, the end of run 0037. The 20 new fast cases
are 18 in the new `scripts/fillGroupTable.test.ts` and a net 2 in
`src/core/flatState.test.ts`, where the button's cases were rewritten around
the new signature and four were added for the faults.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical and the store contract did not
change.** `git diff --stat main HEAD` over `src/core/saveFiles.ts`,
`src/core/projectIO.ts`, `src/core/unitExport.ts`, `docs/bridge-format.md`,
`testflats/`, `src/session/store.ts` and `docs/store.md` returns nothing at
all. The script only calls the store; it did not need it to change.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 8.01 s.**

## Artifacts produced

- `_cowork/outbox/0038-a-full-group-in-one-command.report.md` — this file.
- `scripts/fill-group.mjs` — new, 164 lines.
- `scripts/fillGroupTable.mjs` — new, 70 lines.
- `scripts/fillGroupTable.test.ts` — new, 161 lines, 18 cases.
- `README.md` — the command under "How to run it".
- `PROJECT_STATE.md` — new §19.
- `_cowork/CONTEXT.md` — one paragraph for run 0038.

Two groups were left in the local Blobs store by the evidence,
`walkthrough-0038` and `fill-test-0038`. Neither is in the repository and
neither is `review-0023`, which was not touched.

## Skills read from disk

One, from
`C:\\Users\\ADMIN\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\skills-plugin\\f1d881be-0a13-45d3-acab-472cf2886dae\\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\\skills\\`.

`interoperability/SKILL.md`, 53097 bytes. Its section 7.1, on REST verbs and
what a caller may assume from them, is the argument for the script writing only
through the store's public calls: a seeder that reached into the store's files
would produce a group no sequence of real requests could have produced, and
every later run would be testing against a state the app cannot reach. Its
section 3.5, database-mediated exchange, says the same thing from the other
side: the store is the single source of truth both apps read, so filling it
through anything but its own interface would make the fill a fourth writer with
its own rules. Its section 1.4, the data-loss taxonomy, is why the script sends
each flat's preview as well as its body: leaving the pictures out would be
appearance loss, and a group of twenty flats with no pictures is not the room
the building app will show.

Rejected from it: sections 2, 4, 5, 6 and 8 to 10, file formats, Rhino, Revit,
Speckle, schema mapping and coordinate systems. Its section 7.5 on rate
limiting was considered for the sixty-odd calls the script makes and rejected:
they go to a local store at human scale and the run takes seconds.

`design-automation` was not re-read for this work. It was read earlier in this
session for run 0037 and its section 2.1 is what the faults change rests on:
the count and the lines are one answer from one function rather than two
answers that could disagree.

## The Assumptions, checked

**Assumption 1 holds.** All five calls are in `docs/store.md` and
`scripts/store-roundtrip.mjs` drives every one of them. The script uses exactly
those.

**Assumption 2 holds.** The library holds thirty flats named Flat 1 to Flat 30,
`unit-8` to `unit-27` are the twenty designed ones, and each has a JPEG beside
it under `public/units/`. The script reads both files for each of the twenty
and every read succeeded.

**Assumption 3 holds, and the shape it describes has changed.** The button's
count did come from the same variable the check chip prints. That variable was
a number at `src/main.ts:1279`; it is now a list of the rules' own descriptions
at `src/main.ts:1040`, filled at `src/main.ts:1303` from the same violations
the chip counts and the report lists. The count on the button is derived from
that list.

**My own assumptions, and what each costs if it is wrong.**

*That a flat's id should be the slug of its library name.* `Flat 1` becomes
`flat-1`, which is what a resident's own send produces. If the group should
instead hold the library's file ids, `unit-8` and so on, that is one line in
`scripts/fillGroupTable.mjs`, and the two would then differ from what the app
writes.

*That `extraM2` belongs in the table.* The prompt names one square-metre figure
between 3 and 12, which is `shareM2`. The store also takes `extraM2`, the
amount a resident offers beyond their share, and the building app reads it, so
the table sets both. If a group where nobody has answered the second question
is wanted, that column comes out.

*That three messages is "two or three".* They are from three different people,
all of whom are in the group, and they are about the flats rather than filler.

*That the faults list shows only while the button offers to send anyway.* It is
empty at every other moment, including once the flat is in the group. If a
resident should see the faults on step 02 at all times, the rule is one
condition in `sendButton`.

*That the fault lines are the hard violations only.* They are the same ones the
chip counts. Soft violations, the "worth a look" tier, are not listed, so the
number under the button and the number on the chip agree. Listing them too
would mean the button's count and the chip's parting company.

## Decisions and rationale

**The table is fixed, not random.** The prompt asked for it and the reason is
worth writing down: a screenshot taken today and one taken next week show the
same room, and a figure that looks odd can be traced to a line in the table
rather than to a seed.

**The script reads the flat's name from the library file.** It could have
carried the twenty names in the table. Reading them means a rename in the
library moves the script with it, which run 0035 showed is a thing that
happens.

**The refusal counts flats, not residents.** A group with residents and no
flats is one somebody has joined and not yet sent to, and filling it is
harmless. A group with flats is a room with work in it.

**The faults take the muted ink, not the accent.** The stale sentence above
them is accent red because it is something a resident may be wrong about. The
faults do not stop a send and are not a warning; they are what a resident would
read in the report if they opened it.

## Deviations from the prompt

**This work was done on `run/0037` rather than a new `run/0038` branch.** The
prompt's Constraints allow it and ask that it be said: Shrey asked for 0038
mid-run, so it has its own commits, its own report and its own LOG row on run
0037's branch.

**`_cowork/CONTEXT.md` was updated.** This run added a script and a run step,
which is one of the cases the bridge protocol names.

## Blocked / did not do

**No picture of the button with its faults was written to a file.** The prompt
allows a capture or a description with every line quoted, and the description
above quotes both lines and their colour. A headless capture was attempted and
abandoned: the app has no URL parameter that opens step 02, so a headless
browser cannot reach that screen without scripting it, and the run was already
long.

**A second dev server is still running on port 8899**, with Vite on 5199,
started in run 0035.

## Open questions for you

1. **Should the twenty-first resident be part of the table?** Right now the
   script fills twenty and Shrey joins as the twenty-first by hand, which is
   the point. But nothing stops two people running the script against the same
   code with different intentions, and nothing marks which of the twenty-one is
   the real person. If the walkthrough is going to be recorded or shown, it may
   be worth the script naming the group's twenty as clearly not-Shrey, or
   writing one message that says the room was filled for a test.

2. **What should the twenty want that they do not want yet?** They have a
   square-metre figure, a ballot and three wishes, which is everything the
   store holds. The building app may soon ask something the store does not yet
   carry, and when it does the table is where twenty plausible answers have to
   come from. It is worth knowing whether the answers should stay hand-written
   or start being derived from the flats themselves, so that a person in a
   small flat asks for less shared space than one in a large one.

3. **Do the faults under the button change what a resident does?** The point of
   the change is that they can no longer send blind. Whether seeing "A dwelling
   needs a bathroom." makes somebody go back and add one, or makes them press
   the button anyway with a clearer conscience, is a question the walkthrough
   this run enables is the right way to answer. It is worth watching for
   specifically when the group is run.

## Suggested next prompt

**Walk the journey and write down what happens.** Everything is now in place:
`node scripts/fill-group.mjs http://localhost:8888 <code>` fills a room, the
landing joins it, the flat app sends in one press with the faults named, and
the store carries wishes, ballots, square metres, messages and departures. The
next prompt should be a run that walks it end to end as a resident would, with
no shortcuts through the console, and records each screen as it is met: what
the landing says, what the editor asks for, what step 02 shows before and after
a send, what the building app then shows for the same group, and where a person
would hesitate. It should come back with the sequence of screens as pictures at
1440 by 900 and a list of every moment where the app asked something it already
knew or said something a resident would not understand. That list is the next
several runs' work, and it cannot be written from inside either repository
without doing the walk.
