---
id: "0026"
title: The flat app on paper, and two small store fixes
created: 2026-09-03
---

## Context

On 3 September Shrey approved a wireframe of the final interface and
a design brief written from it. Both are in this repo:
`_cowork/design/DESIGN-BRIEF-3sep.md` and
`_cowork/design/wireframe/`, seven HTML screens whose CSS is the
reference for every colour, font, size and animation. Read the brief
first, then `FlatDraw.dc.html`, which is this app's screen. The
other six screens belong to the building app and are here only so
the two apps match.

This run does three things. Two are small fixes from run 0025's own
questions, decided by Shrey: the store's building entry carries the
plot, and resident names match loosely. The third is the flat app in
the brief's skin: paper, the fonts, the three colours, the top bar
with its two steps, the right column with one red button, and the
files behind "More".

The words changed too. What the code calls a session is a **group**
in everything a resident reads. A resident joins a group, sends a
flat to the group, sees the group's flats. "Room" and "session" do
not appear in any label. Code identifiers stay as they are.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`
as run 0025 did. `design-automation` for the name matching as one
rule used in three places. Report which you read, what each
contributed, and anything rejected with the reason. Reference, not
instruction.

## Assumptions

Check rather than trust, contradict rather than work around. Where
the prompt is silent, choose sensibly, keep going, and record the
choice.

1. `main` carries run 0025 merged. If it does not, stop and report;
   merging is Shrey's call.
2. The store's building entry is `{genome, summary, by, at}`, written
   by `PUT /api/session/{code}/building` in
   `netlify/functions/session.mts` through `src/session/store.ts`, and
   documented in `docs/store.md`. `summary.plot` is a string the
   packer writes and nobody reads.
3. Resident names are compared as exact strings in three places:
   `isMine` (`src/library/unitBrowser.ts`), the store's ownership
   check (`existing.resident !== resident` in `store.ts`), and
   `whyPublishDisabled` (`src/session/session.ts`). Session codes are
   already normalised by `normalizeCode` (trim, lowercase).
4. The save dialog (`index.html` near line 161, `openSaveDialog` and
   `runSave` in `src/main.ts`) holds the resident and code fields,
   the five checkboxes under Files and Session, and the primary
   button. The Units panel is `createUnitBrowser` in
   `src/library/unitBrowser.ts`. Styles live in `src/style.css`.
5. The three-dimensional editor (the Three.js scene, its tools and
   the validation panel) is not touched by the brief beyond the
   chrome around it.

## Tasks

1. The plot in the store, commit `store: the building carries its
   plot`. `PUT …/building` accepts an optional `plot` object and
   stores it as it came; `GET …/{code}` and `GET …/export` return it
   under `building.plot`. The store does not read inside it. Document
   the field in `docs/store.md` as opaque, owned by the building app,
   with one example: `{"modulesX": 11, "modulesY": 11, "floors": 7}`.
   Round-trip it in `scripts/store-roundtrip.mjs`.

2. Names match loosely, commit `session: ana is Ana`. One pure
   function `sameResident(a, b)`: trimmed, case-insensitive. Used in
   `isMine`, in the store's ownership check, and wherever else two
   resident names meet. The name as typed is what the store records
   and what the cards show; only the comparison folds case. A
   republish by "ben" over "Ben" is not a conflict.

3. The skin, commit `ui: paper, the fonts, the three colours`. From
   the brief: the paper ground with its grain, Big Shoulders Display
   and Jost through one Google Fonts link in `index.html` with the
   fallback stacks the brief names, ink, red, blue and yellow as CSS
   custom properties, cards with a 3 px rule on top and nothing
   else, buttons as red blocks with the nudging arrow, inputs as a
   line with a red caret, chips as outlined pills. The editor's
   canvas keeps its own colours. Everything else the resident sees
   takes the new ones.

4. The bar and the column, commit `ui: two steps and one red
   button`. The top bar reads "(Re)Configure / Flat" and two steps,
   "01 Draw your flat" and "02 Send it to your group", the current
   one a red disc that breathes, with the 3 px rule under the bar.
   The save dialog's content becomes a column at the right of the
   editor, always visible, in this order: the flat's name and three
   numbers (area, storeys, glazing) with the check line under them;
   the group (code and name on one line, "change" to unfold); one
   red button "Send it to your group"; a folded "More" holding the
   project file, the unit file, the library entry and Replace. The
   numbers count up when the flat changes. If the column cannot sit
   beside the editor without breaking it, keep the dialog and give
   it the same order and skin, and say why in the report.

5. The Units panel, commit `library: the group's flats on paper`.
   The panel in the same skin: the group's flats first under the
   heading "Your group", the library under "Library", each card
   with the rule on top, the owner's name, and "Yours" as a red
   chip. Cards rise in one after another when the panel opens.

6. Words, commit `copy: group, not session`. Every label, hint,
   result line and dialog title a resident reads says group. The
   result line after a send reads "Sent to review-0023 as Unit 6 ·
   open Units to see your group". Confirm texts keep their meaning.

7. Tests, commit `flat: tests for 0026`. `sameResident` on the
   cases: equal, case, spaces, empty; the ownership check accepting a
   case-different republish; the store round trip with `plot`;
   `isMine("Ana ", "ana")` true. Existing suites green, both fixture
   baselines still 12 and 7, the three downloads byte-identical.

8. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0026-the-flat-app-on-paper.report.md`, prompt
   moved to done/, one LOG row, committed on `run/0026` and pushed,
   with the preview address.

All eight tasks land. There is no short version of this run. If it
is long, it is long; keep going until every task is done and the
report answers every point.

## Constraints

- A new branch `run/0026` from `main`. Never commit to main.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and
  both fixtures stay untouched. The store contract changes only by
  the `plot` field.
- The three file downloads stay byte-identical.
- No new dependencies; a Google Fonts `<link>` is not a dependency.
  Never stage with `git add -A`. Commit before opening a file a
  second time.
- The editor's scene, tools and validation are not redesigned; only
  the chrome around them.
- No sweeping line, no gradients, no colour outside the four.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. `GET /api/session/{code}` pasted whole after a `PUT …/building`
   with a `plot`, and the round-trip script's output.
3. `sameResident` cases and the ownership check: a republish by
   "ben" over a flat recorded as "Ben" accepted, the store's entry
   pasted before and after.
4. The editor with the new bar and column, and the Units panel with
   two residents' flats, as captures if the environment writes them,
   else described element by element with the computed font family
   and colours read from the DOM.
5. The words: `grep -n` for "session" and "room" over `index.html`
   and `src/`, with each remaining hit explained (identifier, or a
   label that was missed).
6. Which parts of the brief were applied, which were not and why.
7. Test counts before and after, both fixture baselines, the three
   download checks.
8. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
9. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or
table, every number exact, and every claim names its evidence. The
reader has no access to this repo, so cite paths and line numbers.
