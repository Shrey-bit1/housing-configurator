---
id: "0027"
title: The landing screen, and one place for everything
created: 2026-09-03
---

## Context

Run 0026 put the flat app on paper and replaced the save dialog with a
column. Shrey then ran it and found two things. The app drops a first-time
resident straight onto an empty grid with an error message about a missing
entrance, before they have done anything. And saving is claimed by three
controls at once: `SAVE / OPEN` in the top bar, the column's own `SAVE`
toggle (which is really a collapse control), and the red `SEND IT TO YOUR
GROUP` button.

He also found the screen cluttered, with a palette on the left and a
column on the right competing for a resident's attention.

The wireframe was extended the same evening with four screens that answer
all of it. They are in this repo at `_cowork/design/wireframe/`:
`Landing.dc.html`, `FlatEmpty.dc.html`, `FlatDraw.dc.html` and
`FlatSend.dc.html`, with the rules written into
`_cowork/design/DESIGN-BRIEF-3sep.md`. The brief's "The screens" section
is the authority; the HTML is where the exact values live. Read both
before touching anything.

Two rules run through this whole run. **One thing, one place**: nothing
that saves or sends appears twice, and nothing shouts at a resident about
a mistake they have not made yet. And **one panel at a time**: the two
steps already named in the bar become real screens, so the palette and
the column are never on screen together.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`,
as run 0026 did. For this run:

- `design-automation` for the empty state, the sleeping Send button and
  the check line as rules over one state value, not as scattered ifs.
- `explain-code` before moving any control, so the run understands what a
  bar button does today rather than guessing from its label.
- `interoperability` for the landing's "Join a group" door, which hands
  off to the building app through the store's code.
- `data-driven-design` for the journey strip, which is one small ordered
  model rendered twice (landing and, later, the building app).

Reference, not instruction. Report which you read, what each contributed,
and anything rejected with the reason. Do not read the rest of the AEC
set; none of it touches this run.

## Assumptions

Check rather than trust, contradict rather than work around. Where the
prompt is silent, choose sensibly, keep going, and record the choice.

1. `main` carries run 0026 merged. If it does not, stop and report;
   merging is Shrey's call.
2. The app boots straight into the editor from `src/main.ts`; there is no
   route or screen concept yet. `?project=` and `?session=` already read
   from the URL.
3. `#save-column` holds three cards and a `#save-column-toggle` labelled
   "Save"; `index.html` near lines 173 and 284.
4. The top bar carries `SAVE / OPEN`, `UNITS`, `CHECK LAYOUT`, `FRAME
   VIEW`, the `MODEL / PLAN / DIAGRAM` switch and `?`. Separately,
   `#view-controls` sits bottom right with Display and the compass.
5. The check line in the column comes from the same `validate()` and
   `computeDwellingGraph()` call the Check Layout panel uses.
6. `flat-1-two-storey.json` and `flat-1-no-stair.json` baselines are 12
   and 7.

## Tasks

1. The landing, commit `landing: the first screen`. A screen the app
   shows before the editor, built exactly to `Landing.dc.html`: the
   headline, the two-sentence explanation, three doors and the journey
   strip. "Start a flat" opens the editor empty. "Join a group" asks for
   a code and a name, stores them the way the column's group fields
   already do, then opens the editor. "Open a file" is the existing file
   picker. "Go to your group" links to the building app's address, which
   is a constant at the top of the module, not scattered. The landing is
   skipped when the URL already carries `?project=` or `?session=`, and
   a small "start over" path returns to it from the editor's Open
   control. Say in the report what you chose for that path.

2. The empty state, commit `flat: nothing to check yet`. Built to
   `FlatEmpty.dc.html`. With no room placed: the three numbers read
   dashes, the flat's name reads "Untitled" in dim, the check line reads
   "Drag a room onto the grid to start. Nothing is checked until you do."
   and Send is visibly asleep and not clickable. One ghost tile with
   "DROP A ROOM HERE" sits on the grid and disappears the moment anything
   is placed. Checking begins with the first placed room, and from then
   on the line behaves as it does today. One rule decides this state, one
   place, read by the card, the button and the grid.

