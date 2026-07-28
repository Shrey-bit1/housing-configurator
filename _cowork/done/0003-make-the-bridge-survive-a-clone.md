---
id: "0003"
title: Make the bridge survive a clone
created: 2026-07-28
---

## Context

Two parts of the bridge only work on this machine.

`_cowork/CONTEXT.md` is ignored by `.gitignore:24` because line 28 records an
absolute path that is true here and nowhere else. The other 112 lines are
method: how the planning session should work, what the repo holds, and four
things about it that the code does not make obvious. A fresh clone therefore
arrives with a working bridge and no orientation file, so the first instruction
the planning session is given, which is to read `CONTEXT.md`, fails.

`/next` writes a report, moves the prompt and appends a log row, then commits
none of them. Every run so far has ended with its own record untracked and
waiting for a person to remember. Run 0002 ended that way and its three paths
are still outstanding.

## Task

1. Split `_cowork/CONTEXT.md`. Move the absolute path, currently line 28, into
   a new file `_cowork/CONTEXT.local.md`. Leave the rest of `CONTEXT.md` alone
   and put one short line where the path was, saying that the path lives in
   `CONTEXT.local.md` and that a fresh clone has to write that file by hand.
   Set the "Last updated" line to today.

2. Change `.gitignore` so `_cowork/CONTEXT.local.md` is ignored and
   `_cowork/CONTEXT.md` is not. Edit line 24 and the comment above it rather
   than adding a second rule, so one rule serves one purpose. Report what
   `git check-ignore -v` returns for both paths.

3. Edit step 4 of `.claude/skills/next/SKILL.md` so a run ends by committing
   its own record: the report in `_cowork/outbox/`, the prompt now in
   `_cowork/done/`, and `_cowork/LOG.md`. Three paths, staged by name, message
   `bridge: <id> <title>`. Never anything else, whatever else the run touched,
   so a run that changed code leaves those changes for a person to commit
   deliberately. Write into the skill that `git add -A` and `git add .` are
   forbidden in that step, because a skill that commits on every run is the one
   place a stray flag would do lasting damage.

4. Commit the three outstanding paths from run 0002, which predate the change
   and will not be picked up by it.

5. Push, then report both `git rev-parse origin/elastic-rooms` and
   `git ls-remote origin refs/heads/elastic-rooms`.

## Constraints

- `git add -A` and `git add .` are forbidden for the whole run, including after
  a mistake. Stage every path by name.
- Do not amend, rebase or otherwise rewrite any existing commit.
- Touch nothing under `src/`, `docs/` or `index.html`. No code changes, so
  `PROJECT_STATE.md` needs no update and `tsc` and `npm run build` need not run.
- `_cowork/CONTEXT.local.md` must never be committed. If it shows up in
  `git status` as anything other than ignored, stop before pushing and report
  that first.
- Leave everything in `/next` before its step 4 exactly as it is. How it picks,
  runs and reports a prompt does not change here.
- Do not reword `CONTEXT.md` beyond the one line this asks you to replace.
- If this run's own three paths are committed too, say whether the new step did
  it or you did it by hand. If they are not, leave them and say so.

## What I need back

1. What `git check-ignore -v` returns for `_cowork/CONTEXT.md` and for
   `_cowork/CONTEXT.local.md`.
2. Every commit hash made in this run, and the remote tip read both ways.
3. Whether a clone now arrives with `CONTEXT.md` present and
   `CONTEXT.local.md` absent. Verify by cloning, the way run 0002 did, rather
   than by reasoning about the tree.
4. The commit step you added to `next/SKILL.md`, quoted exactly as written.

The report follows `WRITING.md`: connected sentences that carry their own logic,
no em dashes as glue, no "X, not Y" contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
