---
id: "0021"
title: A room that is two storeys tall
created: 2026-08-16
---

## Context

A resident can author a flat over two storeys, and nothing in the
editor says that a room may open into the storey above. The
building app has just measured what that costs. On its reference
building, 1562 stacked cell pairs inside two-storey flats have no
floor drawn between them, because the building side cannot tell a
deliberate double-height room from an ordinary stack of two
rooms. It is shipping a guess in the meantime: a floor at every
seam unless both cells carry the same room id, which is right on
170 of 185 seams and wrong on 15, where a bedroom simply sits
over a bedroom.

The guess is a stopgap with a stated replacement, and this is the
replacement. A room gets an explicit property that says it is two
storeys tall, the property travels in the exported file, and the
building side draws a floor wherever no room claims the void.

The consumer's need, stated plainly so the encoding can serve it:
for every cell of every storey, the building app needs to know
whether the floor above that cell exists.

## Skills to use

Read the SKILL.md files from disk rather than invoking the skill
tool, which has been returning `Unknown skill`. `interoperability`
for the format change and its compatibility rules,
`design-automation` for where a property like this belongs in a
rule system. Report which you read, what each contributed, and
anything rejected with the reason. If none is reachable on disk,
say where you looked. Reference, not instruction.

## Assumptions

These may be wrong. Check rather than trust, contradict rather
than work around. Where the prompt is silent, choose sensibly,
keep going, and record the choice.

1. `main` carries run 0019. Run 0020 was pushed to `run/0020` and
   may still be unmerged, because one question about it is still
   open. Branch from `main`, say what you found, and do not merge
   run 0020: that is Shrey's call and it is not this run's.
2. The cell is 0.6 m and the storey height is derived rather than
   configured: tallest placed room plus one clearance cell, so a
   plain floor is 3.0 m (run 0020 established this).
3. A stair already occupies two storeys. `FloorManager`'s
   `syncStairsAndHoles` claims a footprint on the floor it stands
   on and projects a stairwell hole into the floor above, which
   blocks placement there. A double-height room is the same
   shape of problem, so look there first.
4. The `dwelling-unit` v1 export is the bridge contract. The
   building app reads `cells`, `cellKinds`, `cellRooms` and
   `edges` per storey and nothing else, so anything this run adds
   has to be additive and has to survive a reader that ignores
   it.

## Task

1. The property, commit `rooms: a room can be two storeys tall`.
   A placed room may be marked double height. The room below the
   void claims it, so the room stands on its own floor and takes
   the volume above its own footprint. That volume is blocked for
   placement on the floor above, the way a stairwell is.
   - Say what happens when the floor above already holds
     something over that footprint. Refusing and explaining is a
     fine answer; silently deleting is not.
   - Say what happens to the derived storey height, since the
     room is now 2 storeys rather than 1 and the height rule
     reads the tallest placed room.
   - The room BECOMES double height visually, which is the point
     of the property rather than a side effect of it. Its own
     geometry is drawn two storeys tall: the walls rise through
     both storeys, no ceiling plane is drawn over its footprint
     at the intermediate level, and the space reads as one tall
     room from any viewpoint. On the upper storey the opening
     reads the way run 0020's stairwell openings read, with the
     storey below showing through.

2. The property travels, commit `export: the void crosses the
   bridge`. The exported `dwelling-unit` file carries enough for
   a reader to answer, per cell, whether the floor above that
   cell exists.
   - Choose the encoding and justify it in three sentences. A
     per-cell list of open ceilings is the obvious candidate
     because it answers the consumer's question directly, and a
     room-level property is the obvious alternative because it
     matches how the editor thinks. Pick one and say why.
   - Additive and backward compatible: a file written before this
     run must still load, and its absence of the field must mean
     every seam is floored. Say what the version number becomes
     and why.
   - Document the field in whatever file documents the format,
     with one worked example a reader can copy.

3. A unit that actually uses it, commit `library: a unit with a
   double-height room`. At least one library unit gets a real
   double-height room, exported, so the building side has
   something to read rather than a field that is always empty.
   Say which unit and what changed in it. Every other library
   unit re-exports unchanged apart from the new field, and the
   report says so with counts.

4. The sample for the other repo. Export the unit from task 3 and
   commit it to `_cowork/outbox/0021-double-height-unit.json`, so
   the building repo can be pointed straight at it.

5. Tests and the fixtures. Both fixture baselines hold, quoted
   before and after. New cases cover: a marked room blocks the
   floor above, an unmarked file loads and means all floors
   present, a round trip through save and load keeps the mark,
   and the storey height behaves as task 1 decided.

6. PROJECT_STATE.md updated.

7. The record. Report to
   `_cowork/outbox/0021-a-room-that-is-two-storeys-tall.report.md`,
   prompt moved to done/, one LOG row, committed on `run/0021`
   and pushed, with the preview address.

If the run runs long: tasks 1, 2 and 4 land whole; 3 and 5 follow
named, in that order.

## Constraints

- A new branch `run/0021` from `main`. Never commit to main. Do
  not merge run 0020.
- Commit before opening a file a second time.
- Rules advise and never block. This adds a property and its
  geometry, and no rule may start refusing a layout because of
  it.
- The bridge contract is additive only. Nothing that exists in
  the `dwelling-unit` format changes shape or meaning, because
  the building repo reads it today.
- No new dependencies. Never stage with `git add -A`.

## What I need back

Answer every point with its evidence. Raw output beats summary.

1. Every commit hash with one-line stats, the branch state found
   on `main`, and the preview address.
2. How a resident marks a room double height, in three sentences,
   with three captures: the editor control, the room standing
   two storeys tall in 3D, and the upper storey showing the void
   through its opening.
3. The encoding chosen, the justification, the version decision,
   and the documented example.
4. What happens when the floor above is occupied, and what
   happens to the derived storey height, both with the behaviour
   shown rather than described.
5. Which library unit gained a double-height room, what changed,
   and the counts for every other unit re-exported.
6. The committed sample file's path and what a reader will find
   in it.
7. Test counts before and after, and both fixture baselines.
8. Which skills you read from disk, what each contributed,
   anything rejected with the reason, and where you looked if
   none was reachable.
9. Contradictions with the Assumptions, then your own assumptions
   with their effects.

The report follows the writing rules: short sentences, plain
words, connected prose that carries its own logic, no em dashes as
glue, no contrast constructions, neutral voice, prose before any
list or table, every number exact, and every claim names its
evidence. The reader has no access to this repo, so cite paths and
line numbers.
