---
id: "0039"
title: The store holds a vote
source: 0039-the-store-holds-a-vote.md
status: complete
branch: run/0039
commit: 7a9217c
completed: 2026-09-08
---

## Summary

The store now holds rounds of pairs and one vote per person per pair. A round
is opened whole, votes are cast against it, and the store closes it itself in
the same write that records its last expected vote. Who may vote and how many
votes a round is waiting for are both answered from the store's own index
rather than from anything a caller sends. All nine tasks landed on `run/0039`,
which branched from `main` at `cd08e7e` and ends at `7a9217c`.

One thing outside the tasks: the run's first command failed the landing
fingerprint, which is what it exists for. The building app had changed the
shared landing at its source. That is described under **Deviations**.

## What I did

Nine commits. The branch state found on `main` was `cd08e7e`, "Merge run/0037:
one landing for both apps, and a full group in one command", which carries both
run 0037 and run 0038: their bridge commits are `a30b973` and `d475ff4` and
both prompts are in `_cowork/done/`.

`0645952` **design: the brief as of 7 September**, one file, 64 insertions and
3 deletions. `_cowork/design/DESIGN-BRIEF-3sep.md` went from 15716 bytes to
18750, `cmp`-identical to the Context copy.

`d81a13a` **landing: copy in the shared file the building app moved**, one
file, 1 insertion and 1 deletion.

`e36f193` **store: a round of pairs**, two files, 249 insertions and 5
deletions. `src/session/store.ts:188` is `REASONS`, `273` and `278` the two
views of the round list, `296` `roomMembers`, `690` the `PUT /round` route,
`938` the polled state's two fields, `806` the export's history, and `1074`
`parseRound`.

`d90355c` **store: one vote per person per pair**, one file, 63 insertions.
`src/session/store.ts:719` is the votes route and `1045` `parseReasons`.

`c2bccd9` **store: the round closes when everyone has voted**, one file, 43
insertions and 1 deletion. `src/session/store.ts:315` is `everyoneHasVoted` and
`768` the by-hand close.

`0ad8dd5` **docs: rounds and votes**, one file, 148 insertions.

`931806e` **store: the round trip votes**, one file, 93 insertions and 2
deletions. `scripts/store-roundtrip.mjs:201-303` is section 9.

`bb1c508` **store: tests for 0039**, two files, 273 insertions and 1 deletion.
`src/session/store.test.ts:838-1075` is the vote, 22 cases.

`7a9217c` **docs: PROJECT_STATE for run 0039**, one file, 79 insertions and 1
deletion.

## Findings

**One list, not two fields.** The index holds `rounds`, every round oldest
first. At most one is ever open, so the open round and the last closed one are
two views of that list rather than two stored fields that could disagree. The
alternative, an `openRound` beside a `closedRounds`, has two places to write on
every close and therefore one place to forget.

**Both guards sit inside the mutate.** `updateIndex` re-runs its callback when
it loses an ETag race, so a check written inside it is a check the loser of a
race also runs, against the winner's state. Both of `PUT /round`'s refusals are
in there: the `n` check at `src/session/store.ts:705-708` and the open-round check
at `src/session/store.ts:697-700`. Two clients racing to open the same round
therefore cannot both win.

**A round while another is open had to be refused, and the prompt does not say
so.** The prompt names only the `n` rule. But `n` alone permits opening round 2
while round 1 is open, and the polled state's `round` can then only mean one of
them. The refusal is a 409 naming the open round, and it is written up in
`docs/store.md` beside the `n` one.

**The room is read live, not frozen when a round opens.** `roomMembers` runs on
every vote, so somebody who joins mid-round is waited for and somebody who
leaves stops being waited for. That falls out of reading the index rather than
storing an expected list, and it is the behaviour that matches the brief, where
a round is a wait for "everyone at the table" and the table is a live thing.
`src/session/store.test.ts:1030-1039` pins it.

**The close belongs in the vote's own write.** Closing in a second write would
leave a moment where every vote is in and the round still reads open. A client
polling in that moment would show a room waiting for nobody. The vote's answer
carries `closedTheRound`, so the client that cast the last one does not have to
poll to find out.

