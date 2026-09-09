---
id: "0046"
title: A slower rise
source: ad-hoc, asked in the session on 9 September
status: complete
branch: run/0046
commit: 599d7a4
completed: 2026-09-09
---

## Summary

A follow-up to run 0045, asked for directly rather than through a prompt file.
The following chance drops from six in ten to three in ten in round 2, and from
nine in ten to seven in ten in round 3, so the shared-space pair rises 12 of 20,
then about 15, then about 18 across the three rounds a walk shows. Run 0045 took
the same pair to 19 in round 2 and 20 in round 3, which left one interesting
round and two flat ones. Two commits, both under `scripts/`, and nothing else in
the repository moved.

## What I did

Two commits on `run/0046`, cut from `main` at `a9136ce`, which is the merge of
run 0045.

| Commit | Title | Stats |
|---|---|---|
| `2ad0c04` | script: a slower rise | `fillGroupTable.mjs` +9 −6 |
| `599d7a4` | tests for 0046 | `fillGroupTable.test.ts` +33 −17 |

`FOLLOWS_THE_WINNER` at `scripts/fillGroupTable.mjs:169` reads `{ 2: 0.3, 3: 0.7 }`
and `FOLLOWS_THE_WINNER_LATER` stays at `0.9`, so a group that runs past round 3
still finishes.

## Findings

**The rise is 12, then 14.4, then 17.6 by design.** Eight people are on the
losing side of the shared-space pair after round 1. Three in ten of eight is 2.4
and seven in ten is 5.6, so the count for the challenger is 12, then about 14 or
15, then about 17 or 18. The draw is held for the whole vote, so the count never
falls.

**The round-by-round output on a fresh group**, `slower-0046`, four rounds of
five pairs, read back from `GET /api/session/slower-0046/export`. The figure is
the count for the building the group had, then for the challenger. A star marks
the pair the challenger won.

```
round 1  privacy: 13/7   shared space: 8/12*  cost: 13/7   light: 13/7   short walks: 13/7    replaced 4
round 2  privacy: 14/6   shared space: 6/14*  cost: 16/4   light: 16/4   short walks: 14/6    replaced 0
round 3  privacy: 20/0   shared space: 3/17*  cost: 19/1   light: 17/3   short walks: 18/2    replaced 0
round 4  privacy: 20/0   shared space: 0/20*  cost: 20/0   light: 19/1   short walks: 20/0    replaced 0
```

The shared-space challenger goes 12, 14, 17, 20. Round 4 is included to show
where it finishes and is not part of what was asked for.

**What a code changes.** The chance is drawn from the group code, so the exact
count varies. Measured across eight codes, the shared-space pair reads:

| code | round 1 | round 2 | round 3 |
|---|---|---|---|
| `slower-0046` | 12 | 14 | 17 |
| `choose-0045` | 12 | 16 | 19 |
| `hall-14` | 12 | 15 | 18 |
| `walk-08` | 12 | 13 | 18 |
| `room-42` | 12 | 14 | 17 |
| `one-group` | 12 | 13 | 20 |
| `another-group` | 12 | 15 | 18 |
| `settle-0044` | 12 | 13 | 14 |

Round 2 lands between 13 and 16 and round 3 between 14 and 20, around the 14.4
and 17.6 the design gives.

**Three quarters moved from round 3 to round 4.** Under run 0045 every code
reached 15 of 20 for the winning side by round 3. With the slower rise the worst
case across eight codes and five dials is 13 in round 2, 14 in round 3 and 17 in
round 4. So the test that claims three quarters for any code now asserts it at
round 4, which is the round where it holds for all of them, rather than at the
round where it usually does.

## Evidence

**Test counts.**

| suite | before (`a9136ce`) | after |
|---|---|---|
| fast | 533 in 24 files | 534 in 24 files |
| slow | 59 passed, 1 expected fail, in 4 files | 59 passed, 1 expected fail, in 4 files |

`scripts/fillGroupTable.test.ts` goes from 58 to 59 cases. Four changed and one
was added, the one that pins the rise on the shared-space pair.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical.** `git diff --stat a9136ce HEAD` over
`src/`, `docs/` and `testflats/` returns nothing at all. This run touched two
files, both under `scripts/`.

**The landing fingerprint test passes at 16.**

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 10.92 s.**

**Both files this run wrote are clean**, zero stray CRs and zero NUL bytes,
counted by bytes.

## Artifacts produced

- `_cowork/outbox/0046-a-slower-rise.report.md` — this file.
- `scripts/fillGroupTable.mjs` — the chance table.

## Decisions and rationale

**Nine in ten stays from round 4.** Only rounds 2 and 3 were asked to slow down,
and a group that runs to five or six rounds should still finish rather than
crawl.

**The test for three quarters moved to round 4 rather than loosening.** Asserting
15 of 20 at round 3 would have failed on `settle-0044`, and asserting 14 there
would have been a claim about three quarters that is not three quarters. Round 3
is now pinned at 14 or better and round 4 carries the settling claim.

## Deviations from the prompt

**This report is numbered 0046 in the run namespace, as asked, rather than in
the `A` namespace.** `.claude/bridge/PROTOCOL.md` reserves `A0001`, `A0002` and
so on for work that did not come from a prompt file, so that an ad-hoc report can
never collide with a queued prompt id. There is no `0046` prompt in
`_cowork/inbox/` or `_cowork/done/`, so a future prompt written as 0046 would
now find a report already sitting under that id and `/next` would refuse to run
it. Worth knowing when the next prompt is numbered.

**The numbers asked for were "about 15" and "about 18" and the walked group gave
14 and 17.** The design gives 14.4 and 17.6, and a particular code lands within a
couple of votes either side. `slower-0046` is one of the lower ones. Nothing was
tuned to hit the figures, and the eight-code table above is what the rule
actually produces.

## Blocked / did not do

None.

## Open questions for you

1. **A walk of three rounds now ends at about 18 of 20 rather than at 20.** That
   is a group still moving, which is what was asked for, and it means the vote
   on screen has not finished when the walk stops. Whether the presentation
   wants to end on a settled count or on a rising one is a question about what
   the last slide should say.

## Suggested next prompt

The one from run 0045 still stands and this run does not touch it: let the
pair's own numbers decide, so a vote can go either way. Each candidate carries a
`summary` that `scripts/vote-group.mjs` reads nothing from, and until it does,
the group takes more shared space because the table says so rather than because
the building on screen offers more of it.
