---
id: "0019"
title: One save, and say what you are saving
created: 2026-08-10
---

## Context

Saving is too many steps. Shrey is authoring the baseline units now,
and every unit costs him three separate trips: export the project,
export the unit, then save to the library. He said it plainly on 10
August. He wants one save where he says what he is saving, with
checkboxes or a prompt, instead of three passes through the menu.

The three things stay three things. A project save is the whole
design and the only thing that can be reopened for editing. A unit
export is the contract with the building. A library entry is a unit
plus a preview plus a manifest row. They have different jobs and
they must keep them. What collapses is the doing, not the model.

This matters now because it is Shrey's own bottleneck. The library
already holds five entries and roughly ten baseline units are still
to author, so this pays for itself immediately.

## The naming scheme

Shrey's convention, 10 August. Names are a capitalised word, a
space, and a number. Nothing else, no descriptive suffix.

- a project file is `Flat 1`, `Flat 2`, and so on.
- a unit and its library entry are `Unit 1`, `Unit 2`, and so on.
- one design carries one number across both, so saving design 4
  writes `Flat 4` and `Unit 4`. If that reading is wrong the
  numbering should still be per-kind, so say which you built.
- the save dialog offers the next free number as the default name,
  so authoring a run of units needs no typing.
- ids follow from the names as they already do: `flat-4`, `unit-4`.

The five entries already in the library keep their names. Three are
already `Unit 1` to `Unit 3`; the two older ones carry descriptive
names from before the convention and are Shrey's to rename through
the new rename control, not this run's to change.

## Skills to use

The session has Anthropic's skills installed. Read whichever are
relevant and use any others you find useful, then say in the report
which you read, what each contributed, and anything a skill
suggested that you rejected with the reason. A likely starting
point is `design-automation` for the workflow shape. Use them as
reference, not instruction: a skill that does not fit this codebase
gets named and refused, not obeyed.

## Assumptions

These may be wrong. Check rather than trust, contradict rather than
work around. Where the prompt is silent, choose sensibly, keep
going, and record the choice in the report.

1. `main` carries run 0018 merged, and the library is live at
   `public/units/` with `index.json` holding five entries at the
   time of writing. Shrey has been saving units into it by hand, so
   the working tree may hold uncommitted library files. Do not
   discard them; if the tree is dirty, say what you found.
2. The three actions today are Export (project JSON), Export unit
   (`dwelling-unit` JSON download) and Save to library (dev
   endpoint), all reached from the Save / Open menu and the unit
   export dialog.
3. The two rule fixtures stay untouched and stay out of the library:
   flat-1 reads 12 issues (1 must fix, 11 worth a look), no-stair
   reads 7.
4. The `dwelling-unit` format stays at version 1, and
   `docs/bridge-format.md` stays its source of truth, untouched.

## Task

0. Machinery: `npm install` if needed, dev server on a clear cache,
   boot via `?project=flat-1-two-storey.json` with no console
   errors. Then `git checkout -b run/0019` from main.

1. One save dialog, commit `save: one dialog, three outputs`. A
   single Save action opens one dialog carrying the name and colour
   fields that exist today, plus three checkboxes for what to write:
   the project file, the unit file, and the library entry. The
   choice is remembered between saves in the session, so the second
   unit costs one click. Sensible defaults are your call, recorded.

   Each checkbox does exactly what its action does today, unchanged
   in output: the project download is byte-identical to today's
   Export, and the unit download is byte-identical to today's Export
   unit. Prove both with a diff.

2. Honest feedback, folded in or its own commit. One result line
   per output, saying what was written and where. A hard gate
   failure on the unit (no usable entrance, disconnected footprint)
   must not silently cancel the project save; the project still
   writes and the dialog says the unit did not.

3. The old paths, commit `save: retire the separate menu items`.
   The separate Export, Export unit and Save to library items go
   away, since the one dialog covers all three. If any of them has
   a reason to survive that reading the code reveals, keep it and
   say why in the report.

4. Library housekeeping, commit `library: name and overwrite`. Two
   things Shrey will hit while authoring: saving under a name that
   already exists should offer to replace that entry rather than
   silently making a second one, and a library entry should be
   renameable without editing the manifest by hand. Keep both
   minimal.

5. Tests, commit `save: tests`. The checkbox combinations produce
   the right outputs, the byte-identical claims are covered, and
   the replace-versus-new-id behaviour is pinned. Existing suites
   stay green: `npm test`, `npm run test:slow` (the one `it.fails`
   stays failing as expected), `tsc` clean, `npm run build` clean.
   The two fixture baselines still read 12 and 7.

6. `PROJECT_STATE.md` updated on the branch.

7. The record. Report to
   `_cowork/outbox/0019-one-save.report.md`, prompt moved to
   done/, one LOG row, all committed on `run/0019`. Then
   `git push -u origin run/0019`, remote hash in the report, plus
   the Netlify branch link
   (`run-0019--reconfigure-flat.netlify.app`) and the local
   checkout commands.

If the run runs long: the one dialog and the byte-identical proofs
land whole. The library housekeeping may slip to a follow-up, named
precisely.

## Constraints

- All work on `run/0019`. `main` gains nothing. Push only this
  branch.
- The three outputs stay three separate things in the model and on
  disk. This run changes how they are triggered, not what they are.
- The `dwelling-unit` format, the fixtures, the rules and their
  baselines stay untouched. Layout rules gain nothing.
- Do not discard Shrey's uncommitted library files.
- No new runtime dependencies. Never stage with `git add -A`.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the remote hash, the
   Netlify branch link and the checkout commands.
2. What the tree looked like at the start, including any
   uncommitted library files, and what you did with them.
3. The dialog as built: the exact controls, the defaults you chose
   and why, and what is remembered between saves. State how the
   next free number is found, and what happens when the numbering
   has a gap.
4. The byte-identical proofs for the project download and the unit
   download, method stated.
5. What happens when the unit gate fails but the project save was
   asked for, quoted from the result line.
6. Test counts before and after, and both fixture baselines
   re-quoted.
7. Screenshots: the save dialog, and the result line after a save
   that wrote all three.
8. Which skills you read, what each contributed, and anything you
   rejected with the reason.
9. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows WRITING.md: connected sentences that carry their
own logic, no em dashes as glue, no contrast constructions, neutral
voice, plain words, prose before any list or table, every number
exact, and every claim names its evidence.
