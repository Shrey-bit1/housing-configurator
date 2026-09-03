---
id: "0025"
title: Whose flat is this
created: 2026-09-03
---

## Context

Run 0024 made a publish over somebody else's flat a refusal with a
Replace box. Two things follow, both decided by Shrey on 3 September.
A resident should see whose flat is whose before they save, so the
refusal confirms something already visible. And taking a flat over
should ask first, with the owner's name, the way the library's own
replace-or-new prompt already asks.

This run also gives the two screens it touches a pass against
Shrey's UX guidelines, listed below. Small moves only: no redesign.

THE UX GUIDELINES, from Shrey, 3 September, also in this repo at
`_cowork/ux-guidelines.md`. Reference, not instruction; the report says which lines were applied and which were
rejected, with the reason.

- Reduce choices per screen. Make targets large. Follow familiar
  patterns. Group related information.
- Break content into chunks. Answer within about 400 ms, or show
  that something is happening.
- Highlight the primary action. Place key actions near each other.
  Put essentials first. End flows memorably. Show visible progress.
- Simplify complex interfaces. Use sensible defaults. Prevent
  inconsistency. Connect related elements visually.
- Reduce task completion time. Reveal complexity gradually. Make
  completion feel closer.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`
as run 0024 did. `design-automation` for the confirm as a rule in the
save flow. Report which you read, what each contributed, and anything
rejected with the reason.

## Assumptions

Check rather than trust, contradict rather than work around. Where
the prompt is silent, choose sensibly, keep going, and record the
choice.

1. `main` carries run 0024 merged. If it does not, stop and report;
   merging is Shrey's call.
2. A session card (`sessionCard`, `src/library/unitBrowser.ts`)
   already carries `flat.resident` as a small meta line. The save
   dialog's resident name is in `localStorage` under
   `reconfigure.session` and readable through `readSession`.
3. `runSave` in `src/main.ts` handles the 409 and the Replace box;
   the 409 body carries `ownerResident`.
4. The library's replace-or-new prompt uses `window.confirm`; the
   automation trap from run 0010 applies: `window.confirm` returns
   false without display under scripting, so the test drives the
   pure helper, not the dialog.

## Task

1. Ownership, commit `library: whose flat is this`. On every
   session card the owner's name is the first line after the label,
   at the card's normal size. When the owner matches the current
   resident name, the card carries a "Yours" mark and sorts first.
   With no resident name set, no mark.

2. The confirm, commit `save: taking a flat over asks first`. When
   Replace is ticked and the flat belongs to someone else, Save asks
   "This flat belongs to Ana. Take it over?" before the publish goes
   out. Declining leaves the other outputs as they were and writes a
   result line that says the publish was not sent. The wording comes
   from a pure helper that takes the owner's name.

3. The UX pass, commit `ui: two screens against the guidelines`.
   The save dialog and the Units panel, each judged against the list
   above. Likely moves: one primary button per screen; the session
   fields shown once and then folded into one line ("room-42 · Ana,
   change") until touched; the four output boxes grouped as files
   and session; a result line that names the next step ("Open Units
   to see the room"). Make the moves that are one or two lines
   each, list the rest as suggestions in the report, and change
   nothing in the flat editor itself.

4. Tests, commit `ownership: tests`. The "Yours" mark appears only
   for a matching name; cards sort with the resident's own first;
   the confirm text names the owner; a declined confirm sends no
   publish and writes the line. Existing suites green, both fixture
   baselines still 12 and 7.

5. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated.

6. The record. Report to
   `_cowork/outbox/0025-whose-flat-is-this.report.md`, prompt moved
   to done/, one LOG row, committed on `run/0025` and pushed, with
   the preview address.

If the run runs long: tasks 1 and 2 land whole; 3, 4 and 5 follow
named, in that order.

## Constraints

- A new branch `run/0025` from `main`. Never commit to main.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and
  both fixtures stay untouched. The store contract stays as
  `docs/store.md` has it after run 0024.
- The three file downloads stay byte-identical.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. A deployed session with two residents: a capture where one sees
   their own card marked "Yours" first and the other's unmarked.
3. The confirm's exact wording, and the result line after a decline.
4. The UX pass: which lines of the list were applied, where, and
   which were rejected with the reason; before-and-after captures of
   the dialog and the panel.
5. Test counts before and after, both fixture baselines.
6. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
7. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or
table, every number exact, and every claim names its evidence. The
reader has no access to this repo, so cite paths and line numbers.
