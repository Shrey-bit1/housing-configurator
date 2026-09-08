---
id: "0041"
title: The group votes in one command
created: 2026-09-08
---

## Context

Run 0038's `scripts/fill-group.mjs` fills a group with twenty people so
Shrey can walk the journey as the twenty-first. On 8 September he reached
the vote and the twenty never voted, because nothing makes them. A round
waits for everyone, so a walked vote can only be closed by hand and the
count reads "1 of 1". The presentation needs a real count.

This run adds the second half of the script: the twenty cast their votes
on the open round, through the store's public calls only, so what they
write cannot be told from twenty real residents.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability` for the store's vote call as the only way in. Report
which you read, what each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. The store's vote is `POST /api/session/{code}/rounds/{n}/votes` with
   `{ who, pair, pick, reasons }` (run 0039), the open round is `round`
   in `GET /api/session/{code}` with its pairs, and the round closes on
   the last expected vote.
2. The twenty are the fixed table in `scripts/fillGroupTable.mjs`, each
   with a ballot and wishes.

## Tasks

1. The votes, commit `script: the group votes`.
   `node scripts/vote-group.mjs http://localhost:8888 walk-08` reads the
   open round, and for each of the twenty in the table casts one vote per
   pair. The pick and the reasons come from the person's own table row,
   by one stated rule that makes the vote look like a room rather than a
   coin: a person whose ballot ranks the pair's dial high picks the
   challenger and ticks that reason; others pick the building they had
   and tick their own top reason; a fixed few, named in the table,
   always change their mind once (vote, then vote again), so `replaced`
   from run 0040 has something in it. Print one line per vote with the
   store's status, and the round's `closedAt` if the last one closed it.
   `--round n` votes on a closed round's successor if needed; without it
   the open round.

2. Refusals, commit `script: the votes refuse what the store refuses`. No
   open round: say so and exit 2. A person not in the group: report the
   store's answer and go on. Through `netlify dev` the store's 403 arrives
   as a 404 (run 0039's report); the script says which it saw.

3. Tests, commit `tests for 0041`. The pick rule over the table for a
   round of five pairs, as a pure function; the change-of-mind list; the
   exit codes. Existing suites green, both fixture baselines still 12 and
   7, the three downloads byte-identical.

4. The document, commit `docs: the vote script`. One paragraph in
   `docs/store.md` beside the fill script's, with the command.

5. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0041-the-group-votes-in-one-command.report.md`, prompt
   moved to done/, one LOG row.

All five tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0041` from `main`. If `main` does not carry run 0040,
  stop and report.
- The store is not changed. The script writes through public calls only.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. The pick rule in one paragraph and the table of who picks what on a
   sample round.
3. The script's output on a real round, raw, with the close.
4. Test counts before and after, both fixture baselines, the three
   download checks, `tsc` clean.
5. Which skills you read from disk, what each contributed, anything
   rejected.
6. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
