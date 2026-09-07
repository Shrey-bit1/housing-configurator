---
id: "0038"
title: A full group in one command, and the faults under the button
created: 2026-09-07
---

## Context

Shrey wants to see the whole journey run end to end: a group with twenty
residents already in it, each with a flat, wishes and a ballot, so that he can
join as the twenty-first with his own flat and go through every step to the
vote. Sending twenty flats by hand is not that. One command should fill a
group.

And one line from run 0036's own open question: the button says "Send anyway ·
2 things to look at" and the two things are behind the check chip in another
corner of the screen. A resident who reads the button has sent a flat with
faults they never saw. The faults go under the button, one short line each.
The rules are advisory, so this never blocks a send; it only says.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability` for the seeding script, which writes through the store's
public calls and nothing else, so what it writes is what a real resident would
have written. Report which you read, what each contributed, and anything
rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. The store's calls are all in `docs/store.md`: `POST` to start a group,
   `PUT` a flat with `?resident=`, `PUT` a flat's preview, `PUT` a resident's
   answers (`shareM2`, `extraM2`, `ballot`, `wishes`), `POST` a message.
   `scripts/store-roundtrip.mjs` already drives every one of them.
2. The library holds thirty flats, Flat 1 to Flat 30, with `unit-8` to
   `unit-27` being the twenty designed ones and each having a preview JPEG
   beside it under `public/units/`.
3. The button's count comes from the same variable the check chip prints,
   `src/main.ts:1279`, and `sendButton` in `src/core/flatState.ts` answers the
   label. The faults themselves are what the check chip's report lists.

## Tasks

1. One command fills a group, commit `scripts: a full group in one command`.
   `scripts/fill-group.mjs <store> <code>` starts the group if it does not
   exist, then for each of the twenty designed flats publishes it under a
   different resident name, with its preview, and writes that resident's
   answers: a square-metre figure between 3 and 12, a ballot in some order of
   the five shared spaces, and the three wishes set some way. Spread the
   answers so the group looks like twenty people and not one person twenty
   times: a fixed table in the script, not random, so two runs give the same
   group. Names are ordinary first names, no two alike. Two or three messages
   in the chat from different people, so the room is not silent. Print each
   call's response on one line and end with the polled state's head count and
   flat count. Refuse to run against a group that already holds flats unless
   `--replace` is given, so it cannot trample a live room by accident.

2. Written down, commit `docs: how to fill a group`. Three lines in the
   README under "How to run it": the command, what it makes, and that Shrey
   then joins the same code from the landing as the twenty-first.

3. The faults under the button, commit `ui: the things to look at, named`.
   When the button reads "Send anyway · N things to look at", the N faults
   are listed under it, one short line each in the rule's own words, in the
   muted ink. They come from the same report the check chip opens, so the two
   cannot differ. Nothing about the button's behaviour changes; it still
   sends.

4. Tests, commit `ui: tests for 0038`. The script's table: twenty distinct
   names, twenty distinct flat ids, every answer inside the slider's range,
   every ballot a permutation of the five. The refusal without `--replace`.
   The faults list: absent at zero, N lines at N, the same N the button
   shows. Existing suites green, both fixture baselines still 12 and 7, the
   three downloads byte-identical.

5. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0038-a-full-group-in-one-command.report.md`, prompt moved
   to done/, one LOG row.

All five tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0038` from `main`, and never a commit on main. If this
  prompt is being done inside a run already in progress, stay on that run's
  branch, give this work its own commits, its own report and its own LOG row,
  and say so.
- The script writes only through the store's public calls. It never touches
  the store's files or the index directly.
- Run it against the local store at `http://localhost:8888` on a throwaway
  code for the evidence. Never against `review-0023`.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched. The
  three downloads stay byte-identical. The store contract does not change.
- No new dependencies. Never stage with `git add -A`.

## What I need back

1. Every commit hash with one-line stats and the branch state found.
2. The script's full output on a throwaway group, raw, and the polled state's
   head count and flat count at the end.
3. The refusal without `--replace`, quoted.
4. The button with its faults listed, as a capture or described with every
   line quoted, on a flat that has at least two.
5. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
6. Which skills you read from disk, what each contributed, anything rejected.
7. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
