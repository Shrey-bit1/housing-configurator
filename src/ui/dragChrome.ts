import { MODULE_DEFS, type ModuleType } from "../core/modules";
import type { DragGestureState } from "../interaction/dragDrop";

/**
 * The DOM half of the drag-to-place gesture: the cursor chip that follows the
 * pointer and the validity label in the viewport corner. Both are created on
 * first use and reused for every later gesture, because a drag emits a state on
 * every pointer move and rebuilding two elements at that rate is wasteful.
 *
 * This is its own module rather than living in `ui/palette.ts`, which is where
 * the handoff's file table put it. The palette is rebuilt wholesale by
 * `renderSidebar()` whenever floor state changes, and a chip torn down mid-drag
 * because a floor tab re-rendered would be a bug that is tedious to find. The
 * chip belongs to the gesture, not to the panel the gesture started from, so it
 * lives beside the gesture and is driven by the controller's own lifecycle.
 *
 * `dragDrop.ts` owns no DOM and only reports what is happening
 * ({@link DragGestureState}); everything visual is decided here.
 */

let chip: HTMLElement | null = null;
let label: HTMLElement | null = null;

/** The chip: a miniature of the palette tile, centred on the pointer. */
function ensureChip(): HTMLElement {
  if (chip) return chip;
  chip = document.createElement("div");
  chip.id = "drag-chip";
  chip.setAttribute("aria-hidden", "true"); // decorative; the gesture is the message
  document.body.appendChild(chip);
  return chip;
}

/** The validity label. Fixed to the viewport corner rather than tracking the
 *  ghost: the ghost is a 3D object whose screen position needs projecting every
 *  frame, and the design accepts a corner placement. */
function ensureLabel(): HTMLElement {
  if (label) return label;
  label = document.createElement("div");
  label.id = "drag-label";
  label.setAttribute("aria-live", "polite"); // the one part worth announcing
  document.body.appendChild(label);
  return label;
}

/** `7×5` for a module, from its own footprint rather than a hardcoded table. */
function footprintLabel(type: ModuleType): string {
  const def = MODULE_DEFS[type];
  let maxX = 0;
  let maxZ = 0;
  for (const c of def.cells) {
    if (c.cx > maxX) maxX = c.cx;
    if (c.cz > maxZ) maxZ = c.cz;
  }
  return `${maxX + 1}×${maxZ + 1}`;
}

/**
 * Draw the gesture, or clear it when `state` is null.
 *
 * Clearing fades both elements out over `--dur-tap` through a class rather than
 * removing them, so the exit is visible; they stay in the DOM at
 * `pointer-events: none` and cost nothing between gestures.
 */
export function renderDragChrome(state: DragGestureState | null): void {
  const c = ensureChip();
  const l = ensureLabel();

  if (!state) {
    c.classList.remove("on");
    l.classList.remove("on");
    document.body.removeAttribute("data-dragging");
    markSourceTile(null);
    return;
  }

  const def = MODULE_DEFS[state.type];
  const size = footprintLabel(state.type);

  // The chip's content only changes when the type does, which is once per
  // gesture; rewriting it on every pointer move would throw away the browser's
  // layout work sixty times a second for no visible difference.
  if (c.dataset.type !== state.type) {
    c.dataset.type = state.type;
    c.innerHTML = "";
    const swatch = document.createElement("span");
    swatch.className = "dc-swatch";
    swatch.style.background = `#${def.color.toString(16).padStart(6, "0")}`;
    const name = document.createElement("span");
    name.className = "dc-name";
    name.textContent = def.name;
    const dims = document.createElement("span");
    dims.className = "dc-size";
    dims.textContent = size;
    c.append(swatch, name, dims);
  }
  c.style.transform = `translate(${state.pointer.x}px, ${state.pointer.y}px) translate(-50%, -50%) rotate(-1.5deg)`;
  c.classList.add("on");

  // Dim the tile the module came from. Re-applied on every emitted state, so a
  // sidebar re-render mid-gesture repairs itself on the next pointer move.
  // `data-dragging` on <body> is kept as the "a placement is live" signal for
  // anything else that wants it.
  document.body.dataset.dragging = state.type;
  markSourceTile(state.type);

  // Three states, not two. The design names the valid and the blocked strings;
  // the third is "the pointer is not over the plate yet", which happens between
  // pressing a tile and reaching the canvas and on the way back out. Showing
  // BLOCKED there would assert an overlap that does not exist, so the label is
  // simply absent until there is a cell to talk about.
  if (state.cell === null) {
    l.classList.remove("on");
  } else {
    l.textContent = state.valid
      ? `${def.name} · ${size} · CELL ${state.cell.cx},${state.cell.cz}`
      : "BLOCKED — OVERLAPS A PLACED ROOM";
    l.classList.toggle("invalid", !state.valid);
    l.classList.add("on");
  }
}

/** Put `is-drag-source` on the palette tile for `type` and take it off every
 *  other. Cheap: the palette holds fewer than twenty tiles, and this runs on
 *  pointer moves rather than per frame. */
function markSourceTile(type: ModuleType | null): void {
  const tiles = document.querySelectorAll<HTMLElement>(".palette-item[data-module-type]");
  for (const tile of tiles)
    tile.classList.toggle("is-drag-source", type !== null && tile.dataset.moduleType === type);
}
