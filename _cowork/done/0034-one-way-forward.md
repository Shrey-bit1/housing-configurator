---
id: "0034"
title: One way forward, and the landing arrives in order
created: 2026-09-06
---

## Context

The flat app has two steps in its bar, 01 Draw your flat and 02 Send it to
your group. Getting from the first to the second means noticing the bar and
clicking a number. A resident who has just finished drawing should be handed
onward, the way the building app now hands a resident from every step to the
next (its run 0059). Shrey wants the same idea here.

Two more things landed on the same day and belong with it, because they are
the same idea seen from the landing: a person should always know what to read
first and where to go next. Both are settled in the design brief, in the
section "The screens", under the landing. The Context copy of the brief is
newer than this repository's copy; task 0 brings it across.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`design-automation`, for "is this flat ready to send", which is one rule already
answered somewhere for the bar's step 02 and must be the same rule here. Report
which you read, what each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. Step 02 in the bar wakes when the flat has a way in, decided by one rule
   since run 0027. Find it and name it.
2. Step 01 has no button that leads to step 02. The palette is at the left,
   the drawing fills the rest, the numbers strip and the check chip sit in the
   bar.
3. The button shape is in `src/style.css` from run 0026: a red block, display
   type, an arrow at the right edge that nudges.

## Tasks

0. The brief comes across, commit `design: the brief as of 6 September`. Copy
   `DESIGN-BRIEF-3sep.md` from the Context folder
   (`D:\\_Studies\\_DFAB\\DFAB\\_T3\\Context\\01-design\\`) over
   `_cowork/design/DESIGN-BRIEF-3sep.md` in this repository, byte for byte.
   Read its landing paragraphs before tasks 3 and 4.

1. One way forward, commit `ui: one way forward`. Step 01 ends with one clear
   button that takes the resident to step 02. It says where it goes in words,
   "Send it to your group", not "next". It sits where a resident's eye lands
   when they have finished drawing, and it does not cover the drawing or the
   palette. It is asleep, with one short sentence saying why, while the flat is
   not ready, and it wakes by the same rule that wakes step 02 in the bar. There
   is one such button on the screen and nothing else that sends.

2. Step 02 hands you on as well, commit `ui: and then to the group`. After a
   flat has been sent, the one red button on step 02 becomes the way to the
   group: it reads "Go to your group" and opens the building app on this
   resident's group, which is the link run 0027 put on the landing. Before the
   send it is the send button, as it is now. One button, two moments, never two
   buttons.

3. The six dots know which app they are in, commit `ui: the journey knows
   where it is`. The strip keeps all six dots. The two that belong to this app
   (draw your flat, send it) are ink. The four that belong to the building app
   are dim. The dot for where the resident is now is red. Exactly as the brief
   says, and the building app does the mirror image in its own run.

4. The landing arrives in order, commit `ui: the landing arrives`. As the brief
   says: nothing for about a second; then the yellow disc grows out of its
   top-left corner and the blue disc out of its bottom-right, together, about
   0.6 s; then the headline one line at a time, about 150 ms apart; then the
   paragraph; then the doors rising one after another, about 100 ms apart; then
   the journey strip. All CSS, and honest in a hidden tab: nothing ends up
   missing if the animation never ran. The rest of the app does not wait for
   it; a person who clicks a door mid-arrival gets the door. Say in the report
   the exact delays you chose, so the building app can copy them.

5. Tests, commit `ui: tests for 0034`. The readiness rule as a pure function on
   the cases: nothing drawn, drawn with no way in, drawn with a way in. That the
   bar's step 02 and the button wake on the same call. That step 02's button
   reads the send text before a send and the group text after. Existing suites
   green, both fixture baselines still 12 and 7, the three downloads
   byte-identical.

6. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0034-one-way-forward.report.md`, prompt moved to done/, one
   LOG row.

All seven tasks land, task 0 included. There is no short version of this run.

## Constraints

- A new branch `run/0034` from `main`, and never a commit on main.
- The editor, its tools and its validation are not touched. Only the chrome.
- The `dwelling-unit` format, the rules and both fixtures stay untouched. The
  three downloads stay byte-identical. The store contract does not change.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.
- Every sentence on a screen follows "How the app talks" in
  `_cowork/design/DESIGN-BRIEF-3sep.md`.

## What I need back

1. Every commit hash with one-line stats and the branch state found on `main`.
2. The readiness rule: where it lives, and proof the bar and the button read
   the same one.
3. Step 01 with the button asleep and awake, and step 02 before and after a
   send, as captures if the environment writes them, else described element by
   element with every sentence quoted.
4. The landing's arrival: every delay and duration you chose, in one table, so
   the building app copies them exactly. And the six dots with their three
   colours named.
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
