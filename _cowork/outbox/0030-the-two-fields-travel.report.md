---
id: "0030"
title: The two fields travel
source: 0030-the-two-fields-travel.md
status: complete
branch: run/0029
commit: dfb3247
completed: 2026-09-04
---

## Summary

The store now carries `shareM2` and `extraM2` on a resident, so the building
app's two square-metre answers survive the round trip instead of being dropped
without a word. The same `PUT` that run 0056 measured against the live store now
echoes both keys back, and they appear in `GET /api/session/{code}` and in
`/export` unchanged. The old `share` stays accepted and is marked in the type as
the pre-0056 reading of the same question, because records already written carry
it. The change is exactly the two keys: no route, no status code and no other
field moves.

This landed on `run/0029` rather than a branch of its own, which the prompt's
constraint allows when the work is done inside a run already in progress.

## What I did

- `src/session/store.ts:64-99` — `Resident` gains `shareM2` and `extraM2`, both
  `number | null`, and `share` gains the comment marking it as the old reading.
- `src/session/store.ts:238` — the default record for a resident who has never
  been written becomes the five-key one.
- `src/session/store.ts:416` — `parseResidentPatch` accepts each new key when
  present and checks it whole.
- `docs/store.md:61` and the residents section — the table row, a bullet for
  each new key, the never-written default, and the worked example.
- `scripts/store-roundtrip.mjs` — Ana's `PUT` carries both, Ben gains a third
  `PUT` carrying only `shareM2`, and the fields are read back and printed in
  three places.
- `src/session/store.test.ts` — five new cases and the two `toEqual` records
  updated.
- `PROJECT_STATE.md:3891` and `:3955`, `_cowork/CONTEXT.md:286`.

## Findings

**Assumption 4 holds and needed no work.** `sessionView`
(`src/session/store.ts:365`) is
`residents: Object.entries(index.residents).map(([name, r]) => ({ name, ...r }))`.
It spreads each record whole rather than naming keys, so both new fields reach
the poll and `/export` with no further change. There was no fourth place.

**A pre-0030 record reads back unchanged, and a test now proves it.** The
ETag-race case in `store.test.ts` injects another writer's resident straight
into the index rather than through the merge, so that record is written with the
three keys a record had before this run. That is exactly what a record already
sitting in a live store looks like. The assertion now expects it back with three
keys rather than five, which turns a test that merely needed updating into the
one that proves the compatibility claim task 2 rests on: the store reads a record
back as it found it and does not backfill, so the two missing keys read as absent
rather than as zero.

**Zero and null are different answers and the store keeps them apart.** Zero is
"I answered, and my answer is none of it". Null is "I never answered". A median
taken over answers has to tell them apart, so both are accepted and neither is
normalised into the other.

## Evidence

**1. Commits, the branch, and the state found before starting.**

This work is on `run/0029`, which is where the session already was. `main` is at
`6e081d8`. The branch carried run 0029's nine commits, ending at `6312b25`, when
this started. Five commits:

| hash | message | stats |
|---|---|---|
| `f5d36a4` | store: the resident carries square metres | 1 file, +34 -1 |
| `d7b48ec` | store: share stays where it is | 1 file, +11 -1 |
| `781557a` | docs: two more keys on a resident | 1 file, +27 -9 |
| `368a71f` | store: the round trip proves it | 1 file, +18 -2 |
| `dfb3247` | store: tests for the two fields | 1 file, +64 -6 |

**2. The `PUT` before and after, both reproduced.** Run against `netlify dev` on
`http://localhost:8888`, with the pre-change `src/session/store.ts` checked out
for the first and restored for the second. The body is the one run 0056 sent.

Request, both times:

```
PUT /api/session/{code}/residents/Probe
content-type: application/json

{"shareM2":7,"extraM2":5,"ballot":["hall","terrace"]}
```

Before, on `main`'s code:

```json
{"name":"Probe","counts":{},"share":null,"ballot":["hall","terrace"]}
```

After, on this run's code:

```json
{"name":"Probe","counts":{},"share":null,"ballot":["hall","terrace"],"shareM2":7,"extraM2":5}
```