**`netlify dev` masks a 403 the way run 0035 found it masking a 404.** The
store answers 403 to a stranger's vote. The dev server then retries the same
path four more ways and the client sees the last of them. From its own log
during this run:

```
Request from ::1: POST /api/session/rt-mtshcvxd/rounds/1/votes
Response with status 403 in 392 ms.
Request from ::1: POST /api/session/rt-mtshcvxd/rounds/1/votes.html
Response with status 404 in 445 ms.
Request from ::1: POST /api/session/rt-mtshcvxd/rounds/1/votes.htm
Response with status 404 in 414 ms.
Request from ::1: POST /api/session/rt-mtshcvxd/rounds/1/votes/index.html
Response with status 404 in 316 ms.
Request from ::1: POST /api/session/rt-mtshcvxd/rounds/1/votes/index.htm
Response with status 404 in 324 ms.
```

A 400 is not retried and arrives as itself, which is why the reason refusal in
the same script reads 400. The round trip now checks that the stranger's vote
did not land rather than checking for a bare 403; `src/session/store.test.ts`
pins the 403 where no dev server is in the way. This matters to the building
app, which is the only caller and will meet the same thing.

**The polled state grew two keys, and three tests said so.** Three assertions
in `src/session/store.test.ts` name every key the poll returns, which is what
made the contract change visible rather than silent. They now name `round` and
`lastRound` too.

## Evidence

Everything below was executed. Nothing is estimated.

**A round opened, voted to a close, and the state after.** From
`scripts/store-roundtrip.mjs` against `netlify dev` on port 8888, session
`rt-mtshe2u7`. The group at that point is Ana, who owns a flat, and Ben, who
joined.

Opening round 4 first:

```
PUT http://localhost:8888/api/session/rt-mtshe2u7/round
409 Conflict  61 bytes  cors=*
{"error":"next round in session \"rt-mtshe2u7\" is 1, not 4"}
```

Opening round 1, which answers `201` with the round as stored, 755 bytes,
reading `expected: 2`, two pairs and no votes. Then a second round while it is
open:

```
PUT http://localhost:8888/api/session/rt-mtshe2u7/round
409 Conflict  60 bytes  cors=*
{"error":"round 1 in session \"rt-mtshe2u7\" is still open"}
```

The five votes, each answered `201`. Ana votes `a` on `p1` and then `b`, which
replaces it. Ben votes on `p1`. Ana votes on `p2`. The last, with the name
spelled in the wrong case:

```
POST http://localhost:8888/api/session/rt-mtshe2u7/rounds/1/votes
201 Created  131 bytes  cors=*
{"who":"ben","pair":"p2","pick":"b","reasons":["shared space","short walks"],"at":"2026-09-08T09:42:55.435Z","closedTheRound":true}
```

The round as the state carries it afterwards, whole:

```json
{"n":1,"pairs":[{"id":"p1","a":{"genome":[1,2],"summary":{"flats":2,"fitness":0.6},"plot":{"modulesX":11,"modulesY":11,"floors":7}},"b":{"genome":[2,3],"summary":{"flats":2,"fitness":0.7},"plot":{"modulesX":11,"modulesY":11,"floors":7}},"dial":"light","sentence":"This one has more light and longer walks to the stair.","voted":2,"expected":2},{"id":"p2","a":{"genome":[3,4],"summary":{"flats":2,"fitness":0.8},"plot":{"modulesX":11,"modulesY":11,"floors":7}},"b":{"genome":[4,5],"summary":{"flats":2,"fitness":0.9},"plot":{"modulesX":11,"modulesY":11,"floors":7}},"dial":"cost","sentence":"This one has a tighter facade and is cheaper to heat.","voted":2,"expected":2}],"weights":[1,1,1,1,1],"openedAt":"2026-09-08T09:42:50.475Z","votes":[{"who":"Ana","pair":"p1","pick":"b","reasons":["light","privacy"],"at":"2026-09-08T09:42:54.281Z"},{"who":"Ben","pair":"p1","pick":"a","reasons":["cost"],"at":"2026-09-08T09:42:54.646Z"},{"who":"Ana","pair":"p2","pick":"b","reasons":[],"at":"2026-09-08T09:42:55.017Z"},{"who":"ben","pair":"p2","pick":"b","reasons":["shared space","short walks"],"at":"2026-09-08T09:42:55.435Z"}],"closedAt":"2026-09-08T09:42:55.435Z","expected":2}
```

