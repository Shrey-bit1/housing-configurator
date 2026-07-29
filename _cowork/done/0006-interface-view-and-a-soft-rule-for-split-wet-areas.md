---
id: "0006"
title: Interface view and a soft rule for split wet areas
created: 2026-07-29
---

## Context

The 28 July supervision meeting reorganised this thesis around a two-level
reading of a unit. The first level is the positioning of the wet cells, the
shafts, a possible stair and the balconies, together with the entrance, the
bedroom positions and which sides are facade. Those are the structural
decisions, they are what the unit communicates to the building around it, and
they are binding. The second level is how the rest of the interior is divided,
which Dillenburger called low-impact and exchangeable.

At 30:20 he asked for the thing this prompt builds: a version that frees up the
entire space and shows only the outline and the units, so the organisational
structure and the possible structural system read better. He gave the reason
immediately. Once that view exists, one can judge whether to decouple the
toilet shaft from the bathroom and kitchen shafts or bundle all three into one
block, which is a decision the app currently gives no way to see.

The view is deliberately display state for now. The model-level split into
interface and interior, and the matching rework of the export contract, come
after the 4 August review as their own piece of work, and the view will then
read from that split instead of from a list of hidden things. So build the
toggle cheaply and do not restructure the model to serve it.

The second half adds one advisory rule, requested by Shrey: warn when the wet
areas of a flat, bathrooms and kitchens, do not form one connected group. It is
deliberately a preference and not a piece of law. The regulation research
established that the app should separate cited law from advice, and this rule
is the first occupant of the advice tier: nothing in Zürich law requires wet
rooms to touch, and the justification is practical, because split wet areas
mean long installation runs and shafts that cannot bundle.

The same meeting said to stop putting effort into the interior layout solver.
No corridor-area minimisation, no corridor generation, no further
expansion-rule work. That instruction governs this run.

There is a guest review on 4 August with a practising housing architect. This
view is the first move of the demonstration, and without it the two-level
argument is a slide instead of something visible on screen.

## Assumptions

These are read from the repository and from a meeting transcript, and every one
of them may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it.

1. Placed cells carry a room type, the presets live in `src/core/`, and
   bathroom, kitchen and bedroom types exist with ids I do not know. Whether a
   separate WC or toilet type exists is unknown. Task 1 settles the vocabulary
   before anything is built on it.
2. Meeting item 2 asks for shaft positions in the export, which suggests shafts
   may not exist yet as a first-class concept. If there is no shaft type, scope
   both the view and the rule to the wet room types that do exist and say so.
3. `src/core/rules.ts` holds every rule as data in a `RULES` array and the
   whole engine is advisory already. I do not know whether an entry carries a
   severity, category or weight field that would let one rule read softer than
   another.
4. Rooms are hollow shells, floor plate plus perimeter walls, built in
   `src/scene/` and recomputed from placement data on every change. So the view
   filters what is built or shown and never mutates the model.
5. Three.js is Y-up, so the plan is the X/Z plane. `CELL_SIZE` is 0.6 m.
6. The configurator already works across multiple floors, so the view applies
   its filter to whatever the viewport shows and the outline reads per floor.
   Meeting item 5, multi-floor units as a typology with an internal stair, is
   separate work and changes nothing in this prompt.
7. Balconies and terraces exist as outdoor cell kinds, entrances as authored
   markers, stairs as placeable objects. All of them stay visible in this view.
8. There is no test suite. Verification means `tsc` clean, `npm run build`
   clean, and driving the app in a real browser.
9. `docs/build-pdf.py` regenerates the rules PDF from `rules.ts`. The PDFs are
   leaving this repository as a separate task, so nothing under `docs/` gets
   touched or regenerated in this run.

## Task

1. **Report the vocabulary before building anything.** The exact room type ids
   and which of them count as wet, whether a shaft type exists, the exact shape
   of a `RULES` entry including any severity or category field, where the scene
   objects for room shells, walls, glazing, furniture, stairs, balconies and
   entrance markers are built, and how visibility is controlled today if it is
   controlled at all. Add anything you notice that the coming interface-versus-
   interior model split will need to know. Report this even if the rest of the
   run stalls, because the prompts that follow this one are written from it.

