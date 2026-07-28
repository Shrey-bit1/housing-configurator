---
name: next
description: Run the next queued prompt from the Cowork bridge inbox
argument-hint: [id — optional, defaults to oldest queued]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(mv:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git status:*), PowerShell(Move-Item *), PowerShell(git *)
---

# Run the next bridge prompt

Read `.claude/bridge/PROTOCOL.md` first if you have not already this session. It
defines numbering, slugs, and the file formats. Follow it exactly.

## 1. Pick the prompt

Look in `_cowork/inbox/`.

- Consider only `.md` files. Ignore everything else in the directory.
- If arguments were given (`$ARGUMENTS`), run the file whose id or filename matches.
- Otherwise run the **lowest-numbered** one.
- If there are no `.md` files, reply with exactly `Inbox empty.` and stop.
- **If `_cowork/outbox/` already holds a report with this id**, stop. Reply
  `Already run: <id> — report exists at <path>. Move or delete it to re-run.`
  This is what protects you from a failed move causing a duplicate run.

## 2. Run it

Carry out the task in the body. Follow its **Constraints** section strictly — that
section is where a prompt says what it must not touch, and it is the only such
signal the file carries.

How far you may go otherwise is set by the session's own mode, not by the prompt
file. Work within whatever that allows. If the task plainly needs more than the
current mode permits, do the part you can, and say so under **Blocked** rather than
working around it.

If the prompt conflicts with the repo as it actually is — a file that moved, an
assumption that's now false, an approach the code has already outgrown — do the
sensible thing and record it under **Deviations**. Do not silently follow an
instruction that no longer fits, and do not stop to ask.

## 3. Write the report

Write to `_cowork/outbox/<id>-<slug>.report.md` using
`.claude/bridge/REPORT_TEMPLATE.md`. Slug rules are in the protocol: `[a-z0-9-]`
only, 40 characters maximum.

Get `branch` and `commit` from git. Use today's date for `completed` — date only,
no clock time, which you do not reliably have.

**The report is read by a planning session that cannot see this repository.** Cite
`file.py:line` every time. Numbers, not adjectives. Mark estimates as estimates.
List output artifacts by path.

**Open questions** and **Suggested next prompt** are what the next planning cycle
runs on — spend real effort there. Everywhere else, write `None.` rather than
padding.

## 4. Close the loop

1. Move the prompt file from `_cowork/inbox/` to `_cowork/done/`. Use whichever
   shell tool this machine has — `mv` under Bash, `Move-Item` under PowerShell. Both
   are pre-approved above; if it still asks, approve once with "don't ask again" and
   it won't ask on later runs.
2. **Verify the move.** If the file is still in `_cowork/inbox/`, add a fourth reply
   line: `MOVE FAILED — <filename> still queued, /next will refuse to re-run it.`
3. Append one row to the table in `_cowork/LOG.md`:
   `| <id> | <YYYY-MM-DD> | <title> | <status> | <report filename> |`
4. If this run materially changed the shape of the repo — new top-level directory,
   new entry point, a dependency or run step that didn't exist before — update the
   relevant section of `_cowork/CONTEXT.md` and its **Last updated** line. That file
   is how future planning sessions orient themselves; a stale one sends them wrong.
   Skip this for ordinary edits.
5. Reply with **only** these three lines. No summary, no recap — the report file
   already holds all of it, and the planning session reads that, not this:

```
Report: _cowork/outbox/<filename>
Status: complete | partial | blocked
<one sentence on what happened>
```
