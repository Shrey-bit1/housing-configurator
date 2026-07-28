---
name: bridge
description: Show the state of the Cowork bridge — what prompts are queued, what the last report was, and whether anything is inconsistent
allowed-tools: Read, Glob, Grep
---

# Bridge status

Use Glob to list the `.md` files in `_cowork/inbox/`, `_cowork/outbox/` and
`_cowork/done/` — only `.md`, ignore anything else in those directories. Read the
tail of `_cowork/LOG.md`.

Report in **under 10 lines total**:

- **Queued:** each file in `_cowork/inbox/` as `id — title`, oldest first.
  If empty, `Queued: nothing`.
- **Last report:** filename and status of the most recent row in `_cowork/LOG.md`.
- **Total exchanges:** number of rows in the log.
- **Anything odd**, checking all of these:
  - an id present in **both** `inbox/` and `outbox/` — a failed move, and `/next`
    will refuse to re-run it until it's cleared
  - the same id appearing twice in `outbox/`, or twice in `LOG.md`
  - a report in `outbox/` with no matching log row, or a log row whose report file
    is missing
  - an inbox file with no front matter, or with no `id:`
  - a prompt whose `created:` date is more than a few days old and still sitting in
    `inbox/` — skip this check for any file with no `created:` field

  If all clear: `Nothing odd.`

No preamble, no closing offer to help. Just the status.