2. **Build the interface view as a single toggle.** The target state with the
   toggle on: the flat's perimeter stands with its openings and glazing intact;
   wet cells, shafts if they exist, stairs, balconies, terraces and the
   entrance marker appear as they normally do; bedrooms are reduced to a flat
   tinted footprint that marks position, with no walls and no furniture; every
   other room is stripped to a neutral floor plate, with no partition walls, no
   furniture, no interior door markers and no per-room colour, so the freed
   area reads as one continuous open plate inside the outline. Choose the
   cheapest mechanism that produces that state and report exactly what the
   filter runs on.

   Put the bedroom tint behind a single flag in code and report where it is,
   because whether bedroom positions belong in this view is still open between
   the meeting's 30:20 wording and the export list, and flipping the answer
   must cost one line.

   Label the toggle **Interface view**, because that is the word the thesis
   uses for the binding level.

   If the perimeter turns out to be a by-product of individual room shells, so
   that hiding a room punches a hole in the facade, do not fake an outline.
   The acceptable fallback is to keep every wall that sits on the flat's
   boundary and drop only the interior partitions, and the report then says
   what a real outline object would cost.

   The toggle is display state. It writes nothing into the saved project, it
   changes nothing in the export, and turning it off returns the scene to
   exactly what it was. Prove the restore rather than asserting it.

3. **Add one advisory rule: the wet areas are split.** It fires when the wet
   cells on a floor form more than one connected group, where connected means
   sharing a cell edge and corner contact does not count. Its message names how
   many groups there are and where they sit. Shafts join the group if a shaft
   type exists.

   It is a soft rule. It appears in the validation report as a suggestion, it
   adds to no count that reads as errors, and ignoring it changes nothing. If
   `RULES` entries have no severity concept, add the smallest field that
   expresses it, and name the field so it can later carry the distinction
   between cited law and advice that the regulation work needs. Two values now,
   nothing more.

   Write the justification into the rule itself, in one sentence: split wet
   areas mean long installation runs and shafts that cannot bundle to the next
   storey. Every rule from here carries its reason with it, because which rules
   you follow becomes the explanation for why a configuration looks the way it
   does.

   Scope it to one floor. Whether wet cells stack across floors is meeting
   item 22 and is deliberately not in this prompt. Keep the implementation
   cheap, because the shaft decision in item 23 may reshape this rule.

4. **Update `PROJECT_STATE.md`** for both changes, as `CLAUDE.md` requires.

5. **Verify.** `tsc` clean, `npm run build` clean, then drive the app: build a
   flat whose wet cells sit in two groups and show the rule firing, move one
   room so the groups touch and show it clearing, and capture the interface
   view on and off on the same flat. Quote the rule's message text exactly.

If the run has to stop early, stopping after task 2 is the right place, because
the view is what the review needs and the rule is not.

## Constraints

- No work on the interior layout solver. No corridor generation, no
  corridor-area minimisation, no changes to expansion or elastic-growth rules.
- Derive, don't store. The view is display state only.
- Do not change the `dwelling-unit` export or `docs/bridge-format.md`. That
  contract is being rewritten in a separate piece of work and a change here
  would collide with it.
- Touch nothing under `docs/` and do not run `docs/build-pdf.py`. Instead
  report which files under `docs/` and which parts of `README.md` now describe
  an out-of-date rule set, and whether each is generated or hand-maintained.
- The new rule never blocks placement, save or export.
- Commit this run's own record as the skill says, and do not push.
- If the browser pane is hidden, stop at `tsc` and `npm run build`, say so
  plainly, and give the manual steps to check the two behaviours by hand.

## What I need back

Quote raw command output rather than summarising it, and state the verification
rung for each claim separately.

1. The vocabulary from task 1, in full.
2. What the interface view hides and keeps, as the actual list the code filters
   on, with the bedroom-tint flag's location.
3. The evidence that turning the view off restores the scene exactly.
4. The new rule as it appears in `RULES`, quoted, with file and line range, and
   the severity field you added if any.
5. Four screenshots: rule firing, rule clearing, view on, view off.
6. `tsc` and `npm run build` output.
7. The stale-documentation list from the constraints, generated versus
   hand-maintained.
8. Anything you found that contradicts the Assumptions section.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
