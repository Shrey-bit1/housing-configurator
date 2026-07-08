# CLAUDE.md — standing conventions for this repo

## Before starting any task
- Read PROJECT_STATE.md first to orient on architecture, data structures, and conventions.

## After completing any feature or bug fix
- Update PROJECT_STATE.md to reflect the change BEFORE reporting back.
  Keep it reference-style and accurate to the actual code (read files, don't recall).
- Run `tsc` and `npm run build`; report clean or explain.

## Architectural conventions (do not violate without discussion)
- Derive, don't store: cluster shells, stair holes, adjacency graph, wall heights
  are always recomputed from source-of-truth placement data, never serialized.
- All placement/collision goes through the shared occupancy map and the
  grid-to-world utilities — never parallel coordinate math.
- Loaded state must go through the same code paths as manually-built state.
- View state (camera, active floor, floor visibility) is never saved in project JSON.
- walls are true-height geometry; stairs are the only scale-stretched element.
- Rules are data in RULES (rules.ts); reference type categories via ctx.is.*,
  not hardcoded room-type lists.
- Every new mutating action (anything that changes placement/entrance/floor source-of-truth) must call commitHistory after committing, and must be verified undoable in testing.