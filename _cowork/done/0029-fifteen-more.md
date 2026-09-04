---
id: "0029"
title: Fifteen more flats, a bedroom in every one, and a way to delete
created: 2026-09-04
---

## Context

Run 0028 read ten real plans, built a generator and drew five flats. All
five carry zero must-fix findings from the app's own `validate()`, their
wet rooms sit together on one storey, and each is traced to a plan in
`_cowork/outbox/0028-reference-plans.md`. Read that study and that report
before anything else here.

Shrey looked at the five and decided three things on 4 September.

**Fifteen more, with more variety.** The five read as three or four
horizontal strips each, which is what run 0028 named as the packer's own
limit. The next fifteen should not look like fifteen versions of one
diagram.

**Every dwelling needs a bedroom.** Flat 08 has none. A new hard rule says
a dwelling must hold at least one bedroom. There is no studio exception:
in this project the smallest flat is a proper one-bedroom. Flat 08 is
redrawn to suit.

**A way to delete a flat from the library.** For now it is a button on
every card, for anybody. Later it becomes the architect's alone, and this
run does not build that.

The module catalogue stays exactly as it is. Run 0028 argued for larger
rooms and Shrey decided against changing it now. Work within
`src/core/modules.ts` as it stands, and use the elastic void where a room
needs to be bigger, as run 0028 did.

## Look wider before drawing

Run 0028's study is Swiss and German cooperative housing, which is why the
five look like each other. Widen it. Before drawing, add to that study, in
a new file, plans from the projects this thesis already talks about:

- **Frei Otto's Ökohaus**, Berlin, 1980s. Residents designed their own
  flats inside a given frame. It is the closest built precedent to this
  thesis and Benjamin named it on 3 September.
- **Kaisersrot**, ETH and KCAP. The participatory layout work Benjamin
  keeps returning to.
- **Habitat 67**, Safdie, Montreal. Safdie publish the plans. The porous
  stacked case.
- **Habraken and Open Building**, the SAR method: supports and infill,
  which is the same split this project makes between the packer and the
  flat.
- **PREVI**, Lima, and **Quinta Monroy**, Elemental. Incremental housing,
  where half a house is designed and the rest is not.
- **Kalkbreite** and **Mehr als Wohnen** (Hunziker Areal), Zürich. Run
  0028 opened Kalkbreite and could not read its doors; the Hunziker
  Planheft at
  `https://www.mehralswohnen.ch/fileadmin/downloads/Hunziker_Areal/maw_Hunziker_Areal_A_Planheft.pdf`
  was never reached.

Run 0028's method note says how to read a PDF here: the browser pane
pointed at `https://docs.google.com/viewer?embedded=true&url=<encoded
pdf>`. Use it.

For each project, record what run 0028 recorded: the plan, its source, its
rough area, its room count, its adjacency graph in one line, and what is
different about it. Where a plan cannot be read honestly, say so and move
on rather than guessing. Then say in one paragraph what these add that
the Swiss cooperative sample does not, and which of the fifteen flats
each one shapes.

