---
id: "0029"
title: Fifteen more flats, a bedroom in every one, and a way to delete
source: 0029-fifteen-more.md
status: blocked
branch: run/0028
commit: a5f1dec
completed: 2026-09-04
---

## Summary

The run stopped at its first assumption, as that assumption instructs. Assumption
1 says `main` carries run 0028 merged, and it does not: `main` is still at
`ac9d84d`, the run 0027 merge, and run 0028's eight commits sit unmerged on
`run/0028`. The prompt's own words for this case are "stop and report; merging is
Shrey's call", so nothing was drawn, no rule was added and no branch was cut.
This is not a formality. The constraints require `run/0029` to branch from `main`,
and every artefact the nine tasks build on lives only on `run/0028`, so a branch
cut from `main` today would start without the generator, without the five flats
and without the study the reading is meant to extend.

**To unblock: merge `run/0028` into `main`, then move
`_cowork/done/0029-fifteen-more.md` back to `_cowork/inbox/` and delete or rename
this report, which is what `/next` checks before it will re-run an id.**

## What I did

- Read `.claude/bridge/PROTOCOL.md`, `_cowork/inbox/0029-fifteen-more.md`, and
  checked assumption 1 against git.
- Nothing else. No branch was created, no file outside `_cowork/` was touched,
  and `src/core/rules.ts` is untouched as the constraints require.

## Findings

**`main` is at `ac9d84d`.** `git log -1 --format='%h %s' main` returns
`ac9d84d Merge run/0027: the landing screen, and one place for everything`.
`origin/main` is at the same commit. `git branch --merged main` lists `main`,
`run/0022`, `run/0023`, `run/0024`, `run/0025`, `run/0026` and `run/0027`, and
does not list `run/0028`.

**Run 0028 is complete and pushed, just not merged.** `git log --oneline
main..run/0028` counts 8 commits, and `origin/run/0028` is at `a5f1dec`, the same
commit as the local branch, so nothing is waiting to be pushed. Run 0028's own
report at `_cowork/outbox/0028-five-flats.report.md` records it as complete.

**Every file run 0029 needs is absent from `main`.** Checked one by one with
`git cat-file -e main:<path>`:

| path | on `main`? | which 0029 task needs it |
|---|---|---|
| `scripts/gen-flat.mjs` | missing | 3, 5, 6 |
| `scripts/flatLayout.ts` | missing | 5, 8 |
| `scripts/flatLayout.test.ts` | missing | 8 |
| `scripts/flats/unit-8.flat.json` | missing | 3 |
| `public/units/unit-8.json` | missing | 3, 6, 7 |
| `public/units/unit-12.json` | missing | 6, 7 |
| `src/core/libraryClean.slow.test.ts` | missing | 8 |
| `_cowork/outbox/0028-reference-plans.md` | missing | 1, 5 |
| `_cowork/outbox/0028-five-flats.report.md` | missing | 1 |

So the block reaches every one of the nine tasks except task 2 and task 4.

**Task-by-task, what a branch from `main` could and could not do.** Task 1, the
wider reading, is told to add to run 0028's study, and that study is not on
`main`. Task 2, the bedroom rule, could be written against `main`, but its own
acceptance step is "run every flat in `public/units/` and both fixtures against
it", and `main` holds seven flats rather than twelve, so the result would be
wrong the moment 0028 merged. Task 3 redraws Flat 08, which does not exist on
`main`. Task 4, the delete control, is the one task that is genuinely independent
of run 0028. Tasks 5, 6 and 7 need the generator and the five flats. Task 8
extends `libraryClean.slow.test.ts`, which is not on `main`.

Doing task 2 or task 4 alone on a branch from `main` would produce a branch that
conflicts with `run/0028` in `public/units/index.json` and in
`_cowork/LOG.md`, and would have to be redone against the merged tree anyway. So
nothing was started.

**Assumption 5 is still true and was left alone.** `public/units/unit-6.json`,
`unit-6.jpg`, `unit-7.json` and `unit-7.jpg` are still untracked in the working
tree, and `public/units/index.json` still carries their two rows as an
uncommitted diff, exactly as run 0028 left them.

