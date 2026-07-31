---
id: "0015"
title: Drag gesture trial from the Claude Design handoff
source: 0015-drag-gesture-trial-from-the-claude-design-handoff.md
status: complete
branch: main
commit: 9619a6c
completed: 2026-07-31
---

## Summary

Part 1 of the handoff is built. The commit gate that was the handoff's own bug
report ships with it, and all five steps of the gesture are in: the source tile
dims, a cursor chip follows the pointer over the canvas, the grid rises while a
placement is live, the ghost tweens between snapped cells instead of jumping,
validity reads as ink versus accent red with a label naming the cell, and a
committed module settles from above. Both backlog commits landed first, nothing
else rode along, and both canonical panels are unmoved at `12 issues (1 hard, 11
soft)` and `7 issues (1 hard, 6 soft)`.

One finding matters more than the rest and it is a design question rather than a
defect. The Living Room's own colour is #d32f2f, so under the new scheme its
VALID ghost renders #c92d2d against an INVALID #d2232e. Those are the same red.
The handoff retired green because it competed with the balcony green; the accent
competes with the living room in exactly the same way, and the living room is the
most-placed module in the palette. Every other room type reads cleanly.

## What I did

**Task 0.** Cleared `node_modules/.vite`, started a fresh dev server on 5173,
probed the pane.

**Task 1.** Two commits, `60ab463` and `9619a6c`.

**Task 2.** The gate in `src/interaction/dragDrop.ts`, `onUp`.

**Task 3.** The gesture across `src/interaction/dragDrop.ts`,
`src/scene/ghostPreview.ts`, `src/scene/moduleMesh.ts`, `src/scene/gridView.ts`,
`src/style.css`, `src/main.ts`, and one new file `src/ui/dragChrome.ts`.

**Task 4.** Eight tokens added to `src/style.css`, one existing value moved.

**Task 5.** `PROJECT_STATE.md` gained §2r.

**Task 6.** `tsc`, build and tests quoted below; both panels re-measured; four
canvas captures plus two pane screenshots, and the manual script.

## Findings

### 1. Pane state after the restart

Hidden at the first probe, then made visible on request mid-run, so this run has
both kinds of evidence.

Worth recording because it will happen again: **`window.__app.capture()` writes a
0-byte PNG when the pane is hidden.** It reports `{ok: true}` and the file
appears, so a run that does not open the result would believe it had captured
something. The cause is that `canvas.toDataURL()` returns nothing usable when the
page is not compositing; the render call itself succeeds. Once the pane was
shown, the same call produced a 33445-byte file. A future run should check the
byte count, not the return value.

A second limit of the capture sink, independent of visibility: it records the
WebGL canvas only, so the cursor chip and the validity label, which are DOM, are
absent from every `captures/drag-*.png`. The pane's own screenshot does include
them, which is where the chrome evidence below comes from.

### 2. Both backlog commits

```
commit 60ab463b33eb09e68403a732bf44db3270f9aa91
    Orientation preference, rules pack, slow suite (run 0014)

 PROJECT_STATE.md                 | 172 ++++++++++++++++++++--
 README.md                        |   1 +
 package.json                     |   3 +-
 src/core/floorManager.ts         |  11 ++
 src/core/orientation.ts          |  33 +++++
 src/core/projectIO.ts            |  28 +++-
 src/core/rules.test.ts           | 302 +++++++++++++++++++++++++++++++++++++++
 src/core/rules.ts                |  60 +++++++-
 src/core/unitExport.slow.test.ts | 200 ++++++++++++++++++++++++++
 src/core/unitExport.ts           |   2 +-
 src/main.ts                      |  12 +-
 src/scene/entranceView.ts        |  27 +++-
 src/ui/palette.ts                |  86 +++++++++++
 vite.config.ts                   |   7 +
 vitest.slow.config.ts            |  20 +++
 15 files changed, 941 insertions(+), 23 deletions(-)
```

```
commit 9619a6c836a85590ef16a6355d1dc4ae3cac950a
    Design system seed and Claude Design sync (A0001)

 .design-sync/NOTES.md                  |  42 ++
 .design-sync/config.json               |   7 +
 .design-sync/conventions.md            |  57 ++
 .gitignore                             |   3 +
 design/README-sync.md                  |  63 ++
 design/controls-buttons.html           | 219 ++++++++
 design/controls-toggles.html           | 201 +++++++
 design/foundations-motion.html         | 197 +++++++
 design/foundations-tokens.html         | 233 ++++++++
 design/moments-interface-dissolve.html | 297 ++++++++++
 design/panels-palette.html             | 268 +++++++++
 design/panels-toast.html               | 175 ++++++
 design/panels-validation.html          | 274 +++++++++
 13 files changed, 2036 insertions(+)
```

