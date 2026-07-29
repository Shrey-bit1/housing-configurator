---
id: "0005"
title: Fix the commit rule and delete the stale branches
created: 2026-07-28
---

## Context

Run 0004 could not write its task 4, because the permission layer refuses
`git add -A`. The decision has been taken to stage `_cowork/` as a single
directory path instead. That needs no permission change, it catches deletions,
and it covers every bridge file without a blanket flag. Changes to code made
during a run stay uncommitted on purpose, so a person reads them before they
enter history.

The repository is also down to one working branch and still lists four.

## Assumptions

These are read from the repository as of today, and every one of them may be
wrong. Where a task depends on one, check it rather than trusting it, and say so
in the report if it does not hold. Contradicting this section is more useful than
working around it.

1. `.claude/skills/next/SKILL.md` is 95 lines. The closing sub-step is numbered
   5, titled "Commit this run's own record, and nothing else", and occupies
   lines 74 to 87. Step 6 begins at line 88.
2. Local `main` is `0e9645c33f33d0693e171de7c9c9d9014b16da5c` and
   `origin/main` is `9aae1dfedde0856e427eb691cc0a8e76fae8bde6`, so `main` is 3
   commits ahead of the remote.
3. Four local branches exist: `main`, `elastic-rooms` at `9aae1df`,
   `bridge-flat-to-building` and `bundle-furnish-swing-verification`. Each has an
   `origin/` counterpart. There is no local `bridge-flat-import`.
4. `git add <directory>` is permitted here, since `git add <file>` was permitted
   during run 0004 and only the `-A` form was refused. This one is a guess and
   task 1 exists to test it.
5. `_cowork/outbox/0004-put-everything-on-main.report.md` on disk may differ
   from the copy inside commit `86e7043`, because the file was modified about 26
   seconds after that commit was made.

## Task

1. Before editing anything, test assumption 4. Run `git add _cowork/` once and
   report exactly what happens, including the full text of any refusal. If it is
   refused, stop the run here and report. Everything below depends on it.

2. Replace step 5 of `.claude/skills/next/SKILL.md` with a rule that stages the
   single path `_cowork/` and commits it with the message `bridge: <id> <title>`.
   Say in the skill that this is one path rather than a list, so that a prompt
   file moving from `inbox/` to `done/` is captured as both an arrival and a
   departure. Say that `git add -A` and `git add .` stay forbidden. Say that
   changes outside `_cowork/` are left uncommitted deliberately, for a person to
   read and commit. Keep the existing sentence that a run never pushes.

3. Report whether the working-tree copy of
   `_cowork/outbox/0004-put-everything-on-main.report.md` matches the copy in
   commit `86e7043`. Use `git diff 86e7043 -- <path>` and quote the result. Do
   not change the file either way.

4. Delete `elastic-rooms`, `bridge-flat-to-building` and
   `bundle-furnish-swing-verification`, locally and on the remote. Use
   `git branch -d`. If `-d` refuses any of the three, leave that branch alone,
   do not delete its remote counterpart, and report the refusal in full.

5. Push `main`.

## Constraints

- `git branch -D` is forbidden. A branch that will not delete cleanly is a
  branch carrying something nobody has looked at.
- Do not amend, rebase or otherwise rewrite existing commits.
- Do not change any ignore rules, and do not list ignored files.
- Touch nothing under `src/`, `docs/` or `index.html`. No code changes, so
  `PROJECT_STATE.md` needs no update and `tsc` and `npm run build` need not run.
- If the permission layer refuses any command, stop and report it rather than
  writing the same instruction a different way.

## What I need back

Quote raw command output rather than summarising it, because the point of this
report is that its numbers can be checked against the repository afterwards.

1. What `git add _cowork/` printed in task 1.
2. The new step 5 of `next/SKILL.md`, quoted exactly as written, with the line
   range it now occupies.
3. The output of `git diff 86e7043 -- _cowork/outbox/0004-put-everything-on-main.report.md`.
4. For each of the three branches, the exact output of the local delete and of
   the remote delete.
5. `git branch -a` afterwards, in full.
6. `git rev-parse origin/main` and `git ls-remote origin refs/heads/main`.

The report follows `WRITING.md`: connected sentences that carry their own logic,
no em dashes as glue, no "X, not Y" contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