Both answered `200`. The before reproduces run 0056's measurement exactly: the
two keys dropped without a word.

**3. A resident read back three ways after a write.** From the round-trip script
against the live store, session `rt-mtn9fbo1`.

The `PUT` echo:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5}
```

Inside `GET /api/session/rt-mtn9fbo1`:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5}
```

Inside `GET /api/session/rt-mtn9fbo1/export`:

```json
{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5}
```

And Ben, whose third body carried only `shareM2`, echoed by that `PUT`:

```json
{"name":"Ben","counts":{"flat-3":2},"share":0.5,"ballot":["garden"],"shareM2":9,"extraM2":null}
```

That is the merge doing what it should: one key changed, four untouched, and
`extraM2` still null because he has never answered it.

**4. The round-trip script.** `node scripts/store-roundtrip.mjs
http://localhost:8888` ends with `all checks passed for session
"rt-mtn9fbo1"`. The new checks in it are "Ana's square metres came back from the
PUT", "Ben's third body sent only shareM2 and left counts, ballot and extraM2
alone", "Ana's square metres survive into the polled state" and "Ana's square
metres survive into the export". The polled state it printed, whole:

```json
{"code":"rt-mtn9eplq","flats":[{"id":"flat-2","resident":"Ana","label":"Flat 2 again","version":2,"changed":false,"preview":false,"bbox":[0,0,15,14],"floors":1,"areaCells":194,"publishedAt":"2026-09-04T18:00:25.208Z"},{"id":"flat-3","resident":"Ben","label":"Flat 3","version":1,"changed":false,"preview":false,"bbox":[0,0,14,12],"floors":1,"areaCells":168,"publishedAt":"2026-09-04T18:00:24.634Z"}],"residents":[{"name":"Ana","counts":{"flat-2":1},"share":0.3,"ballot":["laundry","workshop","garden"],"shareM2":7,"extraM2":5},{"name":"Ben","counts":{"flat-3":2},"share":0.5,"ballot":["garden"],"shareM2":9,"extraM2":null}],"building":{"genome":[3,1,4,1,5],"summary":{"flats":2,"fitness":0.71},"by":"Ben","at":"2026-09-04T18:00:29.339Z","plot":{"modulesX":11,"modulesY":11,"floors":7}}}
```

Both flat bodies still came back byte-identical, at 37484 and 33388 bytes, and
the preflight still answers `204`.

**5. The refusals, live.** Each a `PUT` to
`/api/session/probe-0030/residents/Probe`:

```
{"shareM2":-1}       400  {"error":"shareM2 must be a whole number of square metres ≥ 0, or null"}
{"shareM2":7.5}      400  {"error":"shareM2 must be a whole number of square metres ≥ 0, or null"}
{"shareM2":"7"}      400  {"error":"shareM2 must be a whole number of square metres ≥ 0, or null"}
{"extraM2":-1}       400  {"error":"extraM2 must be a whole number of square metres ≥ 0, or null"}
```

The check runs over both keys in one loop, so neither can drift from the other,
and the test asserts the message rather than only the status.

**6. Test counts, fixtures, downloads and `tsc`.** The fast suite goes from 256
in eighteen files to **261 in eighteen**, the five being the new cases in
`store.test.ts`, which itself goes from 21 to 26. The slow suite is unchanged at
`57 passed | 1 expected fail`.

Both fixture baselines are unchanged at **12 and 7**, measured after this work:
`flat-1-two-storey.json` reads 1 hard plus 11 soft and `flat-1-no-stair.json`
reads 1 hard plus 6 soft. `testflats/` shows zero changed lines against `main`.
`src/core/saveFiles.ts` and `src/core/savePlan.ts` show zero changed lines
against `main`, so **the three downloads stay byte-identical**;
`docs/bridge-format.md` and the `dwelling-unit` format are untouched.
`npx tsc --noEmit` is clean and `npm run build` finishes with only the standing
chunk-size warning.

**7. `sessionView`.** It needed no change, and assumption 4's warning did not
apply. It is at `src/session/store.ts:365` and reads
`residents: Object.entries(index.residents).map(([name, r]) => ({ name, ...r }))`,
which spreads the record whole. Both keys reach the poll and `/export` because
of that spread, and the round trip proves it rather than assuming it.