Variety means shape as well as size. The fifteen should include flats that
are not a stack of horizontal strips: an L, a plan turning a corner, a
deep plan with a light well, a through-flat with two opposite facades, a
narrow tall one. Run 0028 says the packer's rows of slots cannot describe
a room spanning two bands. If that is still true, say which shapes you
could not build and why, rather than drawing fifteen strips and calling
it variety.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`,
as run 0028 did. For this run:

- `design-automation` for section 5.1's placement order, which run 0028
  found matched the reference plans, and for the new rule as a rule.
- `parametric-modeling` for the family idea, so fifteen flats are variants
  of a few types rather than fifteen one-offs.
- `architectural-drawing` only if the contact sheet needs it.

Run 0028 read `algorithmic-patterns` and rejected it with reasons, and did
not read `computational-geometry` past its outline. Do not repeat either.
Report which you read, what each contributed, and anything rejected.

## Assumptions

Check rather than trust, contradict rather than work around. Where the
prompt is silent, choose sensibly, keep going, and record the choice.

1. `main` carries run 0028 merged. If it does not, stop and report;
   merging is Shrey's call.
2. `scripts/gen-flat.mjs` and `scripts/flatLayout.ts` work as run 0028
   left them, and `scripts/flats/*.flat.json` holds the five diagrams.
3. `src/core/rules.ts` holds 41 rules, 14 of them `severity: "hard"`.
   The panel counts hard plus soft and lists notes separately, which is
   why the fixture baselines read 12 and 7 rather than 17 and 11.
4. `public/units/unit-5.json` fails four hard rules and is quarantined in
   `src/core/libraryClean.slow.test.ts`. It is an old scratch unit with no
   doors and a retired stair module.
5. `unit-6` and `unit-7` may still be uncommitted in the working tree.
   Leave them alone exactly as run 0028 did.
6. The library browser is `createUnitBrowser` in
   `src/library/unitBrowser.ts`; the manifest is `public/units/index.json`.

## Tasks

1. The wider reading, commit `library: what other housing does`. The study
   above, written to `_cowork/outbox/0029-reference-plans-2.md`. Nothing is
   drawn before this file exists. It adds to run 0028's study rather than
   replacing it.

2. A dwelling needs a bedroom, commit `rules: a dwelling needs a bedroom`.
   One new rule at `severity: "hard"`, in the same shape as the fourteen
   that exist, saying a dwelling must hold at least one bedroom. Give it an
   id that follows the file's own convention and a message a resident can
   act on. Then run every flat in `public/units/` and both fixtures against
   it and report which fail. Do not edit a fixture and do not edit an
   existing flat to make it pass; report and stop at that. Say what the two
   baselines become, old and new, with the cause named.

3. Flat 08 redrawn, commit `library: flat 08 gets a bedroom`. Same size
   band, 35 to 45 m², now with a real bedroom. Zero must-fix, wet rooms
   together, traced to a plan.

4. Delete a flat, commit `library: a card can be deleted`. Every library
   card carries a delete control. It asks first, naming the flat, using
   the same pure-helper pattern run 0025 used for the takeover confirm so
   the wording is testable without a dialog. Deleting removes the file, its
   preview and its manifest row. It cannot delete a flat that is open in
   the editor without saying so. This is for everybody for now; the
   architect-only version is a later run and is not built here.

5. The fifteen, commit `library: fifteen more flats`. Fifteen graphs and
   fifteen files, ids continuing the `unit-N` sequence, spanning the same
   bands as run 0028: roughly 3 small, 5 medium, 4 large, 3 extra large,
   with at least four over two storeys. All distinct, no two the same plan
   mirrored or rotated, and each traced to a named plan in either study.
   Use subagents, but the way run 0028 said to: give each one a starting
   layout that already runs and a tool that prints a verdict, so its job is
   tuning rather than open-ended design behind two long documents. Say how
   many you used, how you split the work, and what failed.

6. Every flat passes, commit `library: twenty flats, all clean`. All
   twenty through the app's own `validate()` and `computeDwellingGraph()`,
   including the new bedroom rule. Zero must-fix on all twenty. A flat that
   cannot be made clean is redrawn until it is. Report must fix, worth a
   look and note per flat.

7. Previews, manifest and the sheet, commit `library: twenty on one
   sheet`. One axonometric preview and one manifest row per new flat, names
   in run 0028's form. One contact sheet of all twenty under
   `_cowork/outbox/`, with each flat's name, area, storeys, rooms, its
   reference plan and its graph.

8. Tests, commit `library: tests for 0029`. The bedroom rule on a
   hand-built dwelling with and without a bedroom. The delete helper's
   wording and its refusal when the flat is open. The library-wide
   zero-must-fix test extended to all twenty. Existing suites green, both
   fixture baselines reported with any change explained, the three
   downloads byte-identical.

9. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0029-fifteen-more.report.md`, prompt moved to done/,
   one LOG row, committed on `run/0029` and pushed, with the preview
   address.

All nine tasks land. There is no short version of this run. If it is long,
it is long; keep going until every task is done and the report answers
every point.

## Constraints

- A new branch `run/0029` from `main`. Never commit to main.
- `src/core/modules.ts` is not changed. The catalogue stays as it is.
- The `dwelling-unit` format and `docs/bridge-format.md` stay untouched.
- `src/core/rules.ts` gains exactly one rule and nothing else changes in
  it. No existing rule's severity, message or id moves.
- Both fixtures in `testflats/` stay byte-identical. If the new rule
  changes what they report, say so; do not edit them.
- `unit-5.json`, `unit-6` and `unit-7` are not touched. `unit-5`'s
  quarantine in the library test stays until Shrey decides.
- The three file downloads stay byte-identical.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.
- A flat is a design a person could have drawn. No one-cell corridor
  running the length of a plan, no room reachable only through a bedroom,
  no room too thin or notched for furniture. Where the flat sits in a
  building is not this app's business; glazing goes on the flat's own
  outside edges.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. The wider reading: the projects, their plans, their sources, their
   graphs, what each adds that the Swiss sample does not, and which flats
   it shaped. Anything you could not read honestly, named.
3. The new rule: its id, its severity, its message, and the result of
   running every existing flat and both fixtures against it. Both
   baselines, old and new, with the cause.
4. The twenty, as a table: name, storeys, area, rooms, graph in one line,
   reference plan.
5. The check result for all twenty, must fix / worth a look / note per
   flat, with raw output for at least five.
6. The wet-room table for the fifteen, as run 0028 gave it.
7. Variety: which shapes you managed that run 0028 could not, and which
   you still could not build and why.
8. Delete: the confirm's exact wording, what happens on a decline, and
   what happens when the flat is open in the editor.
9. Subagents: how many, how split, what each was given, what failed.
10. Test counts before and after, both fixture baselines, the three
    download checks.
11. Which skills you read from disk, what each contributed, anything
    rejected with the reason.
12. Contradictions with the Assumptions, then your own assumptions with
    their effects.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
