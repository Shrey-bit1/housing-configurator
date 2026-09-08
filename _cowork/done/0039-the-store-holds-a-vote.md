---
id: "0039"
title: The store holds a vote
created: 2026-09-07
---

## Context

The vote is settled in the design brief under "The vote chooses the
building" (`_cowork/design/DESIGN-BRIEF-3sep.md`; the Context copy is newer
and task 0 brings it across). Read that section first. In short: rounds of
pairs, a resident picks one building of each pair and ticks reasons, a round
closes when everyone has voted, three quarters agreeing ends it, and the
reasons ticked become the weights the search builds by.

None of that has anywhere to live. The store holds one building, no rounds
and no votes. This run gives it room. The building app's run 0063 builds the
screens and the counting on top of it.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability`, because the building app is the only caller and what it
may assume is the whole question, and because two clients may try to open
the same round at once. Report which you read, what each contributed, and
anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. The store's index holds `flats`, `residents`, `building`, `messages`,
   `startedAt`. `building` is one run, `{genome, summary, by, at, plot}`,
   from runs 0022 and 0026.
2. "Who is in the group" is the rule from the building app's run 0059: a
   person who joined or who owns a flat. The store can compute it from its
   own index.
3. Every write goes through `updateIndex`, which retries under an ETag, so
   a guard inside the mutate is safe against two writers.

## Tasks

0. The brief comes across, commit `design: the brief as of 7 September`.
   Copy `DESIGN-BRIEF-3sep.md` from `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\`
   over `_cowork/design/DESIGN-BRIEF-3sep.md`, byte for byte.

1. A round, commit `store: a round of pairs`. `PUT /api/session/{code}/round`
   opens a round: `{ n, pairs: [{ id, a, b, dial, sentence }], weights }`
   where `a` and `b` each carry `{ genome, plot, summary }`, `dial` is one
   of the five reason words, `sentence` is the line naming the difference,
   and `weights` is the five numbers the round was built with. `n` must be
   one more than the last round's `n` (or 1); any other `n` is `409`, so two
   clients racing to open the same round cannot both win. A round is stored
   whole with `openedAt`, and `GET /api/session/{code}` returns the open
   round under `round` and the last closed one under `lastRound`. The
   history of closed rounds is kept under `rounds` in `/export` only.

2. A vote, commit `store: one vote per person per pair`.
   `POST /api/session/{code}/rounds/{n}/votes` with
   `{ who, pair, pick, reasons }`: `pick` is `"a"` or `"b"`, `reasons` is a
   list of the five words, any of them, possibly empty. One vote per person
   per pair; a second one replaces the first while the round is open.
   `who` must be in the group by the store's own reading of the room rule;
   anyone else is `403`. A vote on a closed round is `409`. The open round
   in `GET` carries, per pair, how many have voted and how many are
   expected, and every vote so far, so a client can count.

3. The round closes, commit `store: the round closes when everyone has
   voted`. When the last expected vote on the last pair arrives, the store
   marks the round closed with `closedAt` in the same write. Only the
   store closes a round. A client may also `POST .../rounds/{n}/close` to
   close it by hand, which stays for the day a rule for an absent person
   arrives; document it as that.

4. The reasons, commit `store: the five reasons`. The five words, copied
   from the brief's vote section, live in one constant and are the only
   ones the store accepts: privacy, shared space, cost, light, short walks.
   Anything else is `400`.

5. The document, commit `docs: rounds and votes`. Three new rows in the
   call table, one section for the round, one for the vote, one for the
   close, the room rule as the store reads it, and the shape of `round` and
   `lastRound` in the polled state with an example.

6. The round trip, commit `store: the round trip votes`. Open a round with
   two pairs, vote as every person in the group, watch it close on the last
   vote, try a vote after and get `409`, try to open round 2 with `n: 4`
   and get `409`. Print each raw.

7. Tests, commit `store: tests for 0039`. Opening with the wrong `n`;
   opening twice; a vote from a stranger; a vote replacing a vote; the
   close firing on the last expected vote and not before; a vote on a
   closed round; a reason outside the five; the polled state's `round`
   and `lastRound`; `/export` carrying every round. Existing suites green,
   both fixture baselines still 12 and 7, the three downloads byte-identical.

8. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0039-the-store-holds-a-vote.report.md`, prompt moved to
   done/, one LOG row.

All nine tasks land, task 0 included. There is no short version of this run.

## Constraints

- A new branch `run/0039` from `main`. If `main` does not carry runs 0037
  and 0038, stop and report.
- The store contract changes only by the round, the vote, the close and
  the five reasons. `building` keeps its shape; the building app still
  reads it as the current building.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched.
  The three downloads stay byte-identical. The editor is not touched.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. A round opened, voted to a close, and the state after, pasted whole.
3. Every refusal, with status and message.
4. The round-trip script's output, raw.
5. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
6. Which skills you read from disk, what each contributed, anything rejected.
7. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