Nothing unexpected was left out. `captures/`, the three untracked `docs/`
research files, and `_cowork/` were all excluded; `_cowork/LOG.md` carries the
A0001 row and belongs to this run's own bridge commit rather than to either
backlog commit.

### 3. The gate

`src/interaction/dragDrop.ts`, `onUp`:

```ts
const cell = this.overCanvas(e)
  ? this.picker.cellAt(e.clientX, e.clientY)
  : null;
// THE GATE. Re-ask rather than trusting `lastValid` alone, because a release
// can land on a cell no move event reported: a click without motion never
// fires pointermove, and the pointer can leave and re-enter the canvas
// between the last move and the release.
const cells = cell
  ? occupiedCells(MODULE_DEFS[this.activeType], cell, this.rotation, this.mirrored)
  : [];
const valid =
  cell !== null && this.store.canPlaceInstance(MODULE_DEFS[this.activeType], cells);
if (valid && cell) {
  const placed = this.store.place(this.activeType, cell, this.rotation, this.mirrored);
  if (placed) settleDrop(placed.group);
}
this.cancelPlacement();
```

`lastValid` is tracked on the controller as the handoff's state note asks, and it
drives the label and the ghost colour; the commit re-asks the store rather than
reading it, for the reason in the comment.

**Proof, read from the page on `flat-1-two-storey.json`.** A synthetic press on
the Living Room tile, a move to the canvas centre, which sits over the middle of
the flat and is solidly occupied, then a release there:

```json
{"before": 24, "after": 24,
 "mid": {"chipOn": true,
         "labelText": "BLOCKED — OVERLAPS A PLACED ROOM",
         "labelInvalid": true,
         "sourceDimmed": true,
         "bodyDragging": "living"},
 "afterChipOn": false, "afterSourceDimmed": false}
```

The store is unchanged across the release, and every piece of gesture chrome
cleared together. The same script against a free cell gives `{"before": 24,
"after": 25}` with the new instance at origin `{cx: 0, cz: 0}`, so the gate
blocks the invalid case without blocking the valid one.

### 4. The gesture, 3a to 3e

**3a, press.** The source tile takes `opacity: .35` for the whole gesture via an
`is-drag-source` class that `ui/dragChrome.ts` re-applies on every emitted state,
so a sidebar re-render mid-drag repairs itself on the next pointer move rather
than losing the dim. CSS cannot match one attribute against another, which is why
this is a class rather than a `body[data-dragging]` descendant selector;
`data-dragging` is still set on `<body>` as the "a placement is live" signal.
Tile hover is `translateY(-2px)` with `box-shadow: 0 2px 0 var(--ink)` and press
is `translateY(0) rotate(-.6deg)` shadowless, both at `--dur-tap`. The chip is a
20px swatch, the name and `w×d`, `rotate(-1.5deg)`, `1px solid var(--ink)`,
`box-shadow: 0 3px 0 var(--ink)`, `background: var(--bg)`, `pointer-events: none`,
`z-index: 60`. It stays visible over the canvas, which the handoff explicitly
reinstated. Its content is rebuilt only when the dragged type changes rather than
on every pointer move.

**3b, move.** Grid emphasis lives in `src/scene/gridView.ts` as `setEmphasis` plus
a `tick(dt)` ramp over 260 ms, one transition each way and no pulse; measured
mid-drag at `emphasis: 0.836` and back to `0` after release. It is a COLOUR ramp
from the resting #b0a99c toward #141317 rather than an opacity ramp, because the
dots are opaque on purpose and fading them would reintroduce the depth-sort
artifacts `setDimmed` avoids. Only the active floor lights.

**The ghost tween lives in `src/scene/ghostPreview.ts`**: `update` sets
`this.target` and `tick(dt)` eases `group.position` toward it with an exponential
lerp on a 150 ms constant, called from `main.animate` with a real frame delta
clamped to 0.1 s so a backgrounded tab does not teleport every tween on resume.
The first cell of a gesture lands outright, so the ghost appears where the pointer
is instead of sliding in from the previous gesture's cell. `visible` is never
animated and the ghost keeps full room height.

**3c, validity.** Verified by calling `setGhostValidity` directly on a freshly
built Living Room ghost and reading the material back:

```json
{"defColor": "#d32f2f", "built": "#d32f2f",
 "afterValid": "#c92d2d", "afterValidOpacity": 0.55,
 "afterInvalid": "#d2232e",
 "backToValid": "#c92d2d", "storedBase": "#d32f2f"}
```

The base colour is captured once and stored on the group, so flipping back and
forth is lossless. Two values depart from the spec and both are recorded in the
code. The invalid fill is 0.45 rather than 0.20, because 0.20 is an alpha chosen
over paper and a ghost at that alpha is not visible against a lit 3D scene at
room height. The 2px edge weight is not implemented at all: three.js
`LineBasicMaterial.linewidth` is ignored by every browser's WebGL renderer and
always draws 1px, and widening it needs a line library, which would be a new
dependency. Only the edge colour carries the state.

The label reads `Living Room · 7×5 · CELL 0,0` when valid and `BLOCKED —
OVERLAPS A PLACED ROOM` when not, uppercased in CSS, `600 9px/1`, `.1em`
tracking, `5px 9px` padding, background following the edge colour, text #ece8e0.

**A third label state was added.** Between pressing a tile and reaching the
canvas there is no cell at all, and the two specified strings do not cover it. A
trace caught the label reading `BLOCKED — OVERLAPS A PLACED ROOM` at that moment,
which asserts an overlap that does not exist, so the label is now hidden until
there is a cell to talk about:

```
{"after": "down", "label": "BLOCKED — OVERLAPS A PLACED ROOM"}   ← before the fix
{"after": "move", "label": "Living Room · 7×5 · CELL 0,0", "invalid": false}
{"after": "up",   "count": 25}
```

**3d, release valid.** `settleDrop` in `ghostPreview.ts` raises the committed
group 0.55 world units, sets its materials transparent at opacity 0.2, and
`tickGhostAnimations(dt)` eases both back over 260 ms. Sampled 70 ms after a
commit the module sat at `y: 0.042` above a resting `y: 0`, and 400 ms later at
`y: 0` exactly. The settle list is module-level rather than a field on the ghost,
because the ghost is cleared the instant the placement commits while the module
keeps falling. On arrival the materials are restored to `opacity: 1` and
`transparent: false` exactly, so a settled module sorts against the cutaway like
its neighbours instead of carrying the last frame's arithmetic.

**3e, release invalid or off-canvas.** Task 2's bail, and the measurement in
finding 3 shows chip, label and source dim all clearing together with no shake.

### 5. Token additions

`src/style.css`, appended to the existing `:root`:

```css
  --accent: #d2232e; /* Re_Configure --accent: active and failing only */
  --canvas-bg: #e4e0d6;

  /* ------------------------------------------------------------------
     Re_Configure design-system tokens, introduced for the drag gesture
     (run 0015). ADDITIVE ONLY: existing chrome still reads the Bauhaus
     names above, and the full swap is Part 2 of the handoff. --accent
     is the one name that already existed; its value moved from #d32f2f
     to the system's #d2232e, which is the same red a hair cooler.
     ------------------------------------------------------------------ */
  --ink: #141317; /* text, rules, filled controls */
  --bg: #ece8e0; /* ground / paper */
  --meta: #6d6a62; /* captions, counts */

  --dur-tap: 150ms; /* press, hover, ghost snap, validity flips */
  --dur-panel: 260ms; /* sheets, grid emphasis, the drop settle */
  --dur-hero: 420ms; /* view changes only */
  --ease-out: cubic-bezier(0.22, 0.9, 0.24, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* hero motion and toasts only */
```

`--accent` is the one token that already existed. Introducing it at the design
system's value repaints existing red chrome from #d32f2f to #d2232e, which is
the only repaint in this run; leaving it would have meant two different reds
under one name while the invalid ghost had to be #d2232e. `--line` was NOT
touched: it exists at #000000 and means something different from the design's
#C9C5BB hairline, and redefining it would repaint every panel border.

### 6. Evidence

Two pane screenshots carry the chrome, because the capture sink cannot (finding
1). Held mid-drag over an occupied cell, the frame shows all five pieces at once:
the cursor chip on the canvas as a paper mini-tile with a red swatch reading
`Living Room 7×5`, the label at top left on accent red reading `BLOCKED —
OVERLAPS A PLACED ROOM`, the Living Room palette tile visibly dimmed against its
neighbours, the grid dots darkened well past their resting grey, and the ghost
standing at full room height.

Four canvas captures are in `captures/`, all geometry and no chrome:
`drag-1-invalid.png`, `drag-2-valid.png`, `drag-3-settle.png` at 80 ms into the
drop, and `drag-4-rest.png`.

**The one-minute manual script**, since the trial is judged by hand:

1. Open `http://localhost:5173/?project=flat-1-two-storey.json` and wait for the
   flat to appear.
2. Press and hold the Living Room tile. The tile should dim and tip; a chip
   should appear under the cursor. Do not move yet: no label should be showing.
3. Drag onto the plate. The label appears, the grid darkens, and the ghost should
   arrive at each new cell with a short glide rather than a jump.
4. Move over the middle of the flat. The ghost and the label should both go red.
   **Release there.** Nothing should be placed and everything should vanish at
   once. This is the bug the handoff reported.
5. Press the Kitchen tile and drag to an empty corner. Press `R` twice and `M`
   once mid-drag; the ghost should re-pose and the label should keep naming the
   current cell.
6. Release on a free cell. The kitchen should drop in from slightly above and
   settle once.
7. Press the Bedroom — Small tile, drag onto the plate, and press Escape
   mid-drag. Everything should clear and nothing should be placed.
8. Finally, drag a Living Room over an occupied cell and then a free one, and
   watch the ghost colour. This is the open question: on the living room those
   two states are nearly the same red.

### 7. `tsc`, build, tests, both panels

```
$ npx tsc --noEmit
(no output, exit 0)
```

```
$ npx vitest run
 Test Files  3 passed (3)
      Tests  33 passed (33)
   Duration  4.09s (transform 2.72s, setup 0ms, import 3.91s, tests 575ms)
```

```
$ npm run build
> tsc && vite build
dist/assets/index-CVMmtGqS.css     16.93 kB │ gzip:   3.42 kB
dist/assets/index-DrxUWCgc.js   3,378.11 kB │ gzip: 398.18 kB
✓ built in 25.84s
```

Both panels, re-measured through `?project=` after the gesture work:

```
flat-1-two-storey.json   12 issues (1 hard, 11 soft)
flat-1-no-stair.json      7 issues (1 hard, 6 soft)
```

Unmoved, as assumption 6 requires. The chunk-size warning is pre-existing.

### 8. What contradicts the Assumptions section

**Assumption 1** was right about the files but did not mention `_cowork/LOG.md`,
which carries the A0001 row. It was left for this run's bridge commit rather than
folded into either backlog commit.

**Assumption 2** held. The gesture is where it said, and the handoff's file table
matched, with the one addition described under Deviations.

**Assumption 3** held and is verified: `R`, `M`, Escape and
`controls.enabled = false` are unchanged. `R` and `M` now also refresh the
validity they had always been able to invalidate, which is new behaviour in the
LABEL rather than in the keys.

**Assumption 4** held. Only tap and panel are used; nothing here is a hero, and
`--dur-hero` is defined but unused, which is deliberate so Part 2 does not have
to reopen the token block.

**Assumption 5** held. The handoff folder was reachable and the README was read
in full before any code was written.

**Assumption 6** held. Both panels are unmoved.

### 9. My own assumptions and choices

I **put the chip and label in a new `src/ui/dragChrome.ts`** rather than in
`palette.ts`, where the handoff's file table put them. `renderSidebar()` rebuilds
the palette wholesale whenever floor state changes, and a chip destroyed mid-drag
because a floor tab re-rendered is a bug that is tedious to find. Affects: one
file more than the table predicts, and the palette keeps one job.

I **kept `dragDrop.ts` free of DOM**, emitting a `DragGestureState` that `main.ts`
turns into chrome. Affects: the controller can be reasoned about without the
stylesheet, and the grid emphasis could be wired in the same place as the chip.

I **used a colour ramp for grid emphasis** rather than opacity, for the
depth-sort reason above. Affects: the dots darken rather than fade in.

I **set the invalid ghost to 0.45 opacity rather than the specified 0.20**, and
**left the 2px edges at 1px**, both because the spec's values do not survive the
move from paper to a 3D scene. Affects: the invalid state is visible; the edge
weight is not as designed and cannot be without a dependency.

I **added a third label state** for "no cell yet", because the two specified
strings would otherwise make the label assert a false overlap.

I **made `R` and `M` re-emit** so the label cannot go stale after a re-pose. The
gate re-checks on release regardless, so this is a display fix rather than a
correctness one.

I **moved `--accent` to #d2232e**, the one repaint in this run, for the reason in
finding 5.

I **clamped the frame delta to 0.1 s** in `main.animate`, so a tab resuming from
the background does not finish every tween in a single frame.

## Artifacts produced

- `captures/drag-1-invalid.png`, `drag-2-valid.png`, `drag-3-settle.png`,
  `drag-4-rest.png` — the canvas at four moments of one gesture. Geometry only;
  the chip and label are DOM and do not appear in these.