Four votes, not five: Ana's second vote on `p1` replaced her first rather than
joining it. Both pairs read `voted: 2, expected: 2`. `closedAt` carries the
same timestamp as the last vote, because they were written together. `round` in
the same state is `null`.

**Every refusal, with its status and message.**

| what | status | message |
|---|---|---|
| opening round 4 before any round | 409 | `next round in session "…" is 1, not 4` |
| opening round 4 after round 1 closed | 409 | `next round in session "…" is 2, not 4` |
| a round while another is open | 409 | `round 1 in session "…" is still open` |
| a vote after the round closed | 409 | `round 1 in session "…" is closed` |
| a vote on a round that never existed | 409 | `no open round 7 in session "…"` |
| a stranger's vote | 403 | `"Zoe" is not in session "…"` |
| a reason outside the five | 400 | `"a nice view" is not one of privacy, shared space, cost, light, short walks` |
| a dial outside the five | 400 | `pairs[0].dial must be one of privacy, shared space, cost, light, short walks` |
| a weight list that is not five numbers | 400 | `weights must be 5 numbers, one per reason, in the order …` |
| two pairs sharing an id | 400 | `two pairs share the id "p1"` |
| a pick that is not a or b | 400 | `pick must be "a" or "b"` |
| a pair the round does not have | 400 | `no pair "p9" in round 1` |
| closing a round already closed | 409 | `round 1 in session "…" is already closed` |
| closing a round that never existed | 409 | `no open round 9 in session "…"` |

The 403 and the 409s above are as the store answers them, which is what
`src/session/store.test.ts` reads. Through `netlify dev` the 403 arrives as a
404, for the reason under **Findings**.

