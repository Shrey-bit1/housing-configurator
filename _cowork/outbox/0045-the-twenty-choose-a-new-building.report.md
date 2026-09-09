---
id: "0045"
title: The twenty choose a new building
source: 0045-the-twenty-choose-a-new-building.md
status: complete
branch: run/0045
commit: 2c5a8db
completed: 2026-09-09
---

## Summary

All four tasks landed. The twenty now favour the challenger with more shared
space, so a walked vote settles on a building the group did not start with
rather than confirming the one it had. The four who change their mind do it in
round 1 and in no later round. One number in the prompt could not be built, and
the reason is arithmetic rather than judgement. One thing the prompt did not
mention had to change with it: the following rule from run 0044 assumed the
challenger always loses, and it does not any more.

## What I did

Four commits on `run/0045`, cut from `main` at `05298a8`, which is the merge of
run 0044 and does carry it. Nothing was staged with `git add -A`. Only two files
changed, both under `scripts/`, plus `PROJECT_STATE.md`.

| Commit | Title | Stats |
|---|---|---|
| `b69bee4` | script: the twenty favour more shared space | `fillGroupTable.mjs` +42 −22 |
| `91a908b` | script: minds change once | `fillGroupTable.mjs` +5 −2 |
| `2ab5903` | tests for 0045 | `fillGroupTable.test.ts` +81 −36 |
| `2c5a8db` | docs: PROJECT_STATE for run 0045 | +39 |

## Findings

**Twelve and eight does not exist.** Task 1 asked that round 1 give the
shared-space challenger 12 of 20 and every other challenger 8 of 20. Under the
rule that a person wants the challenger when its dial is one of their top two
cares, twenty people hold forty top-two places, and 12 + 8 + 8 + 8 + 8 is
forty-four. Twelve for shared space leaves seven each for the other four. The
table holds that, and `scripts/fillGroupTable.test.ts` counts the forty places
so the arithmetic is written down rather than rediscovered.

**The following rule had to learn who won.** Run 0044's `voteFor` moved a person
who wanted the challenger toward the building the group had, because at the time
every dial split 8 to 12 and the challenger always lost. With shared space at 12
the challenger wins its pair, and the old rule carried the group away from the
building it had just chosen: the shared-space challenger went from 12 of 20 in
round 1 down to 6 in round 2 and 0 in round 3. `roundOneWinner` at
`scripts/fillGroupTable.mjs:171` now counts round 1 over the table, and the rule
moves the losing side toward whichever side won. It stays pure: the winner is
counted from `RESIDENTS`, never remembered.

**A person who comes across to a winning challenger ticks the dial.** Coming
across to the incumbent keeps their own first care, as run 0044 had it, because
they are saying the group has decided and they still care about what they came
for. Coming across to a challenger ticks that challenger's dial, because the
thing that won is the thing the dial names.

**The round-by-round output on a fresh group**, `choose-0045`, three rounds of
five pairs, read back from `GET /api/session/choose-0045/export`. The figure is
the count for the building the group had, then for the challenger.

```
round 1  privacy: 13/7   shared space: 8/12 <-b wins   cost: 13/7   light: 13/7   short walks: 13/7
          replaced 4   closed 2026-09-09T11:34:12.705Z
round 2  privacy: 18/2   shared space: 1/19 <-b wins   cost: 15/5   light: 19/1   short walks: 18/2
          replaced 0   closed 2026-09-09T11:34:59.262Z
round 3  privacy: 19/1   shared space: 0/20 <-b wins   cost: 19/1   light: 20/0   short walks: 20/0
          replaced 0   closed 2026-09-09T11:35:45.194Z
```

**The settled building against the starting one.** On the shared-space pair of
round 3, `r3-p2`, the building the group started with carries the genome
`[3,1,4]` and the one it settled on carries `[3,2,4]`. They differ, and twenty
of twenty voted for the second. Every other pair settled on the building the
group had, which is the four dials nobody was pushing.

**`replaced` is four then nothing.** Four after round 1, none after rounds 2 and
3, printed above and asserted in the tests over rounds 2, 3 and 4.

## Evidence

**Test counts.**

| suite | before (`05298a8`) | after |
|---|---|---|
| fast | 530 in 24 files | 533 in 24 files |
| slow | 59 passed, 1 expected fail, in 4 files | 59 passed, 1 expected fail, in 4 files |

