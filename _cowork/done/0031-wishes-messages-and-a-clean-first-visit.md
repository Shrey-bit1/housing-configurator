---
id: "0031"
title: The store carries the wishes and the group's messages, and a first visit starts empty
created: 2026-09-04
---

## Context

Three things a resident does in the building app have nowhere to live in this
app's store, so they either sit in one browser or do not exist.

The first is the three wishes about a resident's own flat: a corner flat, near a
terrace, away from the noise. Run 0057 of the building app put them on the
Wishes screen and recorded them in `localStorage`, because the store has no
field for them. Nothing reads them. Shrey wants them to become real, which means
the packer has to score them, which means they have to reach the packer, which
means they have to travel through here first. This run carries them. The scoring
is the building app's next run and is not this run's business.

The second is the group's chat. The group screen has a line along the bottom
that a resident cannot type into, because there is nothing to type into: the
store holds flats, residents and a building, and no messages. Five people in a
room for the user test will want to say something to each other while the
building changes, so the store gains a small append-only list of messages.

The third is smaller and is about this app's own landing. It pre-fills the group
code and the resident's name from `localStorage` every time, so a person who has
never used it cannot tell the difference between a field with their name in it
and a field with somebody else's. A first visit should be empty. A return visit
should say plainly that it is picking up where the resident left off.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability`, because two of these three are the seam between the apps and
the question is what one side may assume about the other. `design-automation`
for the landing, where "has this person been here before" is one rule read in
three places. Report which you read, what each contributed, and anything
rejected with the reason. Reference, not instruction.

## Assumptions

Check rather than trust, contradict rather than work around. Where the prompt is
silent, choose sensibly, keep going, and record the choice.

1. Run 0030 landed on `run/0029` and added `shareM2` and `extraM2` to
   `Resident` in `src/session/store.ts`, with `parseResidentPatch` checking each
   key it accepts. This run follows exactly that pattern, so read run 0030's
   five commits first and copy their shape rather than inventing a second one.
2. `sessionView` spreads a resident record whole, so a field added to the record
   reaches `GET /api/session/{code}` and `/export` with no further change. Run
   0030 verified this. Verify it again for the message list, which is not a
   resident field and may need naming.
3. The landing is `showLanding` in `src/main.ts` around line 1291, and the two
   pre-filled fields are `landingCode.value = session.code` and
   `landingName.value = session.resident` at lines 1299 and 1300.
4. `docs/store.md` is the contract's source of truth: the call table around
   line 61 and the residents section at 203.

## Tasks

1. The wishes on a resident, commit `store: the resident carries three wishes`.
   `Resident` gains `wishes: { corner: boolean; terrace: boolean; quiet: boolean } | null`,
   null when never answered. `parseResidentPatch` accepts the key when present
   and checks it whole: null passes, or an object whose three keys are all
   present and all booleans; anything else is a `400` in the shape of the
   messages beside it. Partial objects are refused rather than merged, because a
   wish that is absent and a wish that is false are the same thing to whoever
   reads them and letting them differ here would invent a third state.

2. The group's messages, commit `store: the group can say something`.
   `POST /api/session/{code}/messages` takes `{ who, text }` and appends
   `{ who, text, at }` with the store's own timestamp. `who` is 1 to 64
   printable characters, matched with the same loose rule run 0026 gave resident
   names. `text` is 1 to 500 characters, stored exactly as sent and never
   interpreted. The list is capped at the last 200 messages, oldest dropped, so
   a long session cannot grow the index without bound. `GET /api/session/{code}`
   returns them under `messages`, oldest first. There is no edit and no delete;
   the point is a record of what a group said while it decided something, and
   this run does not build moderation.

3. The document, commit `docs: wishes and messages`. The call table gains the
   messages row and lists `wishes` among the resident's keys. The residents
   section gains a bullet for `wishes` saying what the three mean in words. A
   new short section for messages gives the request, the response, the cap and
   the fact that the text is stored verbatim. Both worked examples updated.

4. The round trip, commit `store: the round trip proves the new two`. In
   `scripts/store-roundtrip.mjs`: Ana's `PUT` carries `wishes`, Ben's carries
   none so the null default is exercised, two messages are posted by different
   people, and all of it is read back in the polled state and the export. Print
   each raw.

5. A first visit is empty, commit `ui: a first visit starts empty`. The landing
   fills the code and name only when this browser has actually used them before,
   which is one function, and when it does it says so in one short sentence
   under the fields, in the brief's voice, so the resident knows the app is
   picking up where they left off rather than guessing at them. A first visit
   shows two empty fields and no sentence. Whatever that function is called, it
   is the only place that decides it.

6. Tests, commit `store: tests for 0031`. `wishes`: the null default; a full
   object accepted; a partial object refused; a non-boolean refused; it survives
   the export. Messages: append and order; the timestamp is the store's; `who`
   and `text` at their limits and past them; the 200 cap dropping the oldest;
   a message list on a group that has none reads as empty rather than missing.
   The landing rule on the cases: never used, used before, code but no name.
   Existing suites green, both fixture baselines still 12 and 7, the three
   downloads byte-identical.

7. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0031-wishes-messages-and-a-clean-first-visit.report.md`,
   prompt moved to done/, one LOG row.

All seven tasks land. There is no short version of this run. If it is long, it
is long; keep going until every task is done and the report answers every point.

## Constraints

- A new branch `run/0031` from `main`, and never a commit on main. If `main`
  does not yet carry runs 0029 and 0030, stop and report; merging is Shrey's
  call.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and both
  fixtures stay untouched. The three downloads stay byte-identical.
- The store contract changes only by the `wishes` field and the messages route.
- The editor, its tools and its validation are not touched.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on `main`.
2. A resident with `wishes` read back three ways, each pasted whole: the `PUT`
   echo, the polled state, the export.
3. The refusals for `wishes`, each with its status and message.
4. Two messages posted and read back, pasted whole, and the cap proved by
   posting past 200 and showing which one fell off.
5. The round-trip script's output, raw.
6. The landing on a browser that has never used it and on one that has, described
   field by field, with the sentence quoted.
7. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
8. Which skills you read from disk, what each contributed, anything rejected.
9. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
