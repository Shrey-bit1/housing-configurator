---
id: "0030"
title: The two fields travel
created: 2026-09-04
---

## Context

The building app now asks each resident how many square metres of shared
space every person should pay for, and lets a resident offer to pay for
more after the vote has settled. Those two answers are called `shareM2`
and `extraM2`. They belong to a resident, so they belong in this app's
store, and the building app reads every resident's answer back out of it
to take the middle one.

The store does not carry them. Run 0056 of the building app measured this
against the live store on 4 September 2026: a
`PUT /api/session/{code}/residents/{name}` whose body was
`{"shareM2":7,"extraM2":5,"ballot":["hall","terrace"]}` answered `200`
and echoed back `{"name":"Probe","counts":{},"share":null,"ballot":["hall","terrace"]}`.
The two keys were dropped without a word. The reason is in
`src/session/store.ts`: `parseResidentPatch` (line 416) copies out three
named keys and nothing else, and the merge at line 238 starts from a
default record of the same three.

The effect on the other app is that the median is taken over one answer,
the resident's own, because nobody else's ever arrives. This run makes the
two fields travel. It is small on purpose.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability`, because this is the seam between the two apps and the
question is what one side may assume about the other.
`design-automation`, because one field is described in four places here
(the type, the default, the check, the document) and they have to agree.
Report which you read, what each contributed, and anything rejected with
the reason. Reference, not instruction.

## Assumptions

Check rather than trust, contradict rather than work around. Where the
prompt is silent, choose sensibly, keep going, and record the choice.

1. `interface Resident` is at `src/session/store.ts` line 64 and holds
   `counts`, `share` and `ballot`.
2. The residents route is at `src/session/store.ts` lines 232 to 241. The
   merge is `record = { ...(index.residents[who] ?? { counts: {}, share: null, ballot: [] }), ...patch }`.
3. `parseResidentPatch` is at `src/session/store.ts` line 416 and reads
   exactly the three keys.
4. `sessionView` puts each resident into the polled state whole, so a
   field added to the record appears in `GET /api/session/{code}` and in
   `/export` without any further change. Verify this; if it names its keys
   one by one, that is a fourth place to change and it is part of task 1.
5. The contract is documented in `docs/store.md`: the table row at line 61
   and the section "a resident's wishes" at lines 203 to 231.
6. `store.test.ts` pins the record shape at lines 200 to 222 and again at
   360 to 368, with `toEqual`, so both break the moment a key is added.
   Updating them is part of this run, not a surprise.

## Tasks

1. The two fields, commit `store: the resident carries square metres`.
   `Resident` gains `shareM2: number | null` and `extraM2: number | null`.
   `shareM2` is how many square metres of shared space this resident thinks
   each person should pay for. `extraM2` is how many square metres they
   offered to pay for beyond that share, after the vote settled. Both are
   whole numbers of square metres, zero or more, or `null` when never
   answered. The default record for a resident who has never been written
   becomes `{ counts: {}, share: null, ballot: [], shareM2: null, extraM2: null }`.
   `parseResidentPatch` accepts each key when it is present and checks it
   whole: `null` passes, an integer `>= 0` passes, everything else is a
   `400` whose message reads like the ones beside it. There is no upper
   bound in the store. How high the slider goes is the building app's
   business, and a bound written here would have to be changed in two
   repositories at once.

2. `share` stays, commit `store: share stays where it is`. The old
   `share`, a fraction of floor area between 0 and 1, is no longer what
   the question means, and nothing should read it again. It stays in the
   record and stays accepted, because records already written into a live
   store carry it and dropping a key is a change other people's data has
   to survive. Mark it in the type comment as the pre-0056 reading of the
   question, kept for what is already stored.

3. The document, commit `docs: two more keys on a resident`. In
   `docs/store.md`: the table row at line 61 lists all five keys; the
   residents section gains a bullet for each new one, in the same voice as
   the three above them, saying what the number means in square metres and
   that the store checks only that it is a whole number, zero or more; the
   sentence naming the never-written default is updated; the worked example
   request and response carry the two fields so a reader sees their shape.

4. The round trip, commit `store: the round trip proves it`. In
   `scripts/store-roundtrip.mjs`, Ana's `PUT` carries `shareM2` and
   `extraM2` alongside what she already sends, Ben's second `PUT` carries
   only `shareM2` so the merge is exercised, and the script then checks the
   two fields in three places: the echo from the `PUT`, the resident inside
   `GET /api/session/{code}`, and the resident inside `GET …/export`. Print
   each of the three as raw JSON so the report can paste them.

5. Tests, commit `store: tests for the two fields`. In `store.test.ts`:
   the never-written default reads back with both keys `null`; a body
   carrying only `shareM2` leaves `counts` and `ballot` untouched; `0` is
   accepted; `null` is accepted; `-1`, `7.5` and `"7"` are each refused
   with `400`; both fields come back through `/export`. The existing
   `toEqual` assertions are updated to the five-key record. Every other
   suite stays green, both fixture baselines stay 12 and 7, and the three
   downloads stay byte-identical.

6. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0030-the-two-fields-travel.report.md`, prompt moved to
   done/, one LOG row.

All six tasks land. There is no short version of this run. If it is long,
it is long; keep going until every task is done and the report answers
every point.

## Constraints

- A new branch `run/0030` from `main`, and never a commit on main. If this
  prompt is being done inside a run that is already in progress, stay on
  that run's branch and give this work its own commits, its own report and
  its own LOG row, and say in the report which branch it landed on.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and both
  fixtures stay untouched.
- The store contract changes only by these two keys. No route, no status
  code and no other field moves.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch this landed on, and
   the branch state found before you started.
2. The `PUT` that failed before this run, if you can still reproduce it,
   and the same `PUT` after, pasted whole in both directions.
3. A resident read back three ways after a write: the `PUT` echo,
   `GET /api/session/{code}`, and `GET …/export`, each pasted whole.
4. The round-trip script's output, raw.
5. The refusals: `-1`, `7.5` and `"7"`, each with the status and the
   message the store returned.
6. Test counts before and after, both fixture baselines, the three
   download checks, and `tsc` clean.
7. Whether `sessionView` needed changing, and what you found when you
   checked assumption 4.
8. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
9. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