Eight existing cases in `scripts/fillGroupTable.test.ts` changed, because they
pinned the old 8-to-12 split, and five were added. The file goes from 55 to 58.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical.** `git diff --stat 05298a8 HEAD` over
`src/`, `docs/bridge-format.md` and `testflats/` returns nothing at all. This
run touched no file under `src/`.

**The landing fingerprint test passes at 16.**

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 8.43 s.**

**Every file this run wrote is clean**, zero stray CRs and zero NUL bytes in
`scripts/fillGroupTable.mjs`, `scripts/fillGroupTable.test.ts` and
`PROJECT_STATE.md`, counted by bytes. Every edit joined lines with the ending
the file already had, which is what run 0044 found to be the cure.

## Artifacts produced

- `_cowork/outbox/0045-the-twenty-choose-a-new-building.report.md` — this file.
- `scripts/fillGroupTable.mjs` — the rebalanced `cares` column and
  `roundOneWinner`.

## Decisions and rationale

**Shared space is twelve and the other four are seven**, rather than changing
the top-two rule to make eight possible. The prompt asked for the column to be
rebalanced, and the column can carry twelve. Widening the rule for one reason
would have made the rule about shared space rather than about what a person
cares most about.

**Every reason is still somebody's first care exactly four times.** Shared space
reaches twelve by being a second care eight times rather than a first care more
often, so the twenty still open the vote wanting five different things.

**`roundOneWinner` counts rather than remembers.** The alternative was to pass
the previous round's tally into the rule, which would have made the pick depend
on a store read and taken the whole vote out of reach of a test.

## Deviations from the prompt

**Task 1's numbers are 12 and 7, not 12 and 8.** The arithmetic is under
Findings. The effect is that a losing challenger takes 7 of 20 in round 1 rather
than 8, so round 1 is a slightly clearer disagreement than before.

**Task 1 also changed the following rule, which it did not ask for.**
Rebalancing the column alone gives the shared-space challenger 12 in round 1 and
then takes it to 0 by round 3, which is the opposite of what the task is for.
The two are one change and the commit says so.

**Assumption 1 says the pick comes from `cares` and the loser follows the winner
with a rising chance.** The first half is right. The second half was written as
"a loser follows the winner" and the code said "follows the incumbent", which is
the same thing only while the incumbent always wins. That is the defect above.

**Assumption 2 is about the building app and could not be checked here.** It
says the building app offers a pair per dial whose challenger differs, so a
shared-space pair is offered whenever that challenger differs from the building
the group has. Nothing in this repository decides that. The walk used five
pairs, one per dial, opened by hand through `PUT /round`, so the shared-space
pair was present in all three rounds. If the building app ever opens a round
with no shared-space pair, the twenty behave as run 0044 left them and settle on
the building they had, which is what task 1 asked for and what
`roundOneWinner` gives without any special case.

## Blocked / did not do

None.

## Open questions for you

1. **The vote now always ends the same way, and that is a different kind of
   nothing.** Before this run the group confirmed its building every time.
   After it, the group takes the shared-space challenger every time, because
   twelve of twenty is a property of a fixed table rather than of what the two
   buildings on screen actually offer. A demo that always chooses more shared
   space is more interesting than one that never chooses anything, and it is
   still a foregone conclusion. Whether the presentation wants a vote that could
   go either way, which means reading the pair's own numbers, is a question
   about what the vote is meant to show rather than about the script.

2. **Round 2 is nearly unanimous on the winning pair, 19 of 20.** Six in ten of
   the eight losers come across, and on the shared-space pair the losing side is
   eight people, so round 2 lands at 19 and round 3 at 20. A group that goes
   from 12 to 19 to 20 has one interesting round and two flat ones. If the
   presentation walks three rounds on screen, a slower rise would give the third
   round something to show.

## Suggested next prompt

Let the pair's own numbers decide, so a vote can go either way. Each candidate
in a round carries a `summary` that the building app writes and
`scripts/vote-group.mjs` reads nothing from. Make the pick read one number from
it, the flats that fit or the shared space in square metres, and weigh that
against the person's `cares`: somebody who cares about shared space picks the
challenger when it offers more of it, and keeps the building they had when it
does not. Then a round where the challenger is worse is a round the challenger
loses, and the demo store's outcome follows from the buildings rather than from
the table. The run should keep round 1 a real disagreement, keep the group
settling by round 3, keep the whole rule pure and seeded by the group code, and
report two walked votes: one where the challenger wins and one where it loses,
with the numbers that decided each.