## Evidence

Commands run and what they returned.

```
$ git branch --show-current
run/0028

$ git log -1 --format='%h %s' main
ac9d84d Merge run/0027: the landing screen, and one place for everything

$ git log -1 --format='%h %s' origin/main
ac9d84d Merge run/0027: the landing screen, and one place for everything

$ git log --oneline main..run/0028 | wc -l
8

$ git rev-parse --short origin/run/0028
a5f1dec

$ git branch --merged main
  main
  run/0022
  run/0023
  run/0024
  run/0025
  run/0026
  run/0027
```

The eight commits on `run/0028`, oldest first: `45d6611` library: what real plans
do, `ffdf298` library: a flat from a graph, `54fdf34` library: five flats,
`3edbba7` library: five flats, all clean, `e9c8eb6` library: five previews,
`c6ae771` library: the five on one sheet, `5b94501` library: tests for the five,
`a5f1dec` bridge: 0028 Five flats for the library, the first batch.

No preview server was started and no preview address exists for this run.

## Artifacts produced

- `_cowork/outbox/0029-fifteen-more.report.md`, this file.

Nothing else. No code, no flats, no rule.

## Decisions and rationale

**Stopping rather than branching from `run/0028`.** The constraints say "A new
branch `run/0029` from `main`". Branching from `run/0028` instead would have got
the work done and would have quietly overridden an explicit constraint, and it
would also have hidden the fact that `main` is now two runs behind what the
planning session believes. The assumption exists to surface exactly this.

**Stopping rather than doing task 4 alone.** Task 4, the delete control, is the
only one of the nine that does not touch run 0028's output. Building it on a
branch from `main` would still collide with `run/0028` in
`public/units/index.json` and `_cowork/LOG.md` at merge time, and the run would
have to be re-run in full anyway. A partial branch that has to be thrown away is
worse than no branch.

**Following the skill's close-out even though the run is blocked.** The prompt
file is moved to `_cowork/done/` and a LOG row is appended with status `blocked`,
because the bridge's invariant is that a report implies a moved prompt, and
`/next` already has a documented way back: it refuses an id whose report exists
and says to move or delete that report to re-run. The unblocking steps are at the
top of this report so nobody has to reconstruct them.

## Deviations from the prompt

None. The prompt said to stop if assumption 1 failed, and it failed.

## Blocked / did not do

All nine tasks. In order: the wider reading, the bedroom rule, Flat 08 redrawn,
the delete control, the fifteen flats, the twenty-flat check, previews and the
contact sheet, the tests, and the PROJECT_STATE and CONTEXT updates.

What is in the way is one merge. `run/0028` is complete, pushed to
`origin/run/0028` at `a5f1dec`, and its own report records it as complete. Once
it is on `main`, every assumption in this prompt holds as written and the run can
proceed unchanged.

## Open questions for you

**1. Should `/next` refuse to start when the run before it is unmerged, or should
it branch from the tip of the previous run?** This is the second time the bridge
has produced a run whose prompt assumes the previous one merged. Runs 0026, 0027
and 0028 each needed a separate instruction to merge, which means the gap between
"the run is complete" and "the run is on `main`" is a standing feature of this
workflow rather than an accident. Branching each run from the previous run's tip
would remove the stall and would also remove `main` as the thing that says what is
agreed. Deciding this is worth one paragraph in the protocol.

**2. Should a blocked run keep its id?** This report occupies `0029` and the
prompt is now in `done/`, so re-running it needs two manual steps. The alternative
is that a blocked run leaves the prompt in `inbox/` and writes no report, at the
cost of losing the record that anyone looked. The current protocol does not say.

## Suggested next prompt

There is no new prompt to write. Merge `run/0028` into `main`, move
`_cowork/done/0029-fifteen-more.md` back to `_cowork/inbox/`, delete or rename
`_cowork/outbox/0029-fifteen-more.report.md`, and run `/next` again. The 0029
prompt needs no edits: every one of its twelve return points and nine tasks holds
as written once `main` carries run 0028.

If the merge raises a question first, the one thing worth deciding alongside it is
open question 1 above, because it decides whether this stall recurs at run 0030.
