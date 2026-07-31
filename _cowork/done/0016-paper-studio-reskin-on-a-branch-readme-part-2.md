---
id: "0016"
title: Paper studio reskin on a branch, README Part 2
created: 2026-07-31
---

## Context

Shrey approved the full chrome reorganisation BEFORE the 4 August review.
The spec is Part 2 of
`D:\_Studies\_DFAB\DFAB\_T3\App UI polish options\design_handoff_drag_drop_polish\README.md`,
direction 1a, "Paper studio", with `Configurator UI.dc.html` as the visual
reference. Implement it exactly: the README's values are final. This prompt
adds only what the README does not: the branch discipline, the order, what
must not break, and how acceptance is measured.

The work happens on a branch so `main` stays demo-ready at all times.
Whether the branch merges is Shrey's decision after his eyes, deadline
Monday evening; an unmerged branch is dropped without damage.

Run 0015 landed the drag gesture, left uncommitted, its report green
end to end. It also measured a real collision: the Living Room's own red
(#d32f2f) renders a valid ghost (#c92d2d) indistinguishable from the invalid
one (#d2232e). The planning session's decision, overridable by Shrey:
this run adopts the design system's ROOM palette at source, which removes
the collision where it lives.

## Assumptions

These may be wrong; check rather than trust, contradict rather than work
around, and make sensible choices where silent, recorded in the report.

1. Run 0015 completed on `main` with `tsc`, build and all tests green and
   both panels unmoved; its gesture work sits uncommitted. Commit it first
   on `main` as `Drag-to-place gesture (run 0015)`; Shrey's visual
   acceptance remains open and a revert stays one command.
2. The README Part 2 is reachable at the path above (Shrey approves the
   read); `Current UI.dc.html` shows today's app for before/after.
3. The chrome lives in `index.html`, `src/style.css`, `src/ui/palette.ts`,
   `src/ui/validationPanel.ts`, `src/main.ts` (overlays, view wiring); the
   loader, `window.__app`, the capture sink, plan mode, the four display
   toggles, compass north-drag, undo/redo and keyboard shortcuts all live
   and must survive.
4. The severity copy rewrite (hard → Must fix, soft → Worth a look, note →
   Note) changes panel TEXT only; rule ids, severities and `validate()`
   data are untouched, so `rules.test.ts` stays green. The canonical panel
   strings change and get re-baselined in this run's report.
5. `Circulation` is relabelled `Hall` in the palette display only; every id
   stays `circulation`.
6. Room colours live in `src/core/modules.ts` on the defs, are never
   serialized, and repaint everywhere on change, ghosts included.
7. Canonical panels before this run: flat-1 `12 issues (1 hard, 11 soft)`,
   no-stair `7 issues (1 hard, 6 soft)`. The COUNTS must survive the
   rewrite even as the words change.
8. `window.__app.capture()` writes a 0-byte PNG when the pane is not
   compositing while still reporting ok (run 0015's finding). Every capture
   this run trusts gets a byte-count check first.

## Task

0. **Restart the dev server, clear `node_modules/.vite`, probe the pane.**

1. **Commit run 0015's gesture on `main`** per assumption 1, then
   **branch:** `git checkout -b reskin-1a`. Every commit until the final
   task lands on this branch.

2. **Implement README Part 2 in this order, committing on the branch after
   each stage so Shrey can bisect his taste:**
   a. Tokens: the full swap of `src/style.css` values to the design set,
      AND the room palette in `src/core/modules.ts` moved to the design
      system's values (`living #C13A2E, kitchen #E8B117, bedS #16336E,
      bedL #274A9E, bath #D8D4CB, rec #B98A2F, out #2E6B4F, circ #141414`).
      Re-measure the Living Room ghost pair afterwards and quote the valid
      and invalid hexes; they must now be tellable apart. Capture one
      valid/invalid pair. Commit `reskin: tokens, paper ground, room
      palette`.
   b. Top bar (mark, project line, MODEL/PLAN/DIAGRAM segmented control
      replacing the two buttons, CHECK LAYOUT, FRAME VIEW, SAVE/OPEN menu,
      `?`), commit `reskin: top bar`.
   c. Left palette: grouped PLACE sections, resizable 248–480 with the
      accent handle, left-edge scrollbar, FLOORS, BRIEF, commit
      `reskin: palette`.
   d. Viewport overlays to three clusters incl. the collapsible Display
      card with the always-visible compass row, commit `reskin: overlays`.
   e. The layout check as the horizontal bottom sheet with the severity
      bar, card rail, wheel-to-horizontal scroll, lifted overlays, commit
      `reskin: layout check sheet`.
   f. Copy rewrite everywhere the README names, including the app README's
      rule table wording and the stale x-ray tooltip at `index.html:77`
      (replace with the Structure view's true description), commit
      `reskin: copy`.

3. **Protect the machinery.** After each stage: `tsc` clean and the app
   boots via `?project=flat-1-two-storey.json` with no console errors. If a
   stage breaks the loader, `window.__app`, captures or a display toggle,
   fix before moving on; those five are the bridge's hands and eyes.

4. **Re-baseline.** With everything landed: both fixture panels quoted in
   full as the NEW canonical texts; counts must read 12 (1 must fix, 11
   worth a look) and 7 equivalents, with any numeric drift a stopping
   defect. `npm test` and `npm run test:slow` green. The one `it.fails`
   export case stays failing-as-expected.

5. **The judgment pack.** Via the loader and `window.__app.capture()`, each
   file byte-checked: the full chrome on flat-1 (axo + each display
   toggle), the plan trio on floor 0, the open layout sheet, the palette at
   min and max width, and the Display card open and closed. Named
   `reskin-*.png` in `captures/`. Where chrome is DOM rather than canvas,
   use pane screenshots and say which is which.

6. **`PROJECT_STATE.md`** gains the reskin section on the branch, including
   what a future session needs to know about the new chrome's wiring.

7. **Return the bridge to `main`.** `git checkout main` as the final task,
   so the record commit, the report, the LOG row and the prompt's move all
   land on `main` and survive even if the branch is dropped. State the
   branch tip hash in the report.

If the run runs long: 2a through 2d are the point; 2e may land rough with
its defects listed; 2f may slip to a follow-up. Never skip tasks 3, 4 and 7.

## Constraints

- All reskin work on `reskin-1a`; `main` gains nothing but 0015's gesture
  commit and the bridge record. Never push either branch.
- No new dependencies, no React, no build-system changes; features are
  regrouped, never removed (the README's own rules).
- Rule ids, severities, `validate()` data, the export, the fixtures and the
  loader untouched in substance.
- Nothing loops after arrival; three durations only; focus rings
  `--violet`.
- If the pane dies, keep building; captures defer to a listed manual walk,
  and DOM proofs (panels, model getters) continue regardless.

## What I need back

Rungs per claim; raw output over summary.

1. Pane state, then the branch point and every stage commit hash with
   one-line stats.
2. Per stage: what the README specified versus what exists, deviations
   listed with reasons.
3. The Living Room ghost pair after the palette change: both hexes and the
   capture.
4. Machinery proof after the final stage: loader boot log, all four display
   toggles plus plan mode driven via the model getters, one byte-checked
   capture written.
5. The two NEW canonical panels in full, plus `npm test` and `test:slow`
   output and `npm run build`.
6. The judgment pack file list with byte sizes, or the manual walk.
7. The branch tip hash, and confirmation the bridge record sits on `main`.
8. Contradictions with the Assumptions, then your own assumptions with
   effects.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
