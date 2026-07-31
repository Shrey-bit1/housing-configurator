---
id: "0017"
title: Finish the reskin, bottom sheet and copy rewrite
created: 2026-07-31
---

## Context

Shrey opened the app, saw the old chrome, and the reason is only that the
reskin lives on `reskin-1a` while run 0016 correctly returned the tree to
`main`. His instruction: finish the whole reskin as asked from the
beginning. This run completes README Part 2 on the branch, stage 2e, the
layout-check bottom sheet, and stage 2f, the copy rewrite. When it ends
the branch IS the finished Paper studio, and the tree is left on the
branch so a reload shows it. Merging stays Shrey's decision, deadline
Monday evening.

The spec is still Part 2 of
`D:\_Studies\_DFAB\DFAB\_T3\App UI polish options\design_handoff_drag_drop_polish\README.md`,
direction 1a. Re-read its layout-check and copy sections before building;
the README's values are final.

## Assumptions

These may be wrong; check rather than trust, contradict rather than work
around, and make sensible choices where silent, recorded in the report.

1. `reskin-1a` sits at `6245c08`, six commits ahead of `main` at
   `978856f`, and the tree on `main` is clean apart from untracked
   `captures/`. All work this run happens on the branch; `main` gains
   only the bridge record.
2. The sheet REPLACES the vertical validation panel. The container keeps
   the id `#validation-panel` so the bridge's DOM reads keep working; if
   the structure truly demands a new id, the report says so loudly and
   names the new selector.
3. The copy rewrite changes display text only: the tier vocabulary and
   severity chips in `src/ui/validationPanel.ts`, the README's rule
   table, `docs/rules-list.html` and `docs/rules-reference.html`. Rule
   ids, the `Severity` type and everything `validate()` returns stay
   exactly as they are, so `src/core/rules.test.ts` stays green
   untouched; if it needs an edit, the change has gone too deep.
4. `Circulation` shows as `Hall` in the palette display only; every id
   stays `circulation`.
5. Canonical counts before this run: flat-1 `12 issues (1 hard,
   11 soft)`, no-stair `7 issues (1 hard, 6 soft)`. After 2f the words
   become Must fix / Worth a look / Note and the COUNTS must survive;
   the report quotes the sheet's full content per fixture as the new
   branch baseline.
6. Escape currently arbitrates drag-abort and must not gain a second
   meaning. The sheet closes by its close control and by pressing Check
   Layout again.
7. `window.__app.capture()` writes a 0-byte PNG when the pane is not
   compositing while reporting ok; every capture this run trusts gets a
   byte-count check. The sheet is DOM, so its evidence is pane
   screenshots, named as such.
8. Run 0014's audit found the x-ray naming in four places and the
   tooltip is already fixed; the remaining sites get the Structure
   view's true description in 2f.

## Task

0. **Restart the dev server, clear `node_modules/.vite`, probe the
   pane,** then `git checkout reskin-1a`.

1. **Stage 2e, the layout-check bottom sheet,** commit
   `reskin: layout check sheet`. The sheet is 256px tall spanning the
   viewport with a hairline on top. The header row carries
   `LAYOUT CHECK`. A 340px summary block holds a proportional 8px
   severity bar over the counts, the metrics lines (circulation share,
   depth from entrance) and a close control. Below it a horizontally
   scrolling rail of 300px cards, each with a 3px top border in its
   severity colour, one card per issue with the content the vertical
   panel carried for that issue; where the README is silent on how
   grouped duplicates (`OR1 ×2`) present, make a sensible choice and
   record it. Wheel events scroll the rail horizontally, calling
   `preventDefault` only while the rail can still scroll that way, so a
   trackpad never traps the page. While the sheet is open `#bottom-left`
   and `#view-controls` lift to `bottom: 272px`; on close they return.
   Check Layout opens and refreshes it; opening runs `--dur-panel` with
   `--ease-out`, and nothing loops after arrival.

2. **Stage 2f, the copy rewrite,** commit `reskin: copy`. hard →
   `Must fix`, soft → `Worth a look`, note → `Note` in the sheet's tier
   vocabulary and chips, the README's rule table and both docs pages.
   `Circulation` shows as `Hall` in the palette. The remaining x-ray
   sites per assumption 8, and anything else Part 2's copy section
   names.

3. **Machinery after each stage:** `tsc` clean, boot via
   `?project=flat-1-two-storey.json`, no console errors; the loader,
   `window.__app`, captures, the four display toggles and plan mode all
   live.

4. **Re-baseline on the branch.** Both fixtures through the loader, the
   sheet's full content quoted as the NEW canonical texts; the counts
   must read 12 (1 must fix, 11 worth a look) and the no-stair
   equivalent of 7, with any numeric drift a stopping defect.
   `npm test`, `npm run test:slow` (the one `it.fails` stays
   failing-as-expected), `npm run build`.

5. **Evidence.** Pane screenshots of the sheet open on flat-1 with the
   summary block and rail visible, and of the palette showing Hall;
   canvas captures only where the claim is in the scene, each
   byte-checked. Numeric proofs for the overlay lift (both `bottom`
   values, open and closed) and for the wheel handler's condition.

6. **`PROJECT_STATE.md`** on the branch: the sheet's wiring and the
   copy mapping.

7. **The record, then the tree back on the branch.** `git checkout
   main` so the report, the LOG row and the prompt's move land there;
   after the record commit, `git checkout reskin-1a` and leave it, so
   Shrey's next reload shows the finished reskin. State both tips in
   the report.

If the run runs long: the sheet lands whole rather than rough, since its
interaction is the risk; 2f's docs pages may slip to a follow-up, the
panel vocabulary may not.

## Constraints

- All work on `reskin-1a`; `main` gains nothing but the record. Never
  push either branch.
- No new dependencies, no React, no build-system changes; features are
  regrouped, never removed.
- Rule ids, severities, `validate()` data, the export, the fixtures and
  the loader untouched in substance.
- Escape keeps its single meaning. Nothing loops after arrival; three
  durations only; focus rings `--violet`.
- If the pane dies, keep building; DOM proofs continue and captures
  defer to a listed manual walk.

## What I need back

Rungs per claim; raw output over summary.

1. Pane state, then every commit hash with one-line stats, and both
   tips, branch and `main`.
2. The sheet: what the README specified versus what exists, with the
   wheel condition quoted and the lift values measured open and closed.
3. The copy: every string changed, file and before → after.
4. The two NEW canonical sheet texts in full.
5. Machinery proof after the final stage.
6. The evidence set with byte sizes, pane shots named as pane shots.
7. Contradictions with the Assumptions, then your own assumptions with
   effects.

The report follows `WRITING.md`: connected sentences that carry their
own logic, no em dashes as glue, no contrast flourishes, neutral voice,
plain words, prose before any list or table, and every number exact.
