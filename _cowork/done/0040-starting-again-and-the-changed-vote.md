---
id: "0040"
title: Starting again, and the vote a person changed
created: 2026-09-08
---

## Context

Two small things, both from reading run 0039's report with Shrey on
8 September.

The first is the landing. When this browser has a flat and a name in it, the
first door reads "Back to your flat" and the fields are filled, which run
0031 and run 0027 built and which is right. What is missing is the other way
out. A person who wants to draw a new flat from nothing, on the same laptop,
has no written way to say so. They can only draw over the old one. There
should be one quiet written line under the doors that starts them again.
The brief's landing paragraphs now say so (task 0 brings the brief across).

The second is the vote. Run 0039 lets a second vote replace the first, which
is right for the count. It also throws the first away, and its report points
out that "eight people changed their minds after seeing the count" is a
finding the thesis would want and the store now makes unrecoverable. Keep
the earlier votes. The count does not change.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`interoperability` for the shape of the kept votes, since the building app
counts from `votes` and must not have to change. Report which you read, what
each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. The flat on this browser lives under `reconfigure.draft`
   (`src/core/draft.ts`) and the code and name under `reconfigure.session`
   (`src/session/session.ts`). Those two keys are all the landing reads
   to decide between a first visit and a return visit.
2. `showLanding()` in `src/main.ts` sets the first door's label from
   `isEmptyProject()` and the fields from `landingRecall()`. Nothing else
   decides what the landing shows.
3. A round's `votes` holds one entry per person per pair, the current one,
   and the building app's run 0064 will count from it.

## Tasks

0. The brief comes across, commit `design: the brief as of 8 September`.
   Copy `DESIGN-BRIEF-3sep.md` from `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\`
   over `_cowork/design/DESIGN-BRIEF-3sep.md`, byte for byte. Its landing
   paragraphs and its vote section each gained a few lines for this run.

1. The written line, commit `landing: start again with a new flat`. Under
   the doors, one line of text in the brief's voice, "Start again with a
   new flat.", shown only when the browser remembers something: a flat, a
   code, a name, or any of them. On a true first visit it is not there. It
   is text with a link's cursor, in the landing's own style, quieter than a
   door. It lives in the flat app's own markup around the shared landing
   fragment, not inside `landing.html`, so the shared file and its
   fingerprint stay as they are. If that turns out to be impossible, stop
   and say so rather than changing the shared file.

2. What it does, commit `landing: forgetting this browser`. One press opens
   one plain question, the app's usual confirm: "This forgets the flat and
   the name on this browser. The flat you sent stays in your group. Start
   again?" Yes clears the draft and the session keys, empties the editor to
   one floor with nothing on it, and shows the landing as a first visit: two
   empty fields, no sentence under them, the first door reading "Start a
   flat", the written line gone. No wins nothing. Nothing is sent to the
   store; the flat in the group is untouched. One function decides what
   "forget this browser" clears, and it is the only place. The same
   forgetting runs, with no question asked, when the address carries
   `?fresh` (`http://localhost:8888/?fresh`), and the address is cleaned
   after so a reload does not forget again. It is for the operator, who
   restarts often; the report shows it once.

3. The kept votes, commit `store: a changed vote is kept`. When a vote
   replaces one, the replaced vote goes into `replaced` on the round, a
   list oldest first, each entry the vote as it was with its `at`. `votes`
   keeps its meaning and shape, one current vote per person per pair, so a
   client counting from it sees no change. The polled state's `round`
   carries `replaced` too, so a screen may say "3 people changed their
   minds" if it wants to. `/export` carries it in every round.

4. The document, commit `docs: the changed vote`. One paragraph in the vote
   section of `docs/store.md` and the field in the round's shape and
   example.

5. The round trip, commit `store: the round trip changes a vote`. In
   section 9, after Ana's second vote on `p1`, read the round back and show
   `votes` holding one vote for Ana on `p1` and `replaced` holding her
   first, with both timestamps. Print raw.

6. Tests, commit `tests for 0040`. The landing: the line present when a
   draft is remembered, when only a code is, when only a name is; absent on
   a first visit; after forgetting, both keys gone and `landingRecall`
   giving the first-visit answer; `?fresh` clearing the same two keys and
   leaving a clean address. The store: a replaced vote lands in
   `replaced` with its original `at`; a first vote leaves `replaced` empty;
   two replacements on the same pair keep both in order; `votes` still
   counts one per person per pair; the close still fires on the last
   expected vote and a replacement does not fire it early; `/export`
   carries `replaced`. Existing suites green, both fixture baselines still
   12 and 7, the three downloads byte-identical, the landing fingerprint
   test still passing.

7. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0040-starting-again-and-the-changed-vote.report.md`,
   prompt moved to done/, one LOG row.

All eight tasks land, task 0 included. There is no short version of this run.

## Constraints

- A new branch `run/0040` from `main`. If `main` does not carry run 0039,
  stop and report.
- The shared landing files and their fingerprint are not touched.
- The store contract changes only by `replaced`. `votes`, the close and the
  refusals stay exactly as run 0039 left them.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched.
  The three downloads stay byte-identical.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on
   `main`.
2. Two pictures of the landing at 1440 by 900, `0040-remembered.png` with
   the written line and `0040-first-visit.png` after forgetting, in the
   outbox.
3. The confirm's wording as shown, what exactly one function clears, and
   `?fresh` shown once.
4. The round after a replaced vote, pasted whole.
5. The round-trip script's output, raw.
6. Test counts before and after, both fixture baselines, the three download
   checks, the fingerprint test, `tsc` clean.
7. Which skills you read from disk, what each contributed, anything rejected.
8. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
