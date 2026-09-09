---
id: "0044"
title: The twenty settle, and the line endings stay put
created: 2026-09-09
---

## Context

Two fixes, no feature. The building app's run 0069 walked a vote with
`scripts/vote-group.mjs` and found that the twenty give 8 to 12 on every
pair of every round, which is 60 percent for the building the group has and
never the three quarters the brief needs. Four rounds ran and none settled.
The script's pick rule has to let a group settle in two or three rounds,
the way a room of people does.

And runs 0042 and 0043 each broke line endings on files and repaired them in
a commit of their own. A `.gitattributes` stops it.

## Assumptions

Check rather than trust, contradict rather than work around.

1. `scripts/vote-group.mjs` picks per person from their row in
   `scripts/fillGroupTable.mjs` by one rule: a person whose ballot ranks
   the pair's dial high picks the challenger; the others keep the building
   they have. Four named people change their mind once. The split is the
   same on every pair whatever the round.
2. The repository has no `.gitattributes`; files are CRLF on disk and the
   runs have twice rewritten them as LF.

## Tasks

1. The twenty settle, commit `script: the twenty settle in two or three
   rounds`. The pick rule gains the round number. In round 1 the split
   stays as it is, so the first count is a real disagreement. From round
   2, a person who saw their pick lose the previous round follows the
   winner with a stated chance that rises by round (say six in ten in
   round 2, nine in ten in round 3), seeded by the group code so the same
   group gives the same votes every time. The four who change their mind
   still do. Prove it: a fresh group settles in round 2 or 3 with three
   quarters or more on one building, printed round by round with the
   split of each pair and the store's `closedAt`. `--round n` still works.

2. The line endings, commit `repo: line endings stay as they are`. A
   `.gitattributes` that marks text files as `text=auto` with `eol=crlf`
   for the files this repository keeps as CRLF, or `eol=lf` if that is
   what the repository actually holds; measure first with `git ls-files
   --eol` and pick the one that leaves the working tree unchanged. Say
   which and why. No file's content changes in this commit.

3. Tests, commit `tests for 0044`. The pick rule over rounds 1 to 3 on the
   fixed table as a pure function: round 1 splits 8 to 12, round 3 reaches
   three quarters; the seed makes it repeatable. Existing suites green,
   both fixture baselines still 12 and 7, the three downloads
   byte-identical, the fingerprint test passing.

4. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0044-the-twenty-settle.report.md`, prompt moved to
   done/, one LOG row.

All four tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0044` from `main`. If `main` does not carry run 0043,
  stop and report.
- The store is not changed. The script writes through public calls only.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. The pick rule by round in one paragraph, and the round-by-round output
   of a fresh group settling, raw.
3. `git ls-files --eol` before, and the `.gitattributes` chosen.
4. Test counts before and after, both fixture baselines, the three
   download checks, the fingerprint test, `tsc` clean.
5. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
