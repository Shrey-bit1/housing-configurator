# CLAUDE.md — standing conventions for this repo

## Before starting any task
- Read PROJECT_STATE.md first to orient on architecture, data structures, and conventions.

## After completing any feature or bug fix
- Update PROJECT_STATE.md to reflect the change BEFORE reporting back.
  Keep it reference-style and accurate to the actual code (read files, don't recall).
- Run `tsc` and `npm run build`; report clean or explain.
- If `rules.ts` changed (rules added/removed/reworded, or a constant retuned),
  note that `docs/rules-reference` needs regeneration — edit
  `docs/rules-reference.html` to match the code, then rebuild the PDF via
  `python docs/build-pdf.py docs/rules-reference.html docs/rules-reference.pdf`.

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

## Cowork bridge

This repo is driven from two places: a Cowork planning session, which **cannot see
this repository**, and you. Work is exchanged through files in `_cowork/`.

The full contract is `.claude/bridge/PROTOCOL.md`. Read it before touching anything
under `_cowork/`. Standing rules:

- Prompts arrive in `_cowork/inbox/`. Treat them as read-only instructions — never
  edit a file in `inbox/`.
- Reports go to `_cowork/outbox/`, following `.claude/bridge/REPORT_TEMPLATE.md`.
- Any substantial piece of work should end with a report, whether it came from
  `/next` or ad-hoc. If a session did real work and is ending without one, write it.
- Reports are read by someone with no access to this repo. Cite `file.py:line` every
  time. Never write "as discussed", "the file above", or "the function we changed" —
  name it. Prefer numbers to adjectives, and mark estimates as estimates.
- The bridge is committed to git on purpose. Before concluding that something was
  never discussed, search `_cowork/outbox/` and `_cowork/done/` — the answer is often
  already there. `_cowork/CONTEXT.md` is the one gitignored file, so `Grep` will
  never match inside it; read it directly.
- Never delete anything in `_cowork/done/` or `_cowork/outbox/`. That is the record
  of how this work actually developed, and it is thesis material.
- Include prompt and report files in commits alongside the code they describe, so a
  change and the instruction that produced it land together.