---
id: "0002"
title: Verify and push the bridge commit
created: 2026-07-28
---

## Context

The bridge was committed as `0a6fadd` ("Add Cowork bridge") on `elastic-rooms`,
on top of `618f026`. That commit was made in an ad-hoc session rather than
through `/next`, so no report describes it and nobody has read what it contains.
`origin/elastic-rooms` still points at `618f026`, which means the commit exists
on one machine only and the record the protocol calls thesis source material is
still one disk failure from gone.

One thing the commit cannot contain is `_cowork/inbox/`. Git does not commit
empty directories, the inbox was empty when the commit was made, so a fresh
clone would arrive without it and `/next` would open a path that is not there.

## Task

1. Report what `0a6fadd` actually contains: `git show --stat 0a6fadd`, in full.

2. Create `_cowork/inbox/.gitkeep` (empty) so the directory survives cloning.
   Commit it by itself, staged by explicit path, with a message of your choosing
   that describes only that.

3. Confirm `_cowork/CONTEXT.md` is in neither commit and is still ignored by
   `.gitignore:24`, since it holds a machine-local absolute path.

4. Push `elastic-rooms` to origin and report `git rev-parse origin/elastic-rooms`
   afterwards. If the branch has no upstream, do not create one: leave both
   commits local and say so under Blocked.

## Constraints

- `git add -A` and `git add .` are forbidden for the whole run, including after
  a mistake. Stage every path by name, so the commit holds what was intended
  rather than whatever happened to be sitting in the working tree.
- Do not amend, rebase or otherwise rewrite `0a6fadd`, `618f026` or anything
  before them. If something is wrong with `0a6fadd`, report it and leave it
  alone: history that has been examined is worth more than history that is tidy.
- If `0a6fadd` turns out to contain any root-level file other than `.gitignore`
  and `CLAUDE.md`, do not name that file anywhere in the report. State how many
  such files there are and stop, and it will be handled outside the bridge.
- Touch nothing under `src/`, `docs/` or `index.html`. No code changes, so
  `PROJECT_STATE.md` needs no update and `tsc` and `npm run build` need not run.
- Do not delete anything under `_cowork/done/` or `_cowork/outbox/`.

## What I need back

1. The full `git show --stat 0a6fadd`.
2. Both commit hashes and the remote tip from `git rev-parse origin/elastic-rooms`,
   or a plain statement that the branch has no upstream.
3. Whether the working tree is clean afterwards. If it is not, the number of
   paths outstanding and whether any sit under `_cowork/`, `.claude/`, `src/` or
   `docs/`. Do not list root-level filenames.
4. How you verified that `_cowork/inbox/` now survives a clone.

The report follows `WRITING.md`: connected sentences that carry their own logic,
no em dashes as glue, no "X, not Y" contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
