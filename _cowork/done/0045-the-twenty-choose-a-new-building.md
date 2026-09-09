---
id: "0045"
title: The twenty choose a new building
created: 2026-09-09
---

## Context

Run 0044 made the twenty settle, and its report says what they settle on:
always the building the group already had, because the fill table gives
every challenger 8 of 20 on every dial, so a challenger never wins a pair.
On stage that reads as a vote that changed nothing. Shrey decided on
9 September: the twenty favour one challenger, the one with more shared
space, so the group settles on a new building; and the four who change
their mind do it in round 1 only.

Two small changes to the script, no feature. Run 0071 in the building app
bakes the demo store with this script, so this lands first.

## Assumptions

Check rather than trust, contradict rather than work around.

1. `scripts/vote-group.mjs` picks from each person's `cares` column in
   `scripts/fillGroupTable.mjs`; from round 2 a loser follows the winner
   with a rising chance, seeded by the group code (run 0044).
2. The building app offers a pair per dial whose challenger differs, so a
   "shared space" pair is offered whenever the shared-space challenger
   differs from the building the group has.

## Tasks

1. One dial wins, commit `script: the twenty favour more shared space`.
   The `cares` column is rebalanced so that in round 1 the shared-space
   challenger gets 12 of 20 and every other challenger 8 of 20. From round
   2 the following rule from run 0044 then carries the group to three
   quarters on the shared-space challenger by round 3. If a round offers
   no shared-space pair, the twenty behave as run 0044 left them. Prove
   it on a fresh group: print each round's split per pair and the
   building the group settled on, which must differ from the one it
   started with.

2. A change of mind in round 1 only, commit `script: minds change once`.
   The four named people change their vote in round 1 and in no later
   round. `replaced` holds four entries after round 1 and none after
   rounds 2 and 3; print it.

3. Tests, commit `tests for 0045`. The pick rule over three rounds on the
   fixed table: round 1 gives 12 of 20 on the shared-space pair and 8 on
   the others; round 3 reaches three quarters on the shared-space
   challenger; `replaced` is four then nought. Existing suites green,
   both fixture baselines still 12 and 7, the three downloads
   byte-identical, the fingerprint test passing.

4. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0045-the-twenty-choose-a-new-building.report.md`,
   prompt moved to done/, one LOG row.

All four tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0045` from `main`. If `main` does not carry run 0044,
  stop and report.
- The store is not changed. The script writes through public calls only.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. The round-by-round output on a fresh group, raw, and the settled
   building against the starting one.
3. Test counts before and after, both fixture baselines, the three
   download checks, the fingerprint test, `tsc` clean.
4. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
