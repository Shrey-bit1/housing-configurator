---
id: "0037"
title: One landing for both apps
created: 2026-09-07
---

## Context

The two apps are meant to have the same landing: same headline, same three
lines, same two discs, same journey strip, only the doors differ. They do not.
Shrey put the two side by side on 7 September: the doors sit at the far right
edge in this app and in the middle in the building app, the columns are
different widths, and this app has a brand and a red rule the other lacks. Both
were written from the same paragraph of the brief, and a paragraph leaves room.

The fix is one file rather than one description. The landing becomes a single
shared fragment that both apps render from, byte for byte, with one switch that
picks the doors and the dot tones. It lives in the Context folder beside the
brief, the way the brief does, and each app carries a copy that a test
fingerprints against the recorded one. To change the landing you change the
shared file and the next run in each app copies it in.

This run makes the fragment, from this app's landing, and moves this app onto
it. The building app's run 0062 copies it in.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.
`design-automation` for the switch, which is one rule over one attribute and
must not become two files. `interoperability` for the fingerprint, because
this is a contract between two repositories and the question is what each may
assume. Report which you read, what each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around.

1. This app's landing is `#landing` in `index.html` from run 0027, with the
   arrival CSS at `src/style.css:2959-3033` from run 0034 and the three-tone
   dots from `src/core/journey.ts`.
2. The building app's landing has three doors: Join a group, Open a building,
   Look at the example. This app's has four and an aside line: Start a flat,
   Start a group, Join a group, Open a file, and "Already sent your flat? Go to
   your group".
3. The brief's landing paragraphs, in `_cowork/design/DESIGN-BRIEF-3sep.md`
   under "The screens", are the authority on what the landing holds and how it
   arrives. Run 0034's report holds the eleven delays.
4. Both apps use the same fonts, the same six colours and the same paper.

## Tasks

1. The fragment, commit `landing: one file for both apps`. Two files,
   `landing.html` and `landing.css`, self-contained: the markup for the
   headline, the three lines, the two discs, the brand and the credit line,
   the red rule, all seven doors and the aside line, and the journey strip
   with its six dots; and every style they need including the arrival, with
   nothing depending on either app's other CSS. One attribute on the root,
   `data-app="flat"` or `data-app="building"`, decides which doors show and
   which dots read ink and which dim. No other difference between the two
   apps is allowed in the file. Every door carries a stable id so each app can
   wire its own handlers without touching the markup.

2. Written to Context, commit `landing: the shared copy`. The two files go to
   `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\` and, byte for byte,
   to `_cowork/design/landing/` in this repository. A short `README.md` beside
   them says what the switch does, that the Context copy is the source, and
   that a change goes there first. The brief's landing paragraphs gain one
   sentence pointing at the file.

3. This app renders from the copy, commit `ui: the landing is the shared one`.
   The hand-written landing in `index.html` and its styles in `src/style.css`
   are removed. The app loads `_cowork/design/landing/landing.html` and
   `landing.css` at build time, sets `data-app="flat"`, and wires its handlers
   to the door ids. The arrival, the dots, the doors and the aside all behave
   as they did after run 0034; the delays are the same eleven numbers.

4. The fingerprint, commit `landing: it cannot drift`. A test reads the two
   files in `_cowork/design/landing/` and compares their hash to one recorded
   in the brief, in a line the building app's test reads too. If the copy is
   edited by hand the test fails and says the landing has drifted from the
   shared one. Record the hash in the brief in this run.

5. Tests, commit `ui: tests for 0037`. The switch: with `data-app="flat"` the
   four doors and the aside are visible and the three building doors are not,
   and the reverse; the dot tones under both. The fingerprint test. Existing
   suites green, both fixture baselines still 12 and 7, the three downloads
   byte-identical.

6. A picture, commit `landing: what it looks like`. The landing at 1440 by
   900, finished, as `_cowork/outbox/0037-landing.png`. The building app's run
   0062 will photograph its own at the same size and the two are compared side
   by side there.

7. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0037-one-landing-for-both-apps.report.md`, prompt moved to
   done/, one LOG row.

All seven tasks land. There is no short version of this run.

## Constraints

- A new branch `run/0037` from `main`. If `main` does not carry run 0036, stop
  and report.
- The fragment uses only the six colours, the three fonts and the paper the
  brief names. No colour, font or rule outside it.
- The editor, its tools and its validation are not touched. The store contract
  does not change.
- No new dependencies. Never stage with `git add -A`. Commit before opening a
  file a second time.

## What I need back

1. Every commit hash with one-line stats and the branch state found on `main`.
2. The two files' sizes and hashes, and the line in the brief that records
   them.
3. The eleven delays read back from computed styles on the shared landing,
   beside run 0034's table.
4. What the switch shows under each value, listed door by door and dot by dot.
5. The picture.
6. Test counts before and after, both fixture baselines, the three download
   checks, `tsc` clean.
7. Which skills you read from disk, what each contributed, anything rejected.
8. Contradictions with the Assumptions, then your own assumptions with their
   effects.

The report follows the writing rules: short sentences, plain words, connected
prose that carries its own logic, no em dashes as glue, no contrast
constructions, neutral voice, prose before any list or table, every number
exact, and every claim names its evidence. The reader has no access to this
repo, so cite paths and line numbers.