**8. The skills.** Two were read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`interoperability` contributed section 1.4, the data-loss taxonomy. This bug is
its **metadata loss** row exactly: "properties, parameters, classifications
stripped … downstream tools lack decision-critical data", and the downstream
effect it predicts is the one run 0056 measured, a median over one answer. The
same section's **unit loss** line, "implicit unit assumptions cause scaling
errors", is the argument for task 2's decision: `share` and `shareM2` answer the
same question in different units, and the name gives no hint which one you are
holding, so the old key is marked in place rather than renamed. Its section 1.2
on federated models is why a bound on the slider does not belong here: each side
owns its own constraints and the seam carries only the data.

`design-automation` contributed the observation the prompt made itself, that one
field is described in four places. Its section 8.4 on audit trails and its key
principle 4, "design for maintenance", are the reason the check loops over both
keys rather than repeating itself, and the reason the type comment, the
document bullet and the test message all use the same wording, so a reader who
finds one finds the others.

`architectural-drawing`, `algorithmic-patterns` and `computational-geometry` were
**not read**: nothing here is geometry.

**9. Contradictions with the Assumptions, then my own.**

All six assumptions hold. Assumption 4 asked to be verified and holds, with no
fourth place to change. Assumption 6 named the two `toEqual` sites and both were
where it said.

My own assumptions. **The branch.** The constraint allows staying on the branch
of a run already in progress, and this session was mid-run on `run/0029`, so
that is where these five commits are; nothing is on `main`. **The error
message.** It reads "shareM2 must be a whole number of square metres ≥ 0, or
null", which follows the shape of the messages beside it, naming the key and
then the rule. **Ben's third `PUT`.** The prompt asked that his second body carry
only `shareM2`; his second body already exists and exercises the merge on the old
keys, so a third was added rather than the second rewritten, which keeps both
merges under test. **The ETag-race assertion** now expects a three-key record
rather than being updated to five, which is a change of meaning rather than of
numbers and is described under Findings.

## Artifacts produced

- `src/session/store.ts`, `src/session/store.test.ts`,
  `scripts/store-roundtrip.mjs`, `docs/store.md`.
- No new files.

## Decisions and rationale

**`share` is marked, not renamed and not removed.** Renaming would be the tidier
code and the worse contract, because a store cannot rename a key inside data it
has already handed out. Marking it in the type, and saying in the document that
nothing should read it again, costs one comment and breaks nobody.

**No upper bound in the store.** The prompt asked for this and the reason is
worth restating: a bound here would have to change in two repositories at once,
and the store has no way to know what the building app's slider offers.

**One loop over both keys in `parseResidentPatch`.** They have identical rules,
and two copies of a check drift. The loop is four lines and names the key in its
own error.

## Deviations from the prompt

**The branch.** `run/0030` was not created. The constraint's own second sentence
covers this: the work was done inside a run already in progress, so it stayed on
`run/0029` with its own commits, its own report and its own LOG row.

## Blocked / did not do

None.

## Open questions for you

**1. Should `share` be removed on a schedule rather than kept forever?** It is
dead the moment every live record has been rewritten, and nothing tracks that.
A note in `docs/store.md` giving a date after which it may go, or a one-off
migration that backfills `shareM2` from `share` times a floor area, would let it
actually leave rather than accumulate.

**2. Does the building app need to distinguish zero from null?** The store now
does, and the distinction is real: nobody has answered versus somebody answered
none. If the building app's median treats them the same, that is a decision
worth making on purpose rather than by accident, and it belongs in whichever
repository takes the median.

## Suggested next prompt

**0032, the median and what it is taken over.** In the building app, read every
resident's `shareM2` out of `GET /api/session/{code}` and take the median over
the answers that are not null, then say in the report how many residents
answered and how many did not, because that ratio is the thing the old bug hid.
Decide open question 2 there, since the app that takes the median is the one that
knows whether a zero and a silence should count the same, and write the decision
into `docs/store.md` on this side so both repositories carry the same sentence.
