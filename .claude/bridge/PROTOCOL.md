# Cowork bridge protocol

Two Claude sessions work on this repo and neither can see the other:

- **Cowork** plans and refines prompts. It reaches this repo only through the
  desktop app's connected-folder bridge. It does not run code here.
- **Claude Code** runs in this repo. It executes prompts and writes reports.

They exchange work through files in `_cowork/`. Nothing is copy-pasted.

**Both sides read this file.** It is the contract.

```
.claude/bridge/          the protocol itself
├── PROTOCOL.md          this file
└── REPORT_TEMPLATE.md   structure every report follows

_cowork/                 the working traffic
├── CONTEXT.md           repo path, branch, summary, and a pointer back to this
│                        file. Cowork reads it at the start of every session.
│                        The only gitignored item — it holds a machine-local path.
├── inbox/               prompts waiting to run     (written by Cowork)
├── outbox/              reports from finished runs (written by Claude Code)
├── done/                prompts already run        (moved by /next)
└── LOG.md               one row per exchange
```

All of it except `CONTEXT.md` is committed to git, deliberately — see the last
section.

## The cycle

1. Cowork plans a prompt and writes `_cowork/inbox/0007-slab-topology.md`.
2. In Claude Code, `/next` picks up the oldest queued prompt, does the work, writes
   `_cowork/outbox/0007-slab-topology.report.md`, moves the prompt to `done/`, and
   appends a row to `LOG.md`.
3. Cowork reads the new report and plans the next prompt from it.

`/bridge` shows what's queued and flags inconsistencies. `/report` captures ad-hoc
work that happened outside a `/next` run.

## Numbering

Getting this wrong produces two files claiming the same id, which is the one failure
mode that silently corrupts the record. The rules:

- **Prompt ids** are 4-digit, zero-padded, and **always quoted in YAML**:
  `id: "0008"`. Unquoted `id: 0008` parses as the integer 8 and loses the padding.
- **The next prompt id** is 1 + the highest number found across **all four of**
  `_cowork/inbox/`, `_cowork/done/`, `_cowork/outbox/`, and the rows in
  `_cowork/LOG.md` — **ignoring any id that begins with `A`**. Checking only the
  inbox is wrong: it's usually empty, because run prompts get moved to `done/`.
- **Reports inherit the id of the prompt they answer.** Prompt `0008-x.md` produces
  report `0008-x.report.md`.
- **Ad-hoc reports** — those from `/report`, with no originating prompt — use a
  separate `A` namespace: `A0001`, `A0002`, numbered against existing `A*` reports
  only. This makes collision with queued prompt ids structurally impossible.
- **The number in the filename wins** if it ever disagrees with the front matter.

## Slugs

`[a-z0-9-]` only, lowercase ASCII, 40 characters maximum. Strip everything else.

Titles routinely contain `:`, `—`, `/` and `?`, all of which are either illegal in
Windows filenames or awkward on the command line. A title of
`Slab topology: v2 — corner cases` becomes the slug `slab-topology-v2-corner-cases`.

## Prompt file format

Written by Cowork into `_cowork/inbox/`.

```markdown
---
id: "0007"
title: Slab topology — bottom-up aggregation rules
created: 2026-07-27
---

## Context

What Claude Code needs that isn't obvious from reading the repo. Decisions taken in
the planning session, constraints from the thesis argument, things tried already.

## Task

The actual thing to do.

## Constraints

Hard limits. What not to touch. What must stay backwards-compatible. What's out of
scope.

## What I need back

1. Specific question one.
2. Specific question two.
```

There is deliberately no `mode` field. How far Claude Code is allowed to go —
read-only planning versus editing files — is set in the desktop app's own mode
selector, at the moment of the run, by the person watching it. Encoding it a second
time in the prompt file would just create a second source of truth that can disagree
with the first.

The consequence: **the prompt file does not constrain what a run can touch.** If a
prompt should not modify anything, say so in its **Constraints** section and set the
app to a read-only mode before running it.

## Report format

Written by Claude Code into `_cowork/outbox/`, following
`.claude/bridge/REPORT_TEMPLATE.md`.

The reader has **no access to this repository**. Everything a report asserts has to
stand on its own:

- Cite locations as `path/to/file.py:123`. Never "the file I edited" or "as above".
- Numbers, not adjectives. "37 of 412 configurations survived" beats "most were
  filtered out".
- Distinguish measured from estimated. A planning session cannot tell them apart
  and will happily build three prompts on top of a guess.
- List output artifacts by path — plots, CSVs, geometry. In this project the real
  output of a run is often an image or a mesh, and Cowork can read files it's told
  about.

## Searching past work

Because the bridge is committed, `Grep` finds it normally — searching for a past
decision across `_cowork/outbox/` just works.

The one exception is `_cowork/CONTEXT.md`, which **is** gitignored. Claude Code's
`Grep` respects `.gitignore`, so a repo-root search will never match anything in it —
not an error, just zero results, which reads identically to "never mentioned". Read
that file directly rather than searching for its contents.

The same trap applies to everything under `_cowork/` if the working directories are
ever added to `.gitignore`. If that happens, search them by explicit path:
`Grep pattern="adjacency" path="_cowork/outbox"`. `Glob` is unaffected either way.

## Why this is committed

`done/` plus `outbox/` is a complete chronological record of how the work developed:
every instruction, every deviation, every decision and its rationale, each tied to
the commit it applied to.

For a thesis *about* computational design methodology, that is source material
rather than a byproduct — a defensible account of how the artifact was actually
produced, rather than a reconstruction written afterwards. It cannot be recovered
later, which is why it is on by default rather than opt-in.

The cost is commit noise: prompts and reports show up in `git status` alongside code
changes. If that becomes intolerable, adding `_cowork/inbox/`, `_cowork/outbox/`,
`_cowork/done/` and `_cowork/LOG.md` to `.gitignore` as individual lines turns it off
without moving anything. Everything already committed stays in history.