- `src/ui/dragChrome.ts` — the cursor chip and validity label.
- The two pane screenshots are in the run transcript rather than on disk, because
  the pane's screenshot does not write a file.

## Decisions and rationale

**Re-asking the store in `onUp` instead of trusting `lastValid`.** The rejected
alternative was gating on the tracked flag alone, which the handoff's state note
suggests. It loses on two real paths: a press-and-release without any motion
never fires `pointermove`, so `lastValid` would still be its initial `false` and
a legitimate click-to-place would silently do nothing; and the pointer can leave
and re-enter the canvas between the last move and the release. The flag is still
tracked, because the label and the ghost colour need it.

**A module-level settle list rather than per-ghost state.** The settle outlives
the ghost by 260 ms, so hanging it off the ghost would mean either delaying
`clear()` or losing the animation.

## Deviations from the prompt

**One extra file, `src/ui/dragChrome.ts`**, against the handoff's five-file
table. Reasoning under finding 9.

**Two spec values not met exactly**, the invalid fill alpha and the 2px edge
weight, both described in finding 4 with the reason.

**`src/scene/gridView.ts` and `src/main.ts` were also touched**, which the file
table does not list. The grid emphasis and the render-loop tick have nowhere else
to live.

## Blocked / did not do

Nothing was blocked. Part 2 was not started, which is the prompt's own scope.

## Open questions for you

**1. What should the valid ghost look like on a red room?** The measured values
are the whole question: Living Room's own colour #d32f2f, valid ghost #c92d2d,
invalid ghost #d2232e. The rule that produced this is sound, and the handoff's
reasoning for retiring green is sound, but the result is that the most-placed
room in the palette has a valid state and an invalid state that a person cannot
tell apart. Three ways out, each with a cost. Make valid a much stronger ink pull,
say half rather than a tenth, which weakens "the room still reads as itself".
Give invalid a second channel that is not hue, such as a dashed outline or a
hatch, which adds a mark the design system does not have. Or accept that the
accent is reserved and change the LIVING ROOM's colour in Part 2's token swap,
where the design system already names it #C13A2E rather than the app's current
#d32f2f. The third is the only one that removes the collision at its source, and
it is a change to the room palette, which is a bigger decision than a ghost.

**2. Is the label in the right place?** It sits at the viewport's top left, which
the handoff allows, and in practice the eye is on the ghost at the far side of
the plate. The chip is already at the pointer and already carries the room name
and size; the only thing the label adds is the cell coordinate and the blocked
message. It may be that the chip should carry the validity colour and the label
should not exist, which would be one fewer thing following the pointer.

**3. Should the grid emphasis apply to the whole plate or only the reachable
part?** Right now the entire active floor's dots darken. On a 25×25 grid holding
a small flat, most of what lights up is area the user will never place in. Lighting
only the cells within some radius of the pointer, or only the cells the current
footprint could legally occupy, would make the emphasis say something about the
placement rather than about the floor.

## Suggested next prompt

Settle open question 1 first, because it decides a value Part 2 will bake in, and
then run Part 2's shell on a branch.

For the ghost: try all three options on `testflats/flat-1-two-storey.json` and
capture each. The ink-pull variant is one constant in `src/scene/moduleMesh.ts`
(`GHOST_INK_MIX`, currently 0.1). The second-channel variant means giving the
invalid ghost a dashed or doubled outline in `setGhostValidity`, which is scene
geometry and needs a technique that survives WebGL's 1px line limit. The palette
variant means changing `living` from #d32f2f to the design system's #C13A2E in
`src/core/modules.ts` and re-checking that it still reads against the ghost and
against the balcony green. Capture a valid and an invalid Living Room ghost for
each of the three and report the hex pairs, so the choice is made on measured
contrast rather than description.

Then start Part 2 on a branch, in the order the handoff gives: the top bar and
the segmented MODEL / PLAN / DIAGRAM control first, since it replaces two buttons
whose mutual exclusivity is currently invisible, and it will expose whether the
existing plan-mode and diagram-mode state machines can be driven from one
control. Do not attempt the bottom sheet in the same run.

Both canonical panels stay the acceptance test throughout: `12 issues (1 hard, 11
soft)` on `flat-1-two-storey.json` and `7 issues (1 hard, 6 soft)` on
`flat-1-no-stair.json`. Restart the dev server before checking anything in the
pane, and open any capture written by `window.__app.capture()` to confirm it is
not 0 bytes before trusting it.