**The round-trip script's output.** `node scripts/store-roundtrip.mjs
http://localhost:8888` exits 0 with `all checks passed for session
"rt-mtshe2u7"`, at 94 checks, up from 70 before this run. The full output is
319 lines and is not pasted whole; the section that matters is quoted above and
the script prints every response raw when run. The other checks in section 9,
all passing: round 2 opening once round 1 has closed, closing it by hand and
getting a `closedAt` back, `/export` carrying `1,2`, and the polling call
carrying no `rounds` key at all.

**Test counts.**

| suite | on `main` (`cd08e7e`) | on `run/0039` |
|---|---|---|
| fast | 410 in 23 files | 432 in 23 files |
| slow | 58 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

The 22 new cases are all in `src/session/store.test.ts`, which goes from 67 to
89.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical and nothing outside the store moved.**
`git diff --stat main HEAD` over `src/core/saveFiles.ts`,
`src/core/projectIO.ts`, `src/core/unitExport.ts`, `docs/bridge-format.md`,
`testflats/`, `src/main.ts` and `index.html` returns nothing at all. The editor
was not touched. `building` keeps its shape: nothing in `BuildingRun` changed
and the building app still reads it as the current building.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 12.22 s.**

## Artifacts produced

- `_cowork/outbox/0039-the-store-holds-a-vote.report.md` — this file.
- `src/session/store.ts` — the round, the vote, the close, the five reasons.
- `docs/store.md` — three call-table rows and four new sections.
- `scripts/store-roundtrip.mjs` — section 9, 94 checks in total.
- `src/session/store.test.ts` — 22 new cases, 89 in total.
- `_cowork/design/DESIGN-BRIEF-3sep.md` — the 7 September brief.
- `_cowork/design/landing/landing.css` — the building app's one-line change,
  copied in.
- `PROJECT_STATE.md` — new §20.
- `_cowork/CONTEXT.md` — one paragraph for run 0039, **Last updated**
  2026-09-08.

The round trip left its own `rt-…` session in the local Blobs store, as it
always does. `review-0023` was not touched.

## Skills read from disk

One, from
`C:\\Users\\ADMIN\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\skills-plugin\\f1d881be-0a13-45d3-acab-472cf2886dae\\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\\skills\\`.

`interoperability/SKILL.md`, 53097 bytes. Its section 7.1, on REST verbs and
what a caller may assume, decided the shapes: a round is `PUT` because opening
round `n` twice must mean the same thing as opening it once, and a vote is
`POST` because casting one is not idempotent even though a second vote on the
same pair replaces the first. Its section 3.5, database-mediated exchange,
argued for the store answering the room rule itself. A membership list passed
in with each vote would be a second copy of something the store already knows,
and its own text says the shared store is the single source of truth both tools
read. Its section 7.5 on error handling is what the two 409s are shaped by: a
refusal should say what the caller must do differently, which is why the `n`
refusal names the number expected and the open-round refusal names the round
that is open, rather than both saying "conflict".

Its section 1.4, the data-loss taxonomy, named the loss the round's shape
avoids. A round that stored only the ids of two buildings and left the buildings
in a table somewhere would be relationship loss the first time that table was
tidied; a round read back next year would name two things nobody can produce.
So a round holds its buildings inside it, which is also why the history is in
`/export` alone.

Rejected from it: sections 2, 4, 5, 6 and 8 to 10, file formats, Rhino, Revit,
Speckle, schema mapping and coordinate systems. Nothing here converts geometry;
the store reads inside neither building.

`design-automation` was not read for this run. It was read earlier in this
session and its section 2.1, one rule stated once, is what `roomMembers` and
`everyoneHasVoted` are: one function each, read from one place.

## The Assumptions, checked

**Assumption 1 holds.** The index held `flats`, `residents`, `building`,
`messages` and `startedAt`, and `building` is one run with `genome`, `summary`,
`by`, `at` and an optional `plot`. It gains `rounds` and nothing else, and
`building` is untouched.

**Assumption 2 holds.** The store can compute the room from its own index, and
now does, at `src/session/store.ts:296`. A person who joined is a resident row;
a person who owns a flat is a flat whose `resident` matches. Both halves are
tested at `src/session/store.test.ts:931-936`.

**Assumption 3 holds and is what both guards rest on.** `updateIndex` retries
under an ETag, re-running its callback, so a check inside the mutate is safe
against two writers. The `n` check and the open-round check are both in there.

**My own assumptions, and what each costs if it is wrong.**

*That a round may not be opened while another is open.* The prompt names only
the `n` rule. If a group should be able to run two rounds at once, `round` in
the polled state has to become a list and the building app's screens have to
choose between them; the refusal is one condition at
`src/session/store.ts:697-700`.

*That the room is read live rather than frozen at the open.* Somebody who joins
mid-round is waited for. The other reading, freezing the expected list when the
round opens, would mean a round can close while somebody at the table has not
voted, which reads worse. If the building app wants the frozen reading, the
expected list would be stored on the round and `everyoneHasVoted` would read
that instead.

*That a vote replaces rather than being refused.* The prompt says a second vote
replaces the first while the round is open, and it is implemented that way. The
replaced vote is not kept; if the record should show that somebody changed
their mind, the round would have to hold a list of every vote ever cast and mark
which are current.

*That `openedAt` and `votes` in a request body are ignored rather than
refused.* They are the store's to set. A 400 would be pedantry against a client
that echoed back a round it had just read.

*That the store counts nothing beyond "has everybody voted".* Which building
won, whether three quarters agree, and what the reasons do to the weights are
all the building app's, per the prompt. The store carries every vote whole so
that app can count them any way it likes.

*That `weights` is five numbers in `REASONS`' order.* The prompt says "the five
numbers the round was built with" without naming an order. `REASONS`' order is
the only one both apps can agree on without a second convention, and the 400
message names it.

## Decisions and rationale

**`round` and `lastRound` are `null` rather than absent.** A client can then
tell "no round yet" from "a store too old to have this", which matters while
the two apps ship separately.

**The history is in `/export` only.** A poll runs every few seconds and every
round carries two whole buildings per pair. The same argument the flat bodies
were kept out of the poll on.

**`closedTheRound` rides on the vote's answer.** The client that cast the last
vote is the one that most wants to know, and it already has an answer in hand.

**The by-hand close is documented as being for something that does not exist
yet.** The brief says a rule for an absent person is coming. Writing that down
in `docs/store.md` is what stops it being read as the normal way to close a
round.

**A pair's two buildings are stored inside the round.** A round read back next
year is the round that ran, without depending on anything else still existing.

## Deviations from the prompt

**One commit outside the nine tasks, `d81a13a`.** The run's first command,
`vitest` after task 0, failed the landing fingerprint from run 0037. The brief
that came across records
`3b6260a290174bf267a9cebef3d7862d37a9fd2f4cbc0430266d42e6fadf7818` where this
app's copy of the shared landing hashed to
`908c7f9e20e8e89f3a36a766056c2659803e38dd266207dd9377ef19553ba419`. One line
had changed at the source: in `landing.css`, the blue disc's `bottom` from
`-120px` to `150px`, with the reason written beside it, that the building app's
run 0062 found it covering the last dot of the journey strip at 1440 by 900.
The building app changed the shared file rather than its own copy and updated
the brief's line; this app copies it in. That is exactly the three steps the
shared landing's README describes, and the fingerprint did on its second day
what it was built for. All three files are `cmp`-identical to the Context
folder again.

**Tasks 1 and 4 share one commit, `e36f193`.** The five reasons are a constant
that nothing uses until a round's `dial` is checked against them, so under this
project's `noUnusedLocals` a commit holding only the constant does not compile.
The three store commits are otherwise split as the prompt asks, each compiling
and each with the fast suite green: the round, then the vote, then the close.

**The round trip's stranger check does not assert 403.** For the dev-server
reason under **Findings**. The status the store answers is pinned in
`src/session/store.test.ts` instead.

## Blocked / did not do

**Nothing in the tasks.** The building app's screens and the counting are its
own run 0063, as the prompt says.

**A `netlify dev` is running on port 8888**, started by this run because none
was up. It should be stopped by whoever finishes with this working tree.

## Open questions for you

1. **What closes a round nobody will finish?** The by-hand close exists and is
   documented as a placeholder, but the rule it is a placeholder for is not
   written. The brief says "for now an absent person can hold a round open".
   The question is not really technical: a round that closes on a timer says
   the group decides without you if you are slow, and a round that closes on a
   quorum says the group decides without you if you are outvoted. Both are
   claims about how this group is meant to work, and the store will carry
   whichever is chosen in one function, `everyoneHasVoted`.

2. **Should a replaced vote leave a trace?** A resident who changes their mind
   overwrites their first vote and the first is gone. For the running of the
   vote that is right. For the thesis record it may not be: "eight people
   changed their mind after seeing the count" is a finding, and the store
   currently makes it unrecoverable. Keeping every vote and marking which are
   current is a small change now and an impossible one after the test.

3. **Who may open a round?** Anybody who can reach the store can, the same as
   everything else in it. That is the store's one recorded limit and it has been
   acceptable so far because the worst a stranger could do was publish a flat.
   A round is different: opening one with the wrong `n` is refused, but opening
   the RIGHT one with rubbish in it puts two buildings nobody built in front of
   twenty people. It may be worth deciding whether the vote is where the
   no-login limit stops being acceptable.

## Suggested next prompt

**The building app runs the vote.** The store now holds it:
`PUT /api/session/{code}/round` opens a round of pairs,
`POST .../rounds/{n}/votes` casts one vote per person per pair,
`POST .../rounds/{n}/close` closes one by hand, the polled state carries
`round` and `lastRound` with per-pair counts, and `/export` carries every
round. All of it is in `docs/store.md` with examples, and the five reasons are
`privacy, shared space, cost, light, short walks`.

Run 0063 in `bottom-up-design` should build the screen the brief describes: two
buildings side by side with the six numbers under each, the sentence naming the
difference, one press per pair, the five reasons to tick, and the line saying
how many have voted. It should build the challengers by pushing one dial each,
open the round through the store, and do the counting the store deliberately
does not: which building won, whether three quarters of those who voted agreed,
and what the ticked reasons do to the five weights the next round is built with.
It should report what it does when a resident opens the screen with no round
open, what it shows between the last vote and the next round, and whether it
met the 403-becomes-404 behaviour this report describes, since it is the only
caller and will meet it.