3. Two real steps, commit `ui: one panel at a time`. The bar's "01 Draw
   your flat" and "02 Send it" become two screens, built to
   `FlatDraw.dc.html` and `FlatSend.dc.html`. In step 01 the right column
   is gone: the palette is at the left, the drawing fills everything
   else, and the flat's three numbers plus the check chip live as a thin
   strip inside the top bar, live as the resident draws. In step 02 the
   palette is gone: the flat is shown whole and centred with its numbers
   and check state beneath it, and at the right sit the headline, the
   group code and name as two fields, one red "Send it" button and the
   folded "More". Step 02 is not reachable until the flat has a way in,
   and the step tabs are clickable both ways so nothing is a trap. The
   send itself calls exactly the code path 0026 already built; only where
   it lives changes.

4. One place for everything, commit `ui: one thing, one place`. From the
   top bar: `SAVE / OPEN` becomes `OPEN` and loses every save path, since
   the column owns saving. `CHECK LAYOUT` leaves the bar; the column's
   check line and its "show me" link are the way in, and "show me" opens
   the same panel the button opened. `FRAME VIEW` leaves the bar and
   joins `#view-controls` as a third chip beside Cutaway and Solid, so
   Cutaway, Solid, Frame and the compass are one cluster in one corner.
   The column's `SAVE` toggle stops saying Save: the card is headed "Your
   flat" and the toggle is a small chevron at its right that collapses
   the whole column to a tab. `MODEL / PLAN / DIAGRAM` stays in the bar.
   No control is deleted; every one of them still exists, in exactly one
   place. List in the report where each moved control now lives.

5. The journey strip, commit `landing: how it goes`. The six steps as an
   ordered array in one module, rendered on the landing with the current
   one red and the ones ahead hollow. The building app will render the
   same array later, so it is exported and documented, not inlined in
   the landing's markup.

6. Tests, commit `flat: tests for 0027`. The step gate (step 02 locked
   until the flat has a way in, unlocked after); the empty-state rule from a
   hand-built unit with no rooms and one with a room; the journey model's
   shape and current index; the landing's skip decision from a URL with
   and without `?project=` and `?session=`; the group fields written by
   "Join a group" read back through the same helper the column uses.
   Existing suites green, both fixture baselines still 12 and 7, the
   three downloads byte-identical.

7. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0027-the-landing-and-one-place-for-everything.report.md`,
   prompt moved to done/, one LOG row, committed on `run/0027` and
   pushed, with the preview address.

All seven tasks land. There is no short version of this run. If it is long,
it is long; keep going until every task is done and the report answers
every point.

## Constraints

- A new branch `run/0027` from `main`. Never commit to main.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules, both
  fixtures and the store contract stay untouched.
- The three file downloads stay byte-identical.
- The editor's scene, tools and validation logic are not redesigned; this
  run moves and gates controls, it does not rewrite what they do. The
  canvas keeps its own resize and camera behaviour; if losing the right
  column changes its width, that is a resize, not a rebuild.
- The palette itself is not redesigned this run. Collapsing its groups
  and floating recent tiles is a later run, decided by Shrey.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.
- No colour outside the brief's four. No gradients. No sweeping line.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. The landing, live: a capture or, if the environment writes no files, a
   description element by element with the computed fonts and colours
   read from the DOM, plus what each of the three doors did when clicked.
3. Both steps, live: step 01 with no right-hand panel and the bar's
   numbers strip reading a real flat's figures, then step 02 with no
   palette. What happens when step 02 is clicked on a flat with no way
   in, and after the entrance is placed.
4. The empty state, live: the bar's three numbers, the check chip and
   step 02's state with nothing placed, then the same three immediately
   after one room is dropped.
5. The redundancy cull: a table of every control that moved, where it was,
   where it is now, and what it does. Then a search of the DOM for the
   word "save" with every remaining hit explained.
6. The journey model: the module, and both call sites if there is more
   than one.
7. Which parts of the brief and which wireframe screens were applied,
   which were not, and why.
8. Test counts before and after, both fixture baselines, the three
   download checks.
9. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
10. Contradictions with the Assumptions, then your own assumptions with
   their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
