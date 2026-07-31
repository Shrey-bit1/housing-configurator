---
id: "0015"
title: Drag gesture trial from the Claude Design handoff
created: 2026-07-31
---

## Context

Claude Design produced a handoff bundle, reviewed by the planning session:
`D:\_Studies\_DFAB\DFAB\_T3\App UI polish options\design_handoff_drag_drop_polish\`.
Its README is the authoritative spec; read it first (Part 1 only). The
`.dc.html` files are DESIGN REFERENCES, never production code; `Drag
Test.dc.html` shows the intended feel, and its CSS-3D technique is explicitly
not to be ported. This run implements Part 1, the drag-to-place gesture, in
the app's own environment: plain TypeScript, the existing `GhostPreview`
mesh, `src/style.css`. Part 2, the chrome reorganisation, is OUT OF SCOPE
for this run; it follows on a branch in prompt 0016.

The handoff also identifies a real defect: `dragDrop.onUp` commits without
re-checking validity, so a red ghost still places. That fix ships first
inside this run.

This is a trial: Shrey judges the result by dragging rooms for one minute.

## Assumptions

These may be wrong. Where a task depends on one, check it rather than
trusting it, and say in the report if it does not hold. Contradicting this
section is more useful than working around it. Beyond that: where this
prompt is ambiguous or silent, make a sensible choice, keep going, and
record it in the report's own-assumptions list.

1. Uncommitted in the tree from run 0014 and the A0001 sync: the orientation
   preference work (`rules.ts`, `projectIO.ts`, `floorManager.ts`,
   `orientation.ts`, `palette.ts`, `README.md`, `PROJECT_STATE.md`,
   `vitest.slow.config.ts`, the two new test files, `package.json` if it
   changed), plus `design/`, `.design-sync/`, and two `.gitignore` lines.
   Both canonical panels and all tests were green at that state.
2. The gesture lives in `src/interaction/dragDrop.ts`
   (`startPlacement`/`onMove`/`onUp`), the ghost in
   `src/scene/ghostPreview.ts` with `setGhostValidity` colours in
   `src/scene/moduleMesh.ts`, the palette in `src/ui/palette.ts`, styling in
   `src/style.css`. The handoff's file table says the same.
3. `R` rotate, `M` mirror, Escape arbitration and `controls.enabled = false`
   while placing all exist and must not change.
4. The three motion tokens exist in the design system: tap 150ms, panel
   260ms, hero 420ms, `--ease-out cubic-bezier(.22,.9,.24,1)`. The gesture
   uses tap and panel only; nothing here is a hero.
5. Reading the handoff folder from the repo session may need Shrey's
   one-click approval; he is present. If the folder is unreachable, this
   prompt carries enough of the spec to proceed, and say so in the report.
6. Canonical panels: flat-1 `12 issues (1 hard, 11 soft)`, no-stair
   `7 issues (1 hard, 6 soft)`. Nothing in this run may move them.

## Task

0. **Restart the dev server, clear `node_modules/.vite`, probe the pane.**
   This run's judgment is visual feel; a stale build would poison it.

1. **Commit the backlog, two commits, nothing new in them.**
   First: run 0014's files, message
   `Orientation preference, rules pack, slow suite (run 0014)`.
   Second: `design/`, `.design-sync/`, the `.gitignore` lines, message
   `Design system seed and Claude Design sync (A0001)`.
   `git status --porcelain` before each; anything unexpected is left out and
   reported. `captures/` and `ds-bundle/` stay untracked/ignored.

2. **The commit gate, the bug fix.** In `onUp`, re-run
   `store.canPlaceInstance` for the release cell and bail without placing
   when invalid; track `lastValid` on the controller. On bail: ghost, chip,
   label and grid emphasis clear together (150ms opacity out), the source
   tile returns to full opacity, no shake.

3. **The gesture, to the handoff's values, verbatim.**
   a. Press: source tile dims to `opacity .35` for the whole gesture
      (150ms); tile hover is `translateY(-2px)` with `box-shadow: 0 2px 0
      var(--ink)`, press is `translateY(0) rotate(-.6deg)` shadowless. A
      cursor chip follows the pointer for the ENTIRE gesture including over
      the canvas: mini tile (20px swatch + name + w×d), `rotate(-1.5deg)`,
      1px ink border, `box-shadow: 0 3px 0 var(--ink)`, bg `#ECE8E0`,
      pointer-events none, above the canvas.
   b. Move: the active floor's grid dots rise to full opacity over 260ms
      while placement is live, back on end; one transition, no pulse. The
      ghost tweens to the snapped cell over 150ms ease-out (lerp in the
      render loop is fine); never pixel-tracking, never animating
      `visible`. Full room height as today.
   c. Validity colours replace green/red: valid = fill `rgba(20,19,23,.10)`
      over the room colour at ~55% with 2px `#141317` edges; invalid = fill
      `rgba(210,35,46,.20)` with 2px `#D2232E` edges. A viewport-corner
      label follows: `LIVING ROOM · 7×5 · CELL 12,8` valid,
      `BLOCKED — OVERLAPS A PLACED ROOM` invalid; 600 9px, .1em tracked,
      uppercase, padding 5px 9px, background = edge colour, text `#ECE8E0`.
   d. Release valid: place as today, then the settle: the committed module
      enters 22px above its resting Y at opacity .2 and lands over 260ms
      ease-out. One drop, then still.
   e. Release invalid or off-canvas: task 2's bail.

4. **Tokens, additively.** Introduce only the variables this gesture needs
   into `src/style.css` (`--ink`, `--accent`, `--bg`, `--meta`, the two
   easings, the three durations) without repainting existing chrome; the
   full token swap is Part 2, later. Name them exactly as the design system
   does.

5. **Update `PROJECT_STATE.md`** for the gesture and the bug fix.

6. **Verify.** `tsc`, `npm run build`, `npm test`, quoted. Both canonical
   panels through `?project=`, unmoved. Evidence of feel: if the pane and
   tooling allow a short recording or a burst of drag screenshots (chip
   visible, red state with label, settle mid-drop), attach them; otherwise
   close with the one-minute manual script for Shrey: exact drags to make,
   including one deliberate drop on a red cell to prove the gate, and one
   Escape mid-drag.

If the run runs long: tasks 1, 2 and 3b are the core; 3c and 3d next; 3a's
chip last.

## Constraints

- Part 2 of the handoff is out of scope entirely. No chrome repaint, no
  layout moves, no copy changes.
- No new dependencies, no React, no build-system changes (the handoff's own
  rule). No CSS-3D ports from the prototype.
- Code stays uncommitted apart from task 1's two backlog commits. Never
  push.
- `R`/`M`/Escape behaviour, the export, the rules and both panels are
  untouched.
- Nothing loops after arrival; focus rings stay `--violet` if touched at
  all.
- `npm test` runs alongside `tsc` and the build.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Pane state after the restart, first.
2. Both backlog commit hashes with `git show --stat`.
3. The gate: the `onUp` change quoted, and proof a red-cell release places
   nothing (store count before and after, read from the page).
4. The gesture: what was implemented per 3a–3e, each with its mechanism and
   the exact values used, and where the ghost tween lives.
5. The token additions to `style.css`, quoted.
6. Recording or screenshots, or the one-minute manual script.
7. `tsc`, `npm run build`, `npm test` output, and both panels re-measured.
8. Anything that contradicts the Assumptions section.
9. Your own assumptions, each with what it affected.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
