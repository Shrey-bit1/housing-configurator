---
name: report
description: Capture this session's ad-hoc work as a Cowork bridge report, so work done outside a /next run still reaches the planning session
argument-hint: [short title for the report]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git rev-parse:*), Bash(git branch:*), PowerShell(git *)
---

# Capture this session as a bridge report

Read `.claude/bridge/PROTOCOL.md` first if you have not already this session.

Write everything substantive done in **this session so far** into a report file in
`_cowork/outbox/`, following `.claude/bridge/REPORT_TEMPLATE.md`.

Use this when work happened ad-hoc — outside a `/next` run — and still needs to
reach the planning session, which cannot see this repo. If a session produced real
work and is about to end without a report, run this without being asked.

## Numbering — the `A` namespace

Ad-hoc reports have no originating prompt, so they must not take a prompt id. Use
`A0001`, `A0002`, … numbered against **existing `A*` reports only**.

Never take the next plain number: a prompt with that id may already be queued in
`_cowork/inbox/`, and you would collide with it the next time `/next` runs.

Filename: `A<nnnn>-<slug>.report.md`, slug from `$ARGUMENTS` if given, otherwise from
the work itself. `[a-z0-9-]`, 40 characters maximum.

Front matter: `id: "A0001"`, `source: ad-hoc`.

## Content

Same rules as `/next`:

- The reader **cannot see this repository**. Cite `file.py:line` every time.
- Numbers, not adjectives. Mark estimates as estimates.
- List output artifacts by path.
- **Open questions** and **Suggested next prompt** carry the most weight.
- Cover only what actually happened in this session. Do not pad with background the
  planning session already has, and do not invent work that wasn't done. If the
  session produced nothing worth reporting, say so and write no file.

Then append the row to `_cowork/LOG.md` and reply with only:

```
Report: _cowork/outbox/<filename>
Status: complete | partial | blocked
<one sentence>
```
