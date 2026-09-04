---
id: "0028"
title: Five flats for the library, the first batch
created: 2026-09-04
---

## Context

The building app needs a real group to pack. One resident has one flat, so
twenty flats will mean twenty residents and twenty homes. Drawing twenty by
hand costs days that the fifteenth of September does not have.

**This run makes five, not twenty.** Five is the batch that proves the
method. If the five come out well, the other fifteen follow in a second
run that reuses everything this one builds. Do not make more than five.

They are not made by dragging tiles, since this session can write the
`dwelling-unit` format directly, but every flat must come out of the app's
own checks clean, exactly as though a person had drawn it. A flat that only
passes on paper is worse than no flat.

The five go into the library at `public/units/`, each with its manifest row
and its preview, so Shrey can open any of them in the editor, change
anything, and save it back.

This is a generation task with a verification task attached. The
verification is the part that matters.

## Skills to use

Read the SKILL.md files from disk, under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`,
as run 0027 did. For this run:

- `design-automation` for the layouts as rules over an adjacency graph
  rather than as hand-placed compositions. Its space-planning and
  constraint-satisfaction sections are the method here.
- `algorithmic-patterns` for packing rooms into a rectangle, which is what
  realising each graph on the cell grid is.
- `parametric-modeling` for the family idea: one flat type parameterised
  by size and orientation gives variants that are genuinely different
  rather than mirrored.
- `computational-geometry` only if a placement needs it.

Reference, not instruction. Report which you read, what each contributed,
and anything rejected with the reason. Do not read the rest of the AEC set.

## Look at real plans first

Before writing a single flat, look at real apartment layouts and write
down what you find. This is the first task of the run and the rest depends
on it.

Search the web for small and medium apartment floor plans, and read what
you find: Swiss and European housing plans by preference, since the
project is in Zürich and the areas above are Swiss. Useful search terms
are the names of housing projects, "Grundriss Wohnung", "apartment floor
plan 2 rooms", the RPLAN dataset's published figures, and the HouseGAN
paper's own plates. The useful thing from HouseGAN and the RPLAN dataset
it learned from is not the network, it is the **bubble diagram**: a graph
of which room touches which, which is how both of them describe a plan
before it has a shape.

From what you read, record in the report:

- Six to ten reference plans, each named, with a source, its rough area,
  its room count, and its adjacency graph written in one line.
- The patterns that repeat across them: where the entrance lands, what a
  hall does, which rooms sit on the facade and which do not, where the
  wet rooms group, typical room proportions, and typical depths from
  facade to core.
- Anything that surprised you.

Then design the five flats from those patterns rather than from first
principles. Every flat's graph should be traceable to something you read,
and the report says which reference each one came from.

The rules that came out of the reading in earlier work, as a starting
point to confirm or contradict: living connects to kitchen and to the
hall; a bedroom opens off the hall and never off the living room; a
bathroom opens off the hall and never off a bedroom, except one en-suite
in the largest flats; the entrance opens into a hall, never straight into
a bedroom. Confirm or correct each of these against what you actually
find, and say which.

## Assumptions

Check rather than trust, contradict rather than work around. Where the
prompt is silent, choose sensibly, keep going, and record the choice.

1. `main` carries run 0027 merged. If it does not, stop and report;
   merging is Shrey's call.
2. The library is `public/units/`, with `index.json` as the manifest, one
   `<id>.json` per flat in the `dwelling-unit` v1 format, and one
   `<id>.jpg` preview. Seven entries exist today.
3. `docs/bridge-format.md` documents the format; `src/core/rules.ts` holds
   the rule engine, 14 must-fix and 27 advisory; `validate()` and
   `computeDwellingGraph()` are what Check Layout runs.
4. Run 0024 added an axonometric preview at 800 × 600 from the isometric
   direction; that is how a library preview is made.
5. The grid cell is 0.6 m and a storey is 3 m.

## What the five are

Shared housing, so the batch spans the range the full twenty will cover.
Five flats, all distinct, no two the same plan mirrored or rotated:

- 1 small, one room plus a kitchen, around 35 to 45 m².
- 2 medium, two rooms, around 50 to 65 m².
- 1 large, three rooms, around 70 to 85 m².
- 1 extra large, four rooms or a maisonette, around 95 to 115 m².

Four are one storey (G) and one is two storeys (G+1), and the two-storey
one is the extra large.

Every flat has, at minimum: an entrance on an outside edge, a hall or
circulation that reaches every room, one kitchen, one bathroom, one
living room, and glazing on at least two orientations. Bedrooms follow the
size. Balconies are welcome and not required.

**The wet rooms of a flat sit together on one storey.** Bathroom, WC and
kitchen share one storey and are adjacent or separated by one wall, so a
single shaft can serve them. In a two-storey flat they are all on the
lower storey unless the plan makes that impossible, and then the report
says which flat and why. This is the rule that decides whether the packer
can place a flat at all, so it is not a preference.

## Tasks

1. The reading, commit `library: what real plans do`. The reference study
   described above, written to `_cowork/outbox/0028-reference-plans.md`:
   the plans you found, their graphs, the patterns, and which of the four
   starting rules held. Nothing is designed before this file exists.

2. The generator, commit `library: a flat from a graph`. A script under
   `scripts/`, run once and kept, that takes a bubble diagram and a target
   size and writes a `dwelling-unit` v1 file: rooms placed on the cell
   grid, walls between them, doors on the shared edges the graph names, an
   entrance on an outside edge, windows on the outside edges of habitable
   rooms, and a stair where there are two storeys. It writes nothing to
   the library on its own.

3. The five, commit `library: five flats`. Five graphs and five files.
   Use subagents so the flats are worked on in parallel, since they are
   independent of each other. Each subagent gets the reference study, the
   format doc, the rule list, the generator and its own flat, and returns
   a file. Say in the report how many subagents you used and how you split
   the work.

4. Every flat passes, commit `library: five flats, all clean`. Load each
   of the five through the app's own path and run the same `validate()`
   and `computeDwellingGraph()` Check Layout runs. **Zero must-fix on all
   five.** Advisory findings are allowed and counted. A flat that cannot
   be made clean is redrawn until it is; it is not shipped with a known
   fault and it is not quietly dropped. Report the full count per flat:
   must fix, worth a look, note.

5. Previews and the manifest, commit `library: five previews`. One
   axonometric preview per flat, made the way run 0024 makes them, and
   five manifest rows with name, colour, storeys, area and file. Names are
   plain and tell them apart: the size and something about the plan, for
   example "Flat 03 — two rooms, corner". Colours come from the existing
   palette and no two adjacent ids share one.

6. A contact sheet, commit `library: the five on one sheet`. One image
   under `_cowork/outbox/` showing all five previews in a row with their
   names, areas and graphs, so Shrey can judge the whole batch at once
   without opening the app.

7. Tests, commit `library: tests for the five`. The generator's own
   arithmetic on one hand-checked graph. A test that walks every file in
   `public/units/` and asserts it parses and carries zero must-fix, so the
   library cannot rot. Existing suites green, both fixture baselines still
   12 and 7, the three downloads byte-identical.

8. PROJECT_STATE.md and `_cowork/CONTEXT.md` updated. Report to
   `_cowork/outbox/0028-five-flats.report.md`, prompt moved to done/, one
   LOG row, committed on `run/0028` and pushed, with the preview address.

All eight tasks land. There is no short version of this run. If it is
long, it is long; keep going until every task is done and the report
answers every point.

## Constraints

- A new branch `run/0028` from `main`. Never commit to main.
- The `dwelling-unit` format, `docs/bridge-format.md`, the rules and both
  fixtures stay untouched. This run writes data, not rules.
- The seven flats already in the library stay exactly as they are.
- The three file downloads stay byte-identical.
- No new dependencies. Never stage with `git add -A`. Commit before
  opening a file a second time.
- A flat is a design a person could have drawn. No shape that only a
  script would make: no one-cell corridor running the length of a flat, no
  room reachable only through a bedroom, no room so thin or so notched
  that no furniture fits in it.
- Where the flat sits in a building is not this app's business and not
  this run's. Glazing is placed on the flat's own outside edges, and what
  a neighbour later blocks is the packer's problem.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found on
   `main`, and the preview address.
2. The reference study: the plans you found, where they came from, the
   patterns, and which of the four starting rules survived contact with
   real plans.
3. The five, as a table: name, storeys, area in m², rooms, the graph in
   one line ("entrance → hall → living, kitchen off living, 2 bedrooms
   and bath off hall"), and which reference it came from.
4. The check result for all five, must fix / worth a look / note per flat,
   with the raw panel line for each. Any flat that needed redrawing, and
   what was wrong the first time.
5. Proof the wet rooms are grouped: per flat, which storey holds kitchen,
   bath and WC, and the largest gap in cells between any two of them.
6. The contact sheet.
7. How many subagents, how the work was split, and anything a subagent
   got wrong that the verification caught.
8. Test counts before and after, both fixture baselines, the three
   download checks.
9. Which skills you read from disk, what each contributed, anything
   rejected with the reason.
10. Contradictions with the Assumptions, then your own assumptions with
    their effects.
11. What you would change about the method before the next fifteen are
    made, in plain words. This batch exists to answer that question.

The report follows the writing rules: short sentences, plain words,
connected prose that carries its own logic, no em dashes as glue, no
contrast constructions, neutral voice, prose before any list or table,
every number exact, and every claim names its evidence. The reader has no
access to this repo, so cite paths and line numbers.
