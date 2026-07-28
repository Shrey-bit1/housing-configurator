---
id: "0004"
title: Put everything on main
created: 2026-07-28
---

## Context

Work has been happening on `elastic-rooms` while `main` sat still. From now on
there is one branch, `main`, and pushing is something a person asks for rather
than something a run does. This run moves everything across and changes `/next`
to match.

## Task

1. Report `git status --porcelain` in full, then commit everything it lists on
   `elastic-rooms` with the message `Bring branch up to date before merging to
   main`. `git add -A` is fine here. If it lists nothing, say so and move on.

2. Switch to `main` and merge `elastic-rooms`. Say whether it fast-forwarded or
   made a merge commit. If there is a conflict, stop and report it rather than
   resolving it.

3. Push `main`. Push `elastic-rooms` too, so the two agree on the remote.

4. Simplify step 4 of `.claude/skills/next/SKILL.md`. A run now ends by staging
   everything with `git add -A` and committing with the message
   `bridge: <id> <title>`. That is the end of the run. Remove the rule that
   forbids `git add -A` and remove the three-paths-by-name list. Write into the
   skill that `/next` never pushes, because pushing is a decision a person makes
   deliberately and not something a run does on its own. This run pushes only
   because tasks 1 to 3 say to, which is the last time that happens by default.

5. Fix three stale lines in `_cowork/CONTEXT.md`. Line 29 says the branch is
   `elastic-rooms`, and it is `main`. Line 103 cites `.gitignore:27-30`, and the
   negation rules are at 28-31. Lines 106-107 say this file is not tracked
   because it holds an absolute path, which stopped being true in run 0003 when
   the path moved out, so that sentence goes. Set "Last updated" to today.

## Constraints

- Do not change any ignore rules, and do not list ignored files.
- Do not amend, rebase or otherwise rewrite existing commits. Merge rather than
  rebase.
- Do not delete any branch.
- No code changes, so `PROJECT_STATE.md` needs no update and `tsc` and
  `npm run build` need not run.
- If the merge is not clean, stop at task 2 and report. Tasks 4 and 5 can wait.

## What I need back

1. What `git status --porcelain` showed before anything was committed.
2. Every commit hash made in this run, and whether task 2 fast-forwarded.
3. `git rev-parse origin/main` and `git ls-remote origin refs/heads/main`.
4. The new step 4 of `next/SKILL.md`, quoted exactly as written.

The report follows `WRITING.md`: connected sentences that carry their own logic,
no em dashes as glue, no "X, not Y" contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
