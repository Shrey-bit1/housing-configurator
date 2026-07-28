---
id: "<0000>"
title: <same title as the prompt>
source: <prompt filename, or "ad-hoc">
status: <complete | partial | blocked>
branch: <git branch>
commit: <short hash at the end of the run>
completed: <YYYY-MM-DD>
---

<!--
The bullets below every heading are ILLUSTRATIVE EXAMPLES from an unrelated run.
Replace them entirely. Never leave them in.

Write "None." under any section that doesn't apply and move on. Do not invent
content to fill a section — a report with three honest "None."s is more useful
than one padded to look thorough.
-->

## Summary

Two to four sentences. What was asked, what happened, where it landed. Written so it
makes sense to someone who has never seen this repository.

## What I did

Concrete actions, each anchored to a location.

- `src/aggregate.py:120-168` — added `aggregate_cells()`; breadth-first walk over the adjacency graph.
- `src/config.py:12` — changed default `min_unit_area` from 28 to 32.
- Created `src/topology/halfedge.py` (94 lines).

## Findings

What the work revealed about the *problem*, not about the code. Include the numbers.

- 412 candidate configurations reduced to 37 after the corner-adjacency constraint.
- Constraint ordering matters: daylight before circulation cuts the search space
  ~4x; the reverse ordering barely helps.

## Evidence

How each number above was produced, so it can be trusted and repeated. Mark anything
not actually executed as **estimated**.

- `python -m scripts.sweep --grid 8x8 --seed 41` — 6.2 s, 412 → 37.
- Memory figure is **estimated** from the structure size, not measured.

## Artifacts produced

Output files, by path, so the planning session can ask for the ones it needs.

- `out/sweep_2026-07-27.csv` — 37 surviving configs, one row each.
- `out/plots/adjacency_hist.png`
- `out/geometry/config_07.3dm`

## Decisions and rationale

Anywhere more than one option was reasonable and one was picked.

- Half-edge structure over a plain adjacency list — needed consistent face traversal
  for the facade step later. Costs roughly 2x memory on the current test set.

## Deviations from the prompt

Where the work went differently from what was asked, and why. Prompts are written in
a session that cannot see this repo, so some of them will be subtly wrong — this is
where that gets caught rather than silently worked around.

## Blocked / did not do

Anything the prompt asked for that isn't there, and what's in the way.

## Open questions for you

Zero to three. Real forks where the *thesis argument*, not the code, decides the
answer. Not "shall I continue?". Write `None.` if the run genuinely raised none —
a manufactured question wastes a planning cycle.

## Suggested next prompt

One concrete next step, specific enough to be pasted almost as-is: what it should
touch and what it should return.
