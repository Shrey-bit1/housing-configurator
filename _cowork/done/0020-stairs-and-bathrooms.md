---
id: "0020"
title: Stairs you can climb, and bathrooms in two sizes
created: 2026-08-13
---

## Context

From the 13 August supervisor meeting. The stair a resident places
in a flat is one cell wide, 0.6 m, and that is not enough: the
meeting called the current stair illegal. And the user test showed
the bathroom problem from the other side: the participant wanted a
small bathroom with only a basin and a WC, and the meeting added
that a proper bathroom with a bathtub should exist beside it.

This run gives the editor four real stairs and two real bathrooms.
Fixture work only; no rule changes.

## Skills to use

Read whichever are relevant and use any others you find useful,
then report which you read, what each contributed, and anything
rejected with the reason. `parametric-modeling` for the stair
generator shape; `design-automation` for the fixture rules.
Reference, not instruction.

## Assumptions

These may be wrong. Check rather than trust, contradict rather
than work around. Where the prompt is silent, choose sensibly,
keep going, and record the choice.

1. The tip of main is run 0018's merge. Run 0019 sits pushed and
   unmerged on `run/0019`; do not build on it and do not merge it.
   This run starts from main.
2. The grid cell is 0.6 m. Report the value you find.
3. Multi-storey authoring exists (Unit 2 in the check library has
   two storeys), and a stair is what connects the storeys. Report
   how the editor handles the storey height, and its value.
4. Stairs and bathrooms are placed fixtures like the existing
   serviced modules, and the dwelling-unit v1 export format does
   not change.

## Task

1. Four stairs, commit `stairs: four types at real size`. A
   straight run, a dog-leg, a spiral, and a C-shaped stair.
   - Proportions for all four: riser target 170 mm, tread 270 mm,
     2R+T is 610. The riser count comes from the storey height,
     split evenly across the flights of the type, and the exact
     riser that results is reported, never rounded away.
   - Widths on the grid: the straight flight 1.2 m wide (2 cells).
     The dog-leg 1.8 m total tight or 2.4 m generous (two flights
     of 0.9 or 1.2); pick one as the default, offer the other, say
     which and why. The spiral about 2.4 by 2.4 m (4 by 4 cells),
     a circle in its square. The C-shaped stair runs three flights
     around a well; derive its footprint from the same arithmetic
     and report it.
   - Every riser and tread is drawn at true size, so a flight
     reads correctly from the side.
   - A stair occupies its footprint on BOTH storeys it connects,
     and the upper landing arrives on the upper floor.
   - The old one-cell stair retires. If something depends on it,
     keep it deprecated and hidden from the palette, and say so.
   - Editing the upper storey, the stair below stays visible. The
     stair opening renders see-through, never as a black hole, and
     the lower storey renders translucent, never flat grey, so the
     flight underneath reads through the opening.

2. Two bathrooms, commit `bathrooms: minimal and full`.
   - The minimal WC: basin and WC, 2 by 3 cells, 1.2 by 1.8 m.
   - The full bathroom: bathtub 170 by 75, basin and WC. Default
     4 by 4 cells (2.4 by 2.4 m), compact variant 3 by 4 cells
     (1.8 by 2.4 m). These sizes are proposed, not verified: draw
     the furniture at true size, check everything fits with real
     clearances, and contradict the sizes if they do not.
   - Both are wet rooms and carry whatever the wet interface
     already carries for the existing bathroom.

3. PROJECT_STATE.md updated.

4. The record. Report to
   `_cowork/outbox/0020-stairs-and-bathrooms.report.md`, prompt
   moved to done/, one LOG row. Branch `run/0020`, pushed, so the
   Netlify preview builds. Never main.

If the run runs long: the four stairs land whole; the bathrooms
may follow as a named follow-up.

## Constraints

- Branch `run/0020`, pushed. Never main, no merge of anything.
- The advisory philosophy is untouched: rules advise, never block.
- The dwelling-unit v1 format does not change.
- Names are `Flat N` and `Unit N`, capitalised word, space,
  number.
- No new dependencies. Never stage with `git add -A`.
- Byte-check every capture. Automation traps: dialog close events
  replay late in a burst, and `window.confirm` returns false
  without display.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, and the Netlify preview
   address.
2. The cell size and storey height as found.
3. The stair table: per type, footprint in cells and metres,
   flights, riser count, the exact riser in mm, tread. Prose
   first.
4. The bathroom fit: the furniture drawn at true size in both
   rooms, clearances stated, and the verdict on the proposed
   sizes.
5. Screenshots: all four stairs in the editor palette, each placed
   once, one dog-leg shown on both storeys of a 2-storey flat, the
   upper-storey editing view with the flight below reading through
   the see-through opening over the translucent lower floor, and
   both bathrooms placed with furniture visible.
6. What happened to the old stair.
7. Which skills you read, what each contributed, anything rejected
   with the reason.
8. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain
words, connected prose that carries its own logic, no em dashes as
glue, no contrast constructions, neutral voice, prose before any
list or table, every number exact, and every claim names its
evidence. The reader has no access to this repo, so cite paths and
line numbers.
