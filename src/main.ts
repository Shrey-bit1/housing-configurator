import "./style.css";
import * as THREE from "three";
import { type Grid } from "./core/grid";
import { rotatedCells } from "./core/modules";
import type { Cell } from "./core/grid";
import { FloorManager } from "./core/floorManager";
import { worldNorthDir } from "./core/orientation";
import { createScene } from "./scene/sceneSetup";
import { GhostPreview, tickGhostAnimations } from "./scene/ghostPreview";
import { GroupGhostPreview } from "./scene/groupGhostPreview";
import { Picker } from "./interaction/picker";
import { DragDropController } from "./interaction/dragDrop";
import { SelectionController, type MarkerSelectionAdapter } from "./interaction/selection";
import { updateCutaway, setCutawayEnabled } from "./scene/cutaway";
import { axoFrame } from "./core/previewFrame";
import { setHovered } from "./scene/moduleMesh";
import { createCompassDial } from "./ui/compassDial";
import { computeDwellingGraph } from "./core/adjacencyGraph";
import { validate, computeEntranceDepths, type Violation } from "./core/rules";
import { GraphView } from "./ui/graphView";
import { renderValidationPanel } from "./ui/validationPanel";
import {
  applyRoomHighlights,
  clearRoomHighlights,
  setHoverEmphasis,
  clearHoverEmphasis,
} from "./scene/highlight";
import { EntranceController } from "./interaction/entranceController";
import { DoorController } from "./interaction/doorController";
import { DoubleHeightController } from "./interaction/doubleHeightController";
import { buildPalette } from "./ui/palette";
import { renderDragChrome } from "./ui/dragChrome";
import { showToast } from "./ui/toast";
import { History } from "./core/history";
import {
  serializeProject,
  parseProject,
  ProjectParseError,
  APP_PROJECT_VERSION,
  type ProjectFile,
} from "./core/projectIO";
import { buildUnitExport, type DwellingUnitFile } from "./core/unitExport";
import { unitStats } from "./core/unitStats";
import { slugifyUnitName } from "./library/ids";
import { projectNameFor, unitNameFor, nextFreeNumber, findLibraryEntry } from "./library/naming";
import { parseUnitLibraryIndex, type UnitManifestEntry } from "./library/manifest";
import {
  planOutputs,
  isEmptySelection,
  needsUnitBuild,
  needsRuleConfirm,
  unitGateResults,
  outputLabel,
  type OutputKind,
  type OutputResult,
  type SaveSelection,
} from "./core/savePlan";
import {
  projectFileText,
  unitFileText,
  projectFileName,
  unitFileName,
} from "./core/saveFiles";
import { createUnitBrowser } from "./library/unitBrowser";
import {
  readSession,
  writeSession,
  normalizeCode,
  whyPublishDisabled,
  sessionLine,
  publishUnit,
  publishPreview,
  takeoverConfirmText,
  decideTakeover,
  type FetchLike,
  type SessionSettings,
} from "./session/session";

const DEFAULT_COLS = 16;
const DEFAULT_ROWS = 16;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const sidebar = document.getElementById("sidebar") as HTMLElement;
const resetBtn = document.getElementById("reset-view") as HTMLButtonElement;
const graphCanvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
const topViewBtn = document.getElementById("top-view-toggle") as HTMLButtonElement;
const modelViewBtn = document.getElementById("model-view-toggle") as HTMLButtonElement;
const saveOpenBtn = document.getElementById("saveopen-btn") as HTMLButtonElement;
const saveOpenMenu = document.getElementById("saveopen-menu") as HTMLElement;
const graphFloorLabel = document.getElementById("graph-floor-label") as HTMLElement;
const graphLegend = document.getElementById("graph-legend") as HTMLElement;
const graphToggleTouch = document.getElementById("graph-toggle-touch") as HTMLInputElement;
const graphToggleDepth = document.getElementById("graph-toggle-depth") as HTMLInputElement;
const graphRelayoutBtn = document.getElementById("graph-relayout") as HTMLButtonElement;
const checkBtn = document.getElementById("check-layout") as HTMLButtonElement;
const validationPanel = document.getElementById("validation-panel") as HTMLElement;
// Declared up here rather than beside the file-drop handlers below, because
// `clearValidation` reaches for it and can run during the ?project= load.
const viewport = document.getElementById("viewport") as HTMLElement;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
const selectionReadout = document.getElementById("selection-readout") as HTMLElement;
const selectionText = document.getElementById("selection-text") as HTMLElement;
const shortcutsBtn = document.getElementById("shortcuts-btn") as HTMLButtonElement;
const shortcutsPanel = document.getElementById("shortcuts-panel") as HTMLElement;
const shortcutsClose = document.getElementById("shortcuts-close") as HTMLButtonElement;
const viewControls = document.getElementById("view-controls") as HTMLElement;
const cutawayToggle = document.getElementById("cutaway-toggle") as HTMLButtonElement;
const displayHeader = document.getElementById("display-header") as HTMLButtonElement;
const displayBody = document.getElementById("display-body") as HTMLElement;
const displaySummary = document.getElementById("display-summary") as HTMLElement;
const compassValue = document.getElementById("compass-value") as HTMLElement;
const northBadge = document.getElementById("north-badge") as HTMLElement;
const northBadgeRot = northBadge.querySelector(".nb-rot") as SVGElement;

// ---- Scene ----
const ctx = createScene(canvas);
const { scene, camera, renderer, controls, groundPlane } = ctx;

/** Size the (invisible) ground raycast plane to the active floor's grid plus a
 *  margin so the ghost can still snap — and read invalid (red) — just outside. */
function sizeGroundPlane(grid: Grid): void {
  const margin = 6;
  groundPlane.scale.set(grid.worldWidth + margin, 1, grid.worldDepth + margin);
}

// ---- Floors ----
// FloorManager creates floor 0 up front so the interaction layer can bind to
// its grid/store; `attach` then activates it. Rooms + modules of a floor share
// ONE occupancy map; each floor is fully independent of the others.
const floors = new FloorManager(scene, DEFAULT_COLS, DEFAULT_ROWS);
const f0 = floors.active;

// ---- Undo/redo history ----
// Snapshot-based (see core/history.ts): each mutating action commits a
// serialized-project snapshot; restore reuses the project-import rebuild path.
// Created near the end of setup (restore depends on functions defined below);
// controllers snapshot through this stable wrapper meanwhile.
let history: History | undefined;
// Every mutating action calls this, entrances and doors included — a wider
// net than `floors.onLayoutChange` (wired to the room STORE alone), so the
// save column's three numbers (run 0026, `refreshFlatCard` below) piggyback
// on the SAME single point rather than adding a second, narrower hook.
const commitHistory = () => {
  history?.commit();
  refreshFlatCard();
};

// ---- Interaction ----
const ghost = new GhostPreview(f0.group, f0.grid, f0.store);
const groupGhost = new GroupGhostPreview(f0.group, f0.grid);
const picker = new Picker(canvas, camera, f0.grid, groundPlane);

// Entrance selection/deletion adapter (entrances live on floor 0 only, and are
// only interactive while floor 0 is the active floor).
const entranceAdapter: MarkerSelectionAdapter = {
  pick(x, y) {
    if (floors.activeIndexValue !== 0) return null;
    const hit = picker.groupAt(x, y, floors.floors[0].entranceMarkers);
    return (hit?.userData.entranceId as string | undefined) ?? null;
  },
  setSelected(id) {
    floors.floors[0].setEntranceSelected(id);
  },
  remove(id) {
    floors.floors[0].removeEntrance(id);
    floors.refreshWalls(); // the freed edge may regain a window
    clearValidation(); // drop stale entryIds / entrance highlight
  },
};

// Door selection/deletion adapter (doors live on any floor; interactive on the
// ACTIVE floor). Removing a door closes its opening in both adjacent shells.
const doorAdapter: MarkerSelectionAdapter = {
  pick(x, y) {
    const hit = picker.groupAt(x, y, floors.active.doorMarkers);
    return (hit?.userData.doorId as string | undefined) ?? null;
  },
  setSelected(id) {
    floors.active.setDoorSelected(id);
  },
  remove(id) {
    floors.active.removeDoor(id);
    floors.refreshWalls(); // re-close the opening in both wall segments
    clearValidation(); // door removal changes reachability
  },
  cycleSwing(id) {
    floors.active.cycleDoorSwing(id); // rebuilds the marker + plan arc; swing is not reachability, so no wall/validation refresh
    floors.active.setDoorSelected(id); // rebuild cleared the highlight — reapply it
  },
};

const dragDrop = new DragDropController(canvas, picker, ghost, f0.store, controls, commitHistory);
const selection = new SelectionController(
  canvas,
  picker,
  ghost,
  groupGhost,
  f0.store,
  controls,
  dragDrop,
  commitHistory,
  entranceAdapter,
  () => updateSelectionReadout(),
  (msg) => showToast("info", msg),
  doorAdapter,
  // A placement tool (entrance/door) owns the canvas while armed — selection
  // stays out entirely (both controllers are declared below; this closure only
  // runs during pointer events, long after they're initialised).
  () => entranceController.isActive || doorController.isActive || doubleHeightController.isActive
);

floors.attach({ picker, ghost, groupGhost, dragDrop, selection, groundPlane, sizeGroundPlane });

// The drag gesture reports itself; main decides what that looks like. The
// controller owns no DOM and no scene state beyond its ghost, so the cursor
// chip, the validity label and the grid emphasis are all wired here.
dragDrop.onGesture = (state) => {
  renderDragChrome(state);
  // Only the ACTIVE floor's grid gains emphasis: it is the one being placed on,
  // and lighting the others would say a drop could land there.
  floors.floors.forEach((f, i) =>
    f.gridView.setEmphasis(state !== null && i === floors.activeIndexValue)
  );
};

// A stair placed on the top floor auto-creates a floor above it — refresh the
// sidebar floor tabs when that happens. The floor stack shape changing while
// in plan mode would leave its by-index hidden-floor bookkeeping stale, so
// leave plan mode first (safe/simple over trying to remap indices).
floors.onStructureChange = () => {
  // A floor was APPENDED (a stair, or a double-height room, needed somewhere to
  // go). This used to drop plan mode, which was jarring: placing a stair while
  // reading a plan threw you back into the axo view for no reason the resident
  // could see. Plan mode's only per-index bookkeeping is `prePlanVisibility`,
  // and appending a floor just leaves it one short, which `applyPlanVisibility`
  // already tolerates (`?? true`). So extend it and stay put.
  if (planMode) {
    while (prePlanVisibility.length < floors.floors.length) prePlanVisibility.push(true);
    applyPlanVisibility();
  }
  renderSidebar();
};

// Entrance placement (ground floor only). Binds a door marker to an exterior
// edge of a floor-0 room/cluster; placing one drops any stale validation report.
const entranceController = new EntranceController(
  canvas,
  picker,
  controls,
  () => floors.floors[0],
  () => {
    // A new entrance may sit on a windowed edge — regenerate windows so the
    // door wins that edge. Entrance placement doesn't go through store.onChange.
    floors.refreshWalls();
    clearValidation();
    commitHistory(); // entrance placement is an undoable action
  }
);

// Interior-door placement (any floor). Binds a 2-edge door to a shared interior
// boundary of the ACTIVE floor; placing one cuts the opening in both adjacent
// shells and changes reachability, so it refreshes walls + drops validation.
const doorController = new DoorController(
  canvas,
  picker,
  controls,
  () => floors.active,
  () => floors.doorTargets(floors.active),
  () => {
    floors.refreshWalls(); // cut the opening in both adjacent wall segments
    floors.assignDefaultSwings(); // give the new door its default leaf swing
    if (planMode) floors.setDoorArcsVisible(true); // show its arc if we're in plan view
    clearValidation();
    commitHistory(); // door placement is an undoable action (swing included)
  },
  // A room↔balcony boundary is already a french window — the glass IS the
  // door — so a second one there is meaningless. Existing doors are untouched
  // (isDoorValid is deliberately unchanged); only NEW authoring is blocked.
  (door) =>
    floors.isSemiExteriorDoor(floors.active, door)
      ? { ok: false, hint: "That boundary is already a french window onto the balcony." }
      : { ok: true },
  (msg) => showToast("info", msg)
);

// Exactly one placement mode may be armed at a time. Every entry point (palette
// grab, +Entrance, +Door) disarms all the others first, so a single pointer
// release can never drive two placement handlers at once (each of dragDrop /
// entrance / door / duplicate listens on its own active flag). Each cancel is a
// safe no-op when that mode isn't active.
function cancelPlacementModes(): void {
  dragDrop.cancelPlacement();
  entranceController.cancel();
  doorController.cancel();
  selection.cancelDuplicate();
  doubleHeightController.cancel();
}

// ---- Sidebar (rebuilt whenever floor state changes) ----
function renderSidebar(): void {
  buildPalette(
    sidebar,
    {
      onGrabModule(type) {
        cancelPlacementModes(); // disarm any entrance/door tool or duplicate ghost
        selection.deselect();
        dragDrop.startPlacement(type);
      },
      onApplyGridSize(cols, rows) {
        const f = floors.active;
        selection.deselect();
        clearValidation();
        f.grid.resize(cols, rows);
        f.gridView.rebuild();
        sizeGroundPlane(f.grid);
        const culled = f.store.reconcileAfterResize();
        if (culled.length > 0) {
          console.info(
            `Floor resized to ${cols}x${rows}; removed ${culled.length} item(s) that no longer fit.`
          );
        }
        floors.syncStairsAndHoles(); // resize may change which cells have plate above
        renderSidebar();
        commitHistory(); // grid resize is an undoable action
      },
      onSwitchFloor(index) {
        clearValidation();
        floors.setActive(index);
        // Plan mode hides everything above the active floor — recompute which
        // floors that means now that "active" has moved (no re-frame here:
        // switching floors shouldn't yank the camera the user has panned/zoomed).
        if (planMode) applyPlanVisibility();
        renderSidebar();
      },
      onAddFloor() {
        // Stays in plan mode: `onStructureChange` extends the bookkeeping.
        floors.addFloor();
        renderSidebar();
        commitHistory(); // adding a floor is an undoable action
      },
      onDeleteFloor() {
        if (floors.floors.length <= 1) return;
        const ok = window.confirm(
          "Delete this floor and everything on it?"
        );
        if (!ok) return;
        if (planMode) exitPlanMode();
        floors.deleteFloor();
        renderSidebar();
        commitHistory(); // deleting a floor is an undoable action
      },
      onToggleFloorVisibility(index) {
        const next = !floors.isFloorVisible(index);
        floors.setFloorVisible(index, next);
        // Keep the plan-mode snapshot in sync so exiting doesn't discard a
        // manual toggle made while it was active.
        if (planMode && index < prePlanVisibility.length) prePlanVisibility[index] = next;
        renderSidebar();
      },
      onPlaceEntrance() {
        // Entrances are ground-floor only — switch to floor 0 first if needed.
        if (floors.activeIndexValue !== 0) {
          floors.setActive(0);
          renderSidebar();
        }
        cancelPlacementModes(); // disarm palette drag / door tool / duplicate ghost
        selection.deselect();
        entranceController.start();
      },
      onPlaceDoor() {
        // Doors go on any floor — place on whatever floor is active.
        cancelPlacementModes(); // disarm palette drag / entrance tool / duplicate ghost
        selection.deselect();
        doorController.start();
      },
      onMarkDoubleHeight() {
        // Marks a room on the active floor; same arming shape as the two above.
        cancelPlacementModes();
        selection.deselect();
        doubleHeightController.start();
      },
      onSetOrientationPreference(pref) {
        // Design state, so it is undoable and it lands in the project file. No
        // geometry re-derives: the preference only changes how OR2 reads the
        // glazing that is already there, so the stale report is dropped and
        // nothing is rebuilt.
        floors.orientationPreference = pref;
        clearValidation();
        commitHistory();
      },
    },
    {
      floors: floors.floors.map((_, i) => ({
        label: `Floor ${i}`,
        visible: floors.isFloorVisible(i),
      })),
      activeIndex: floors.activeIndexValue,
      cols: floors.active.grid.cols,
      rows: floors.active.grid.rows,
      orientationPreference: floors.orientationPreference,
    }
  );
}
renderSidebar();

// ---- Selection readout (small persistent line showing what's selected) ----
// Fired by SelectionController's onSelectionChange callback whenever the
// module set or entrance selection changes. Floor-index is read live (not
// cached) since the readout can be stale-refreshed after a floor switch too
// (see onSwitchFloor below, where the selection itself is unaffected but the
// floor label it reports could otherwise go stale — in practice selection is
// per-floor so it's always empty right after a switch, but this stays correct
// regardless).
function updateSelectionReadout(): void {
  const insts = selection.selectedInstances;
  const entId = selection.selectedEntranceIdValue;
  const doorSelected = selection.selectedDoorIdValue;
  let text = "";
  if (insts.length === 1) {
    const inst = insts[0];
    const bbox = (cells: { cx: number; cz: number }[]) => {
      const xs = cells.map((c) => c.cx);
      const zs = cells.map((c) => c.cz);
      return {
        w: Math.max(...xs) - Math.min(...xs) + 1,
        d: Math.max(...zs) - Math.min(...zs) + 1,
        n: cells.length,
      };
    };
    const seed = bbox(rotatedCells(inst.def, inst.rotation, inst.mirrored));
    // Effective footprint (elastic expansion): show the grown bounding box,
    // with the authored seed size noted when the room actually grew.
    const eff = floors.active.effectiveCells.get(inst.id);
    const shown = eff && eff.length ? bbox(eff) : seed;
    const grewNote = shown.n > seed.n ? ` (seed ${seed.w}×${seed.d})` : "";
    text = `${inst.def.name} · Floor ${floors.activeIndexValue} · ${shown.w}×${shown.d}${grewNote}`;
  } else if (insts.length > 1) {
    text = `${insts.length} selected`;
  } else if (entId) {
    text = "Entrance · Floor 0";
  } else if (doorSelected) {
    text = `Door · Floor ${floors.activeIndexValue}`;
  }
  selectionText.textContent = text;
  selectionReadout.classList.toggle("visible", !!text);

}

/** Toggle one room's double-height mark, from the palette tool. A refusal names
 *  the cells that blocked it rather than clearing them: the obstruction is
 *  authored work on another floor and deleting it silently would be the worst
 *  possible answer (see `ModuleStore.setDoubleHeight`). */
function toggleDoubleHeight(instanceId: string): { ok: boolean; blockedBy?: Cell[] } {
  const inst = floors.active.store.instances.get(instanceId);
  if (!inst) return { ok: false };
  const want = !inst.doubleHeight;
  const res = floors.active.store.setDoubleHeight(inst.id, want);
  if (!res.ok) {
    const cells = res.blockedBy ?? [];
    showToast(
      "error",
      cells.length
        ? `Cannot open this room upward: the floor above already holds something over ` +
            `${cells.length} of its cells (${cells
              .slice(0, 4)
              .map((c) => `${c.cx},${c.cz}`)
              .join(" · ")}${cells.length > 4 ? " …" : ""}). Clear those cells first.`
        : "This room cannot be made double height."
    );
    return res;
  }
  clearValidation();
  updateSelectionReadout();
  commitHistory(); // marking is a mutating action, so it is undoable
  showToast(
    "info",
    want
      ? `"${inst.def.name}" is now double height and claims the storey above.`
      : `"${inst.def.name}" is single height again.`
  );
  return res;
}

/** The double-height TOOL: arm it from the palette, click rooms, Escape to
 *  disarm — the same shape as the entrance and doorway tools. */
const doubleHeightController = new DoubleHeightController(
  canvas,
  picker,
  () => floors.active,
  toggleDoubleHeight,
  // Hover feedback reuses the emissive the selection controller already uses,
  // so an armed tool highlights a room exactly the way hovering one does.
  (id) => {
    if (doubleHeightHovered && doubleHeightHovered !== id) {
      const prev = floors.active.store.instances.get(doubleHeightHovered);
      if (prev) setHovered(prev.group, false, false);
    }
    doubleHeightHovered = id;
    if (id) {
      const inst = floors.active.store.instances.get(id);
      if (inst) setHovered(inst.group, true, false);
    }
  }
);
/** The room the double-height tool is hovering, so the previous one can be
 *  un-highlighted when the cursor moves on. */
let doubleHeightHovered: string | null = null;

// ---- Shortcuts legend (static content in index.html; just a visibility toggle) ----
shortcutsBtn.addEventListener("click", () => shortcutsPanel.classList.toggle("open"));
shortcutsClose.addEventListener("click", () => shortcutsPanel.classList.remove("open"));

// ---- Camera framing: zoom-to-extent + plan (top) view ----
// "Zoom to extent" frames the camera on the actual content (all placed rooms/
// modules/stairs across VISIBLE floors, or the grid if empty) rather than a
// fixed position — like Rhino's Zoom Extents. Reset View always lands here,
// at the default axo angle, and always leaves plan mode first so it has one
// predictable destination regardless of what view you were just in.
function resetToExtent(): void {
  if (planMode) {
    exitPlanMode(); // exitPlanMode already re-frames axo
    return;
  }
  ctx.frameBox(floors.contentBox(), "axo");
}
resetBtn.addEventListener("click", resetToExtent);

// ---- Plan (top) view ----
// Looking straight down a multi-floor building only shows the topmost visible
// plate — useless as a plan — so entering plan mode auto-hides every floor
// ABOVE the active one (restored on exit) and re-frames straight down onto
// what's left, reading as "the plan of the floor I'm editing." Orbit ROTATION
// is locked while active (pan/zoom still work) so the plan reading can't be
// orbited away into an oblique, half-plan view; the toggle button is the only
// way in or out (besides Reset View, which also exits it).
let planMode = false;
let prePlanVisibility: boolean[] = [];

/** Re-derive which floors plan mode should hide from the CURRENT active floor
 *  — floors above it hidden, floors at-or-below restored to their pre-plan
 *  (or since-manually-toggled, see onToggleFloorVisibility) state. */
function applyPlanVisibility(): void {
  const activeIdx = floors.activeIndexValue;
  floors.floors.forEach((_, i) => {
    floors.setFloorVisible(i, i <= activeIdx ? (prePlanVisibility[i] ?? true) : false);
  });
}

/**
 * Light the one segment that matches the current mode. The three view modes were
 * always mutually exclusive in the code; the segmented control is what makes
 * that visible, so it reads its state from the modes rather than tracking its
 * own. Called from every place that can change a mode.
 */
/** The Display card's header summary: what is on, in the order the toggles sit,
 *  or "all off". It is what makes a collapsed card readable, so it is recomputed
 *  wherever a toggle changes rather than only when the card opens. */
function syncDisplaySummary(): void {
  const on: string[] = [];
  if (cutawayToggle.classList.contains("active")) on.push("Cutaway");
  if (seedsToggle.classList.contains("active")) on.push("Seeds");
  if (floors.structureViewOn) on.push("Structure");
  if (floors.interfaceViewOn) on.push("Interface");
  displaySummary.textContent = on.length ? on.join(" · ") : "all off";
}

function syncViewSegments(): void {
  const diagram = graphView.visible;
  modelViewBtn.classList.toggle("active", !diagram && !planMode);
  topViewBtn.classList.toggle("active", !diagram && planMode);
  viewToggle.classList.toggle("active", diagram);
}

function enterPlanMode(): void {
  if (planMode) return;
  setDiagramVisible(false); // mutually exclusive with the bubble-diagram view
  planMode = true;
  prePlanVisibility = floors.floors.map((_, i) => floors.isFloorVisible(i));
  applyPlanVisibility();
  floors.setDoorArcsVisible(true); // door-swing arcs are a plan-view symbol
  controls.enableRotate = false;
  ctx.frameBox(floors.contentBox(), "top");
  syncViewSegments();
}

/** Leave plan mode: restore every floor's pre-plan visibility, unlock orbit,
 *  and re-frame back to the default axo extent (the one guaranteed exit). */
function exitPlanMode(): void {
  if (!planMode) return;
  planMode = false;
  prePlanVisibility.forEach((v, i) => floors.setFloorVisible(i, v));
  floors.setDoorArcsVisible(false); // arcs are plan-only
  controls.enableRotate = true;
  ctx.frameBox(floors.contentBox(), "axo");
  syncViewSegments();
}

modelViewBtn.addEventListener("click", () => {
  setDiagramVisible(false);
  exitPlanMode();
  syncViewSegments();
});
topViewBtn.addEventListener("click", () => {
  setDiagramVisible(false); // plan and diagram are exclusive
  enterPlanMode();
  syncViewSegments();
});

// ---- Bubble-diagram (adjacency graph) view ----
const graphView = new GraphView(
  graphCanvas,
  () => computeDwellingGraph(floors.floors),
  () => floors.activeIndexValue,
  graphFloorLabel,
  graphLegend,
  graphToggleTouch,
  graphToggleDepth,
  graphRelayoutBtn
);

function setDiagramVisible(show: boolean): void {
  if (graphView.visible === show) return;
  if (show && planMode) exitPlanMode(); // mutually exclusive with plan view
  graphView.toggle();
  // Hide the 3D-only chrome while in diagram mode (Check Layout stays available).
  const hide = graphView.visible ? "none" : "";
  resetBtn.style.display = hide;
  viewControls.style.display = hide; // cutaway toggle + compass dial
  syncViewSegments();
}
viewToggle.addEventListener("click", () => {
  setDiagramVisible(true);
  syncViewSegments();
});

// ---- Display card ----
// Collapsed by default: the summary in the header is what makes that readable,
// so the card only has to open when something is being changed.
displayHeader.addEventListener("click", () => {
  const open = !displayBody.classList.contains("open");
  displayBody.classList.toggle("open", open);
  displayHeader.setAttribute("aria-expanded", String(open));
  displayHeader.classList.toggle("open", open);
});

// ---- Save / Open menu ----
// Export, Import and Export unit collapse into one menu in the top bar. The
// actions themselves are unchanged; only where they are reached from moved.
function setSaveOpenOpen(open: boolean): void {
  saveOpenMenu.classList.toggle("open", open);
  saveOpenBtn.setAttribute("aria-expanded", String(open));
}
saveOpenBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // the document handler below would close it again
  setSaveOpenOpen(!saveOpenMenu.classList.contains("open"));
});
document.addEventListener("click", () => setSaveOpenOpen(false));
// One Save item, and Open project beside it. The three separate items (Export
// project, Export unit, and the dialog's own Save to library action) are
// retired: the save column writes any combination of the three, so a second
// route to a subset of them is only a way to forget one. The column is
// always visible (run 0026), so "Save…" now opens "More" — where those
// choices live — and refreshes the proposed number, rather than opening a
// dialog that no longer exists.
document.getElementById("menu-save")!.addEventListener("click", () => {
  setSaveOpenOpen(false);
  setMoreOpen(true);
});
document.getElementById("menu-import")!.addEventListener("click", () => {
  setSaveOpenOpen(false);
  fileInput.click();
});

// ---- North compass + orientation-aware windows ----
// The compass DIAL is the control (drag to set north); the camera-aware north
// BADGE (updated each frame in animate) shows true on-screen north in both axo
// and plan. `displayNorthAngle` is the LIVE angle the badge reads — it tracks a
// drag continuously, but the WINDOWS only re-derive (and one undo snapshot is
// taken) on RELEASE, per the commit-on-release convention. Changing north also
// drops any stale validation report (it moves windows/orientation).
let displayNorthAngle = floors.northAngle;
const compassDial = createCompassDial({
  onInput: (deg) => {
    displayNorthAngle = deg; // badge follows the drag; windows wait for release
  },
  onCommit: (deg) => {
    displayNorthAngle = deg;
    floors.setNorthAngle(deg); // re-derives windows against the new north
    clearValidation();
    commitHistory(); // one snapshot per dial gesture (no-op if angle unchanged)
  },
});
document.getElementById("compass-row")!.prepend(compassDial.el);

/** Re-sync the dial + live badge angle to the model's north (after load/undo,
 *  which set `floors.northAngle` through the rebuild path). */
function syncNorthUI(): void {
  displayNorthAngle = floors.northAngle;
  compassDial.setAngle(floors.northAngle);
  compassValue.textContent = `North ${Math.round(floors.northAngle)}°`;
}

/** Rotate the north badge to point at TRUE north on screen: project the world
 *  north direction through the camera and take its clockwise-from-up angle.
 *  Works for both axo and plan (the projection carries the view). */
const northWorld = new THREE.Vector3();
const originNDC = new THREE.Vector3();
function updateNorthBadge(): void {
  const d = worldNorthDir(displayNorthAngle);
  originNDC.set(0, 0, 0).project(camera);
  northWorld.set(d.x, 0, d.z).project(camera);
  const dx = northWorld.x - originNDC.x;
  const dyUp = northWorld.y - originNDC.y; // NDC y is up
  const angle = (Math.atan2(dx, dyUp) * 180) / Math.PI; // clockwise from up
  // The first frame can run before the ResizeObserver has sized the canvas, so
  // the projection divides by a zero viewport and the angle comes out NaN.
  if (!Number.isFinite(angle)) return;
  northBadgeRot.setAttribute("transform", `rotate(${angle} 20 20)`);
}

// Cutaway toggle (default ON = current dollhouse behaviour). Session view-state
// only — never serialized, untouched by undo/load.
let cutawayOn = true;
cutawayToggle.addEventListener("click", () => {
  cutawayOn = !cutawayOn;
  setCutawayEnabled(cutawayOn);
  cutawayToggle.classList.toggle("active", cutawayOn);
  syncDisplaySummary();
});

// "Show seeds" toggle (default OFF): thin outlines of each elastic room's
// authored seed rectangle inside its grown shell (plan + 3D). Pure view
// state — never serialized, untouched by undo/load.
const seedsToggle = document.getElementById("seeds-toggle") as HTMLButtonElement;
let seedsOn = false;
seedsToggle.addEventListener("click", () => {
  seedsOn = !seedsOn;
  floors.setSeedOutlinesVisible(seedsOn);
  seedsToggle.classList.toggle("active", seedsOn);
  syncDisplaySummary();
});

// "Structure" toggle (default OFF): renders the FIXED layer as built — wet
// rooms and stairs whole — and drops every other space to a bare plate. Pure
// view state: never serialized, untouched by undo/load; survives rebuilds
// (FloorManager re-applies it).
//
// "Interface view" toggle (default OFF): shows only the binding level of a unit
// — perimeter with its glazing, wet cells, stair, balconies, entrance — and
// reduces everything else to one open plate. Same guarantees.
//
// The two are MUTUALLY EXCLUSIVE in the FloorManager (they express a stripped
// room through the same `baseColor` slot), so turning one on turns the other
// off in the model; syncButtons re-reads the model rather than tracking the
// pair here, which is what keeps the two buttons from disagreeing with it.
const structureToggle = document.getElementById("structure-toggle") as HTMLButtonElement;
const interfaceToggle = document.getElementById("interface-toggle") as HTMLButtonElement;
function syncViewToggles(): void {
  structureToggle.classList.toggle("active", floors.structureViewOn);
  interfaceToggle.classList.toggle("active", floors.interfaceViewOn);
  syncDisplaySummary();
}
structureToggle.addEventListener("click", () => {
  floors.setStructureView(!floors.structureViewOn);
  syncViewToggles();
});
interfaceToggle.addEventListener("click", () => {
  floors.setInterfaceView(!floors.interfaceViewOn);
  syncViewToggles();
});

// ---- One axonometric for every flat (run 0024) ------------------------------
// The library preview and the session preview are the SAME picture: the
// flat's own axonometric, framed to its bounding box (src/core/previewFrame.ts,
// the app's own "zoom to extent" pose), on the paper ground, every floor
// visible, the Cutaway/Seeds/Structure/Interface overlays off, at one fixed
// size — never whatever view the author happened to be in when they saved.
//
// It borrows the LIVE scene for one frame: every piece of view state it
// touches is read before and put back exactly after, so a resident mid-orbit
// never sees their camera jump. Nothing here is DEV-gated — a production
// build has no capture sink, but the render itself needs no server.
const PREVIEW_W = 800;
const PREVIEW_H = 600;

function captureFlatPreview(): { dataUrl: string; bytes: number } {
  const savedFloorVisible = floors.floors.map((_, i) => floors.isFloorVisible(i));
  const savedStructure = floors.structureViewOn;
  const savedInterface = floors.interfaceViewOn;
  const savedPos = camera.position.clone();
  const savedUp = camera.up.clone();
  const savedZoom = camera.zoom;
  const savedViewSize = (camera as unknown as { viewSize: number }).viewSize;
  const savedTarget = controls.target.clone();
  const savedPixelRatio = renderer.getPixelRatio();
  const savedStyleW = canvas.style.width;
  const savedStyleH = canvas.style.height;

  try {
    floors.floors.forEach((_, i) => floors.setFloorVisible(i, true));
    // Every floor RENDERS solid too, not just visible: a floor other than the
    // active one is normally dimmed translucent (FloorManager.applyDim), which
    // read as a ghostly double-exposure over the storey below it the first
    // time this was tried on a two-storey flat. `setDimmed` has no getter to
    // save, but the dim state is entirely a function of the active index
    // (`i !== activeIndexValue`), so restoring means recomputing that, not
    // remembering it.
    floors.floors.forEach((f) => f.setDimmed(false));
    setCutawayEnabled(false);
    floors.setSeedOutlinesVisible(false);
    if (floors.structureViewOn) floors.setStructureView(false);
    if (floors.interfaceViewOn) floors.setInterfaceView(false);

    // A fixed backing resolution, pixel ratio 1 so it comes out exactly
    // PREVIEW_W×PREVIEW_H, and the CSS size matched too so frameBox's own
    // aspect read (canvas.clientWidth/clientHeight) agrees with the buffer —
    // otherwise the frustum would be cut for the on-screen aspect and the
    // fixed-size buffer would show it stretched.
    renderer.setPixelRatio(1);
    canvas.style.width = `${PREVIEW_W}px`;
    canvas.style.height = `${PREVIEW_H}px`;
    renderer.setSize(PREVIEW_W, PREVIEW_H, false);

    const box = floors.contentBox();
    const frame = axoFrame(
      { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } },
      PREVIEW_W / PREVIEW_H
    );
    camera.up.set(frame.up.x, frame.up.y, frame.up.z);
    (camera as unknown as { viewSize: number }).viewSize = frame.viewSize;
    camera.zoom = 1;
    const center = new THREE.Vector3(frame.center.x, frame.center.y, frame.center.z);
    const dir = new THREE.Vector3(frame.direction.x, frame.direction.y, frame.direction.z);
    camera.position.copy(center).addScaledVector(dir, 100);
    controls.target.copy(center);
    camera.lookAt(center);
    ctx.handleResize();
    controls.update();

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const bytes = Math.max(0, Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4));
    return { dataUrl, bytes };
  } finally {
    savedFloorVisible.forEach((v, i) => floors.setFloorVisible(i, v));
    floors.floors.forEach((f, i) => f.setDimmed(i !== floors.activeIndexValue));
    setCutawayEnabled(cutawayOn);
    floors.setSeedOutlinesVisible(seedsOn);
    // Mutually exclusive in FloorManager, so only the one that was actually
    // on needs restoring; the other is already off from the block above.
    if (savedStructure) floors.setStructureView(true);
    if (savedInterface) floors.setInterfaceView(true);
    renderer.setPixelRatio(savedPixelRatio);
    canvas.style.width = savedStyleW;
    canvas.style.height = savedStyleH;
    camera.position.copy(savedPos);
    camera.up.copy(savedUp);
    camera.zoom = savedZoom;
    (camera as unknown as { viewSize: number }).viewSize = savedViewSize;
    controls.target.copy(savedTarget);
    camera.lookAt(savedTarget);
    ctx.handleResize();
    controls.update();
  }
}

// Initial view: frame whatever's on the (likely empty) starting floor instead
// of a hardcoded camera position, so this stays correct however the default
// grid size changes.
resetToExtent();

// ---- Layout rules validation (on-demand "Check Layout") ----
// Advisory only: never blocks placement. Computed on click against the WHOLE
// DWELLING graph (all floors + cross-floor stair edges, rooted at entrances);
// surfaced in the text panel, the bubble diagram, and the 3D view. Cleared on
// any layout change.
let validated = false;

function clearValidation(): void {
  validationPanel.style.display = "none";
  validationPanel.replaceChildren();
  // The sheet covers the bottom 256px of the viewport, so the overlay clusters
  // anchored there lift while it is open and return when it closes.
  viewport.classList.remove("sheet-open");
  graphView.clearHighlights();
  clearHoverEmphasis();
  if (validated) clearRoomHighlights(floors.floors);
  validated = false;
}

/** Hovering a report card emphasizes its target(s) in both the diagram and
 *  the 3D view, layered on top of the normal post-check tier highlighting
 *  (never replacing it — see `GraphView.setHover` / `setHoverEmphasis`'s doc
 *  comments). Unhover (`v === null`) reverts to that normal highlighting. */
function onHoverViolation(v: Violation | null): void {
  graphView.setHover(v);
  if (v) setHoverEmphasis(floors.floors, v.nodeIds, v.entranceIds ?? []);
  else clearHoverEmphasis();
}

function runCheck(): void {
  const graph = computeDwellingGraph(floors.floors);
  const violations = validate(graph, floors.orientationPreference);
  const depths = computeEntranceDepths(graph);
  graphView.setHover(null); // a stale hover from the previous report shouldn't survive a re-check
  clearHoverEmphasis();
  renderValidationPanel(validationPanel, graph, violations, depths, clearValidation, onHoverViolation);
  viewport.classList.add("sheet-open");
  graphView.setHighlights(violations);
  // (Diagram depth badges are computed by GraphView itself each frame from the
  // live graph when its depth toggle is on — no longer pushed from here, so
  // they no longer require Check Layout to appear. See GraphView.frame().)
  applyRoomHighlights(floors.floors, violations);
  validated = true;
}

// Check Layout both opens the sheet and closes it again. Escape is NOT a second
// way out: it already arbitrates drag-abort, selection-clear and plan-view exit
// (see the keydown handler), and giving it a fourth meaning would make which one
// fires depend on state the user cannot see.
checkBtn.addEventListener("click", () => (validated ? clearValidation() : runCheck()));
// A stale report is worse than none: drop it as soon as any floor's layout
// changes (validation spans the whole dwelling now).
floors.onLayoutChange = () => clearValidation();

// ---- One save, three outputs (run 0019; PROJECT_STATE §11) ----
// Saving used to cost three trips through the menu: Export project, Export
// unit, Save to library. One dialog now asks which of the three to write and
// writes them, and the three outputs stay three separate things on disk and in
// the model. What collapsed is the doing.
//
// The design NUMBER is the only text input: it names the project file `Flat n`
// and the unit and its library entry `Unit n` (src/library/naming.ts), so one
// dwelling carries one number across both. The dialog opens on the next free
// number, so a run of units needs no typing at all.
//
// The decision rules live in src/core/savePlan.ts, pure and tested; the bytes
// and filenames live in src/core/saveFiles.ts, so the guarantee that this
// writes exactly what the old paths wrote is testable rather than asserted.

/** Where the library manifest is served from. One constant, read by the save
 *  dialog (next free number, replace-or-new) and the browser alike. */
const UNITS_MANIFEST_URL = "/units/index.json";

/** Small deterministic default palette; picked by name hash so the same name
 *  always proposes the same colour (bottom-up's catalog colour family). */
const UNIT_COLORS = ["#4dabf7", "#38d9a9", "#ffd43b", "#ff922b", "#ff6b6b", "#9775fa", "#f783ac"];
function defaultUnitColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return UNIT_COLORS[h % UNIT_COLORS.length];
}

/** Anchor-download a Blob URL or data URL under `filename`. */
function downloadAs(href: string, filename: string, revoke: boolean): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(href);
}

// The save column is always visible (run 0026) — not a `<dialog>` any more,
// so there is no show/hide; `openSaveDialog` (below) now means "refresh the
// column's proposed number and session-derived state", called at startup and
// whenever "More" is opened.
const saveNumberInput = document.getElementById("save-number") as HTMLInputElement;
const saveColorInput = document.getElementById("save-color") as HTMLInputElement;
const saveNamesLine = document.getElementById("save-names") as HTMLElement;
const saveResultsEl = document.getElementById("save-results") as HTMLElement;
const saveGoBtn = document.getElementById("save-go") as HTMLButtonElement;

// ---- "More": folded by default (run 0026), holding the design number,
// colour and the five checkboxes that used to be the whole dialog. ----
const moreToggle = document.getElementById("more-toggle") as HTMLButtonElement;
const moreBody = document.getElementById("more-body") as HTMLElement;
const morePlus = document.getElementById("more-plus") as HTMLElement;
function setMoreOpen(open: boolean): void {
  moreBody.hidden = !open;
  moreToggle.setAttribute("aria-expanded", String(open));
  morePlus.textContent = open ? "−" : "+";
  // The proposed number can go stale while folded (another resident may have
  // published in the meantime); refresh it whenever a resident actually opens
  // this, same as opening the old dialog used to.
  if (open) void openSaveDialog();
}
moreToggle.addEventListener("click", () => setMoreOpen(moreBody.hidden));

// The column's own minimize (found live: a resident needs a way to get the
// whole thing out of the way, not just fold "More"). Collapsing hides the
// three cards; the toggle itself stays docked at the column's own top-right
// corner, matching #display-header's header/body pattern.
const saveColumnToggle = document.getElementById("save-column-toggle") as HTMLButtonElement;
const saveColumnBody = document.getElementById("save-column-body") as HTMLElement;
saveColumnToggle.addEventListener("click", () => {
  const open = saveColumnBody.hidden;
  saveColumnBody.hidden = !open;
  saveColumnToggle.setAttribute("aria-expanded", String(open));
});

// ---- "Your flat": name, three live numbers, the check line (run 0026) ----
// The wireframe's card shows what the CURRENT design already is, not what a
// save is about to write, so this reads straight from `floors` — the same
// source `buildUnitExport`/`validate` already read for Check Layout and for
// the unit build below — rather than waiting for a save.
const flatNameEl = document.getElementById("flat-name") as HTMLElement;
const flatAreaCnt = document.getElementById("flat-area-cnt") as HTMLElement;
const flatStoreysEl = document.getElementById("flat-storeys") as HTMLElement;
const flatGlazingEl = document.getElementById("flat-glazing") as HTMLElement;
const flatCheckEl = document.getElementById("flat-check") as HTMLElement;

/** Where each animated element's tween currently is, and its in-flight
 *  frame handle, so a second call retargets instead of restarting: found
 *  live that a CSS `@property`-animated counter, restarted by toggling its
 *  class, snaps back to the registered `initial-value` the INSTANT the
 *  class is removed (that is the only place its value lived), which is why
 *  the number was starting from zero on every edit instead of from wherever
 *  it last landed. A plain rAF tween keeps that value in JS instead. */
const countState = new WeakMap<HTMLElement, { shown: number; raf: number }>();

/** Animates `el`'s text from wherever it last landed to `to` over 700ms —
 *  "the numbers count up when the flat changes", not always from zero.
 *  Calling this again before the previous tween finishes cancels it and
 *  retargets from the CURRENT displayed value, so repeated edits (an entrance
 *  right after a room) retarget smoothly instead of restarting and visibly
 *  juddering. */
function animateCount(el: HTMLElement, to: number): void {
  const target = Math.max(0, Math.round(to));
  const state = countState.get(el) ?? { shown: 0, raf: 0 };
  cancelAnimationFrame(state.raf);
  const from = state.shown;
  if (from === target) {
    el.textContent = String(target);
    state.raf = 0;
    countState.set(el, state);
    return;
  }
  const start = performance.now();
  const DURATION = 700;
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - (1 - t) ** 3; // ease-out cubic
    const value = Math.round(from + (target - from) * eased);
    el.textContent = String(value);
    // Kept current every frame, not only on completion, so a SECOND edit
    // arriving before this tween finishes retargets from what is actually
    // on screen rather than from where the last completed tween started.
    state.shown = value;
    state.raf = t < 1 ? requestAnimationFrame(tick) : 0;
    if (t >= 1) state.shown = target;
    countState.set(el, state);
  };
  state.raf = requestAnimationFrame(tick);
  countState.set(el, state);
}

/** Recomputed on every layout change (`floors.onLayoutChange`, below) and
 *  once at startup: the exact figures a save would write right now, read
 *  through `buildUnitExport` — the SAME function the save itself calls —
 *  so the card can never show a number the save disagrees with. A gate
 *  failure (no entrance yet, a disconnected floor) shows 0/0/0 and the
 *  gate's own reason as the check line; it is not an error, just an
 *  unfinished flat. */
function refreshFlatCard(): void {
  flatNameEl.textContent = unitNameFor(saveDesignNumber());
  const built = buildUnitExport(floors, "", "#000000");
  const stats = built.ok ? unitStats(built.file.storeys) : { areaM2: 0, storeys: 0, glazingM: 0 };
  animateCount(flatAreaCnt, stats.areaM2);
  flatStoreysEl.textContent = String(stats.storeys);
  flatGlazingEl.textContent = String(stats.glazingM);

  flatCheckEl.replaceChildren();
  if (!built.ok) {
    const note = document.createElement("span");
    note.className = "s";
    note.textContent = built.reason;
    flatCheckEl.appendChild(note);
    return;
  }
  const hard = validate(computeDwellingGraph(floors.floors), floors.orientationPreference).filter(
    (v) => v.severity === "hard"
  );
  const chip = document.createElement("span");
  chip.className = hard.length ? "chip chip-acc" : "chip chip-ok";
  chip.textContent = hard.length ? `${hard.length} must fix` : "checks pass";
  flatCheckEl.appendChild(chip);
  if (hard.length) {
    const rest = document.createElement("span");
    rest.className = "s";
    rest.textContent = hard[0].description + " · ";
    const showMe = document.createElement("a");
    showMe.textContent = "show me";
    showMe.addEventListener("click", () => runCheck());
    rest.appendChild(showMe);
    flatCheckEl.appendChild(rest);
  }
}
const saveWhatInputs: Record<OutputKind, HTMLInputElement> = {
  project: document.getElementById("save-what-project") as HTMLInputElement,
  unit: document.getElementById("save-what-unit") as HTMLInputElement,
  library: document.getElementById("save-what-library") as HTMLInputElement,
  publish: document.getElementById("save-what-publish") as HTMLInputElement,
};

/** REMEMBERED FOR THE SESSION (never serialized — this is how you save, not
 *  part of the design). All four default to on: the three retired menu items
 *  were being used together, and publishing is what the session is for; after
 *  the first save the second unit costs one click. Reset on reload, like every
 *  other view-state default. Publish is only EFFECTIVE while the session
 *  fields are filled — `readSaveSelection` reads a disabled box as off. */
let saveSelection: SaveSelection = { project: true, unit: true, library: true, publish: true };
/** Once the colour is touched by hand it stops following the name hash, for
 *  the rest of the session. */
let saveColorTouched = false;

// ---- The session: who, and which room (src/session/session.ts) -------------
// Two fields at the top of the save dialog, remembered in localStorage under
// one key and shown in the top bar. A `?session=` in the URL wins over the
// stored code and is stored. Neither is ever written into a project file.
const saveResidentInput = document.getElementById("save-resident") as HTMLInputElement;
const saveCodeInput = document.getElementById("save-session") as HTMLInputElement;
const savePublishNote = document.getElementById("save-publish-note") as HTMLElement;
/** Off by default (docs/store.md): a flat belongs to whoever published it,
 *  so taking over someone else's is one deliberate tick, not the standing
 *  choice `saveSelection`'s four checkboxes get. Reset to off after every
 *  successful publish (run 0024). */
const saveReplaceInput = document.getElementById("save-replace") as HTMLInputElement;
const tbSession = document.getElementById("tb-session") as HTMLElement;
const PUBLISH_NOTE = savePublishNote.textContent ?? "";

// The session fields fold into one line once both are already set (run 0025,
// UX pass — "reveal complexity gradually"), re-decided on every dialog open,
// never mid-edit: "change" unfolds for the rest of this dialog-open session.
const saveSessionSummary = document.getElementById("save-session-summary") as HTMLElement;
const saveSessionSummaryText = document.getElementById("save-session-summary-text") as HTMLElement;
const saveSessionFields = document.getElementById("save-session-fields") as HTMLElement;
const saveSessionChange = document.getElementById("save-session-change") as HTMLButtonElement;

function unfoldSessionFields(): void {
  saveSessionSummary.hidden = true;
  saveSessionFields.hidden = false;
}
/** Fold only when both fields are already usable — `whyPublishDisabled` is
 *  the one place "usable" is already defined, so this reuses it rather than
 *  re-deriving the same condition. */
function syncSessionFold(): void {
  if (whyPublishDisabled(session) === null) {
    saveSessionSummaryText.textContent = `${session.code} · ${session.resident.trim()}`;
    saveSessionSummary.hidden = false;
    saveSessionFields.hidden = true;
  } else {
    unfoldSessionFields();
  }
}
saveSessionChange.addEventListener("click", () => {
  unfoldSessionFields();
  saveResidentInput.focus();
});

/** localStorage, or null where the browser refuses it (a sandboxed frame). */
const sessionStorageArea = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
let session: SessionSettings = readSession(sessionStorageArea, location.search);

/** The top-bar line and the Publish checkbox follow the two fields: while
 *  either is empty the checkbox is off, disabled, and its note says why; the
 *  moment both are filled it comes back with the remembered choice. */
function syncSessionUI(): void {
  tbSession.textContent = sessionLine(session);
  tbSession.classList.toggle("set", session.code.length > 0);
  const why = whyPublishDisabled(session);
  const input = saveWhatInputs.publish;
  const wasDisabled = input.disabled;
  input.disabled = why !== null;
  input.checked = why !== null ? false : wasDisabled ? saveSelection.publish : input.checked;
  savePublishNote.textContent = why ?? PUBLISH_NOTE;
}

function onSessionInput(): void {
  session = { resident: saveResidentInput.value, code: normalizeCode(saveCodeInput.value) };
  if (saveCodeInput.value !== session.code) saveCodeInput.value = session.code;
  writeSession(sessionStorageArea, session);
  syncSessionUI();
  syncSaveDialog();
}
saveResidentInput.addEventListener("input", onSessionInput);
saveCodeInput.addEventListener("input", onSessionInput);
saveResidentInput.value = session.resident;
saveCodeInput.value = session.code;
syncSessionUI();

/** The EFFECTIVE selection: a disabled Publish box (no name or code yet) reads as off. */
function readSaveSelection(): SaveSelection {
  return {
    project: saveWhatInputs.project.checked,
    unit: saveWhatInputs.unit.checked,
    library: saveWhatInputs.library.checked,
    publish: saveWhatInputs.publish.checked && !saveWhatInputs.publish.disabled,
  };
}

/** The design number in the field, floored at 1 so a cleared or nonsense field
 *  cannot produce `Flat NaN`. */
function saveDesignNumber(): number {
  const n = Math.floor(Number(saveNumberInput.value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Names line, proposed colour, and the Save button's enabled state, all
 *  re-derived from the two inputs. Nothing ticked is not a save. */
function syncSaveDialog(): void {
  const n = saveDesignNumber();
  flatNameEl.textContent = unitNameFor(n);
  const sel = readSaveSelection();
  // A disabled Publish box keeps the remembered choice rather than forgetting it.
  saveSelection = { ...sel, publish: saveWhatInputs.publish.disabled ? saveSelection.publish : sel.publish };
  const parts: string[] = [];
  if (sel.project) parts.push(projectNameFor(n));
  if (needsUnitBuild(sel)) parts.push(unitNameFor(n));
  saveNamesLine.textContent = parts.length
    ? `Writes ${parts.join(" and ")}` + (numberCountsSession ? ` — next free in the library and ${session.code}` : "")
    : "Nothing selected";
  if (!saveColorTouched) saveColorInput.value = defaultUnitColor(unitNameFor(n));
  saveGoBtn.disabled = isEmptySelection(sel);
}

/** The library manifest, or an empty one when it cannot be read. The dialog
 *  must still open when the library is unreachable; it just cannot propose a
 *  number derived from it, and says so by proposing 1. */
async function readManifestEntries(): Promise<UnitManifestEntry[]> {
  try {
    const res = await fetch(UNITS_MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return [];
    return parseUnitLibraryIndex(await res.text()).units;
  } catch {
    return [];
  }
}

/** The session's own published flats, as `{id, name}` for `nextFreeNumber` —
 *  `label` stands in for `name` since a flat has no separate display name.
 *  Empty when no session is set or the poll fails; the dialog must still open
 *  either way (run 0024, mirrors `readManifestEntries`). */
async function readSessionFlatNames(): Promise<{ id: string; name: string }[]> {
  if (!session.code) return [];
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(session.code)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const state = (await res.json()) as { flats?: { id: string; label: string }[] };
    return (state.flats ?? []).map((f) => ({ id: f.id, name: f.label }));
  } catch {
    return [];
  }
}

/** Whether the number just proposed came from the library alone or from the
 *  library and the session together — read by `syncSaveDialog` to add one
 *  clause to the names line, so a resident in a room knows the room's other
 *  flats were counted too (run 0024). */
let numberCountsSession = false;

/**
 * Refresh the (always-visible, run 0026) save column's proposed number and
 * session-derived state: the NEXT FREE NUMBER, the lowest positive integer
 * neither the library manifest nor (with a session set) the session's own
 * flats hold (src/library/naming.ts). Named for what it did before this run
 * — open the dialog — since the call sites (startup, "More" opening) are
 * the same "this is now stale, freshen it" moments a dialog-open used to be.
 */
async function openSaveDialog(): Promise<void> {
  for (const kind of ["project", "unit", "library", "publish"] as OutputKind[])
    saveWhatInputs[kind].checked = saveSelection[kind];
  syncSessionUI(); // and off again if the session fields are still empty
  syncSessionFold(); // folded if both are already set, open otherwise
  syncSaveDialog();
  const entries = await readManifestEntries();
  const sessionFlats = await readSessionFlatNames();
  numberCountsSession = session.code.length > 0;
  saveNumberInput.value = String(nextFreeNumber(entries, sessionFlats));
  syncSaveDialog();
}

// ---- Result lines -----------------------------------------------------------
// One per selected output, in the dialog rather than as toasts, because a unit
// that failed its gate must not read as a project save that failed. The dialog
// stays open on Save so these can be read.

const saveResults = new Map<OutputKind, OutputResult>();

function renderSaveResults(): void {
  saveResultsEl.replaceChildren(
    ...[...saveResults.values()].map((r) => {
      const line = document.createElement("p");
      line.className = `sr-line sr-${r.status}`;
      const label = document.createElement("span");
      label.className = "sr-label";
      label.textContent = outputLabel(r.kind);
      const detail = document.createElement("span");
      detail.className = "sr-detail";
      detail.textContent = r.detail;
      line.append(label, detail);
      return line;
    })
  );
}

function setSaveResult(kind: OutputKind, status: OutputResult["status"], detail: string): void {
  saveResults.set(kind, { kind, status, detail });
  renderSaveResults();
}

/**
 * Write whichever outputs are ticked, reporting each on its own line.
 *
 * The order matters: the project file is written FIRST and never depends on
 * the unit build, so a hard gate failure (no usable entrance, disconnected
 * footprint) or a declined layout-check confirm costs only the unit-derived
 * outputs. That is the rule `unitGateResults` encodes and `savePlan.test.ts`
 * pins.
 */
async function runSave(): Promise<void> {
  const sel = readSaveSelection();
  if (isEmptySelection(sel)) return;
  saveSelection = sel; // remembered for the next save this session
  const n = saveDesignNumber();
  const color = saveColorInput.value;
  const unitName = unitNameFor(n);

  saveResults.clear();
  for (const kind of planOutputs(sel)) setSaveResult(kind, "pending", "writing…");
  saveGoBtn.disabled = true;

  // The unit is built ONCE and feeds both the unit file and the library entry.
  let unitFile: DwellingUnitFile | null = null;
  if (needsUnitBuild(sel)) {
    const built = buildUnitExport(floors, unitName, color);
    if (built.ok) unitFile = built.file;
    else
      for (const r of unitGateResults(sel, built.reason))
        if (r.status === "failed") setSaveResult(r.kind, "failed", r.detail);
  }

  // ONE advisory confirm for the whole save, and only when a unit is actually
  // being written: rules describe the dwelling the unit promises the building,
  // so a project save alone never asks.
  if (unitFile) {
    const hard = validate(
      computeDwellingGraph(floors.floors),
      floors.orientationPreference
    ).filter((v) => v.severity === "hard");
    if (needsRuleConfirm(sel, hard.length)) {
      const ok = window.confirm(
        `Check Layout reports ${hard.length} MUST FIX issue(s) in this dwelling.\n` +
          `The unit will be written anyway (rules are advisory). Continue?`
      );
      if (!ok) {
        unitFile = null;
        const why = "not written — you chose not to continue past the layout check";
        if (sel.unit) setSaveResult("unit", "skipped", why);
        if (sel.library) setSaveResult("library", "skipped", why);
        if (sel.publish) setSaveResult("publish", "skipped", why);
      }
    }
  }

  // 1. The project file. Independent of everything above.
  if (sel.project) {
    const data = serializeProject(floors.floors, floors.northAngle, floors.orientationPreference);
    const text = projectFileText(data);
    const name = projectFileName(n);
    downloadAs(URL.createObjectURL(new Blob([text], { type: "application/json" })), name, true);
    setSaveResult(
      "project",
      "written",
      `${name} downloaded — ${floors.floors.length} floor(s), ${text.length} bytes`
    );
  }

  // 2. The unit file.
  if (sel.unit && unitFile) {
    const text = unitFileText(unitFile);
    const name = unitFileName(n);
    downloadAs(URL.createObjectURL(new Blob([text], { type: "application/json" })), name, true);
    setSaveResult(
      "unit",
      "written",
      `${name} downloaded — ${unitFile.storeys.length} storey(s), ${text.length} bytes`
    );
  }

  // 3. The library entry.
  if (sel.library && unitFile) await saveLibraryEntry(unitName, color, unitFile);

  // 4. Publish to the session: the unit download's EXACT bytes, PUT to the
  //    store on this origin as `unit-<n>` (docs/store.md). The files above are
  //    already written, so a failure of any kind is one red line and nothing
  //    else; `publishUnit` never throws. A CONFLICT WITH REPLACE TICKED asks
  //    first, naming the current owner (run 0025), before the takeover PUT
  //    goes out — the first attempt never sends `replace=1` itself, so the
  //    store's own 409 is what tells this code there is anyone to ask about;
  //    declining costs only this line, nothing already written. Right after a
  //    real publish, its axonometric follows to the SAME id — a failed
  //    preview is noted on the same line and never undoes the flat publish.
  if (sel.publish && unitFile) {
    const id = slugifyUnitName(unitName);
    const text = unitFileText(unitFile);
    const doFetch: FetchLike = (url, init) => fetch(url, init);
    let r = await publishUnit(doFetch, "", session, id, unitName, text, false);
    let declined = false;
    if (!r.ok && r.status === 409 && r.ownerResident !== undefined && saveReplaceInput.checked) {
      const confirmed = window.confirm(takeoverConfirmText(r.ownerResident));
      const decision = decideTakeover(r, saveReplaceInput.checked, confirmed);
      if (decision.action === "retry") {
        r = await publishUnit(doFetch, "", session, id, unitName, text, true);
      } else if (decision.action === "declined") {
        declined = true;
        setSaveResult("publish", "skipped", decision.detail);
      }
    }
    if (!declined) {
      if (r.ok) {
        // Words, run 0026: "Sent to <code> as <label>", the brief's exact
        // phrasing (run 0025's "Published as… to…, version N" carried the
        // same facts in session wording; the version now shows only when it
        // moved, since "version 1" says nothing a first send doesn't already
        // imply).
        let line = `Sent to ${session.code} as ${r.label}`;
        if (r.version > 1) line += `, version ${r.version}`;
        const preview = captureFlatPreview();
        if (preview.dataUrl.startsWith("data:image/jpeg") && preview.bytes >= 1000) {
          const jpeg = await fetch(preview.dataUrl).then((res) => res.blob());
          const pr = await publishPreview(doFetch, "", session.code, r.id, jpeg);
          if (!pr.ok) line += ` (preview not sent — ${pr.reason})`;
        } else {
          line += ` (preview not sent — read back ${preview.bytes} bytes)`;
        }
        // Names the next step (run 0025, UX pass — "end flows memorably",
        // "make completion feel closer"): where to go and check it landed.
        line += " · open Units to see your group.";
        setSaveResult("publish", "written", line);
        saveReplaceInput.checked = false; // one deliberate tick per takeover, not a standing default
        void unitBrowser.refresh(); // an open panel shows the neighbours' list with this flat in it
      } else {
        const detail =
          r.ownerResident !== undefined
            ? `not published — ${r.ownerResident} already owns ${unitName} in ${session.code}; tick Replace to take it over`
            : `not published — ${r.status ? `${r.status} ` : ""}${r.reason}`;
        setSaveResult("publish", "failed", detail);
      }
    }
  }

  saveGoBtn.disabled = isEmptySelection(readSaveSelection());
}

/**
 * The library entry: the unit file plus a canvas JPEG preview plus a manifest
 * row, written by the dev sink (vite.config.ts). A production build has no
 * sink, so the pair downloads instead.
 *
 * REPLACE OR NEW: when the manifest already holds this name, ask. Answering
 * yes overwrites that entry in place, keeping its id; answering no falls back
 * to the suffixed-id behaviour and makes a second entry. Silently making the
 * second one was the behaviour before run 0019 and is what an author re-saving
 * a design almost never wants.
 */
async function saveLibraryEntry(
  name: string,
  color: string,
  unitFile: DwellingUnitFile
): Promise<void> {
  // The SAME axonometric a session publish sends (run 0024): every library
  // entry and every published flat's picture come from captureFlatPreview,
  // never from whatever angle the author happened to be viewing. It already
  // reads back and BYTE-CHECKS in the same turn — a hidden canvas "succeeds"
  // with an empty image, and an empty preview in the library is worse than a
  // refused save.
  const { dataUrl: preview, bytes: previewBytes } = captureFlatPreview();
  if (!preview.startsWith("data:image/jpeg") || previewBytes < 1000) {
    setSaveResult(
      "library",
      "failed",
      `not written — the preview read back ${previewBytes} bytes; make the 3D view visible and save again`
    );
    return;
  }

  if (!import.meta.env.DEV) {
    // No sink in a production build. Download the pair the sink would have
    // written, named by the name's slug alone — collision suffixes need the
    // manifest, and only the dev server owns that.
    const id = slugifyUnitName(name);
    downloadAs(
      URL.createObjectURL(new Blob([unitFileText(unitFile)], { type: "application/json" })),
      `${id}.json`,
      true
    );
    downloadAs(preview, `${id}.jpg`, false);
    setSaveResult(
      "library",
      "failed",
      `no dev server in this build, so nothing was written to the library — downloaded ${id}.json and ${id}.jpg instead; move them into units/ beside index.json and add a manifest row`
    );
    return;
  }

  const existing = findLibraryEntry(await readManifestEntries(), name);
  let replace = false;
  if (existing) {
    replace = window.confirm(
      `The library already holds "${existing.name}" (${existing.id}, saved ${existing.savedAt.slice(0, 10)}).\n\n` +
        `OK replaces that entry. Cancel keeps it and adds a second one under a new id.`
    );
  }

  try {
    const res = await fetch("/__library/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, unit: unitFile, preview, replace }),
    });
    const r = (await res.json()) as {
      ok: boolean;
      entry?: { id: string; areaM2: number };
      replaced?: boolean;
      error?: string;
    };
    if (r.ok && r.entry) {
      setSaveResult(
        "library",
        "written",
        `${r.replaced ? "replaced" : "added"} ${r.entry.id} in units/ — ${r.entry.areaM2} m², preview ${Math.round(previewBytes / 1024)} kB`
      );
      void unitBrowser.refresh(); // an open panel shows the new card at once
    } else {
      setSaveResult("library", "failed", `not written — ${r.error ?? "unknown error"}`);
    }
  } catch (err) {
    setSaveResult("library", "failed", `not written — ${(err as Error).message}`);
  }
}

saveNumberInput.addEventListener("input", syncSaveDialog);
saveColorInput.addEventListener("input", () => (saveColorTouched = true));
for (const input of Object.values(saveWhatInputs))
  input.addEventListener("change", syncSaveDialog);
saveGoBtn.addEventListener("click", () => void runSave());

/** Nothing authored yet: one floor, nothing placed, no doors, no entrances. Used
 *  to decide whether an import has anything to destroy. */
function isEmptyProject(): boolean {
  return (
    floors.floors.length <= 1 &&
    floors.floors.every(
      (f) => f.store.instances.size === 0 && f.doors.length === 0 && f.entrances.length === 0
    )
  );
}

/** Validate, confirm, then load — keeping the app's state intact on any failure.
 *  Returns true when a project was actually loaded (the unit browser closes
 *  itself only then; a declined confirm leaves it open). */
function importProjectText(text: string): boolean {
  let parsed;
  try {
    parsed = parseProject(text);
  } catch (err) {
    const msg =
      err instanceof ProjectParseError
        ? err.message
        : "Could not read this file.";
    showToast("error", `Import failed: ${msg}`);
    return false;
  }

  // Newer-than-app files: warn prominently and fold the replace confirm in, so
  // the user makes one informed decision.
  //
  // The confirm exists to protect work in progress, so it is skipped when there
  // is none: importing into a freshly opened app has nothing to replace. That
  // also makes this whole path usable without a human present, which is what the
  // ?project= loader depends on rather than routing around.
  const replacing = !isEmptyProject();
  if (replacing || parsed.status === "newer") {
    let confirmMsg = replacing
      ? "This will replace your current layout. Continue?"
      : "Load this project?";
    if (parsed.status === "newer")
      confirmMsg =
        `This file was created with a newer version (v${parsed.fileVersion}) of the app ` +
        `than you're running (v${APP_PROJECT_VERSION}). Some elements may not load correctly.` +
        (replacing ? " This will also replace your current layout." : "") +
        " Continue?";
    if (!window.confirm(confirmMsg)) return false;
  }

  let skippedRooms = 0;
  try {
    clearValidation();
    selection.deselect();
    skippedRooms = floors.loadProject(parsed.data).skipped;
    renderSidebar();
    syncNorthUI(); // a loaded file carries its own north — reflect it on the dial
    commitHistory(); // importing a project is an undoable action
  } catch (err) {
    console.error(err);
    showToast("error", "Import failed while loading — the file may be corrupt.");
    return false;
  }
  // Tolerant drop, never silent — cause-neutral (collision under current
  // preset footprints, out-of-bounds, whatever made the normal path refuse).
  if (skippedRooms > 0)
    showToast("warn", `${skippedRooms} room(s) could not be placed.`);

  if (parsed.status === "older")
    showToast(
      "info",
      `This file was made with an older version (v${parsed.fileVersion}) and has been loaded successfully.`
    );
  else if (parsed.status === "newer")
    showToast(
      "warn",
      `Loaded a newer-version (v${parsed.fileVersion}) file on an older app (v${APP_PROJECT_VERSION}). Some elements may be missing.`
    );
  else showToast("info", "Project imported.");
  return true;
}

function readAndImport(file: File): void {
  const reader = new FileReader();
  reader.onload = () => importProjectText(String(reader.result ?? ""));
  reader.onerror = () => showToast("error", "Could not read that file.");
  reader.readAsText(file);
}

// Hidden native file picker, driven by the sidebar's Import button.
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".json,application/json";
fileInput.style.display = "none";
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) readAndImport(file);
  fileInput.value = ""; // allow re-importing the same file
});
document.body.appendChild(fileInput);

// ---- Unit library browser (docs/library-format.md) ----
// The browser is the self-contained src/library module: it takes the manifest
// URL and hands back the fetched dwelling-unit file. Extracting sourceProject
// and running it through the NORMAL import path (confirm included) happens
// here, where the app's import machinery lives — the module knows nothing
// about this app's formats.
const unitBrowser = createUnitBrowser({
  manifestUrl: UNITS_MANIFEST_URL,
  mount: viewport,
  // The neighbours' flats (run 0023): the store's poll and one-flat calls on
  // this origin, for whatever session code is set at refresh time.
  session: {
    stateUrl: () => (session.code ? `/api/session/${encodeURIComponent(session.code)}` : null),
    flatUrl: (id) => `/api/session/${encodeURIComponent(session.code)}/flats/${encodeURIComponent(id)}`,
    previewUrl: (id) => `/api/session/${encodeURIComponent(session.code)}/flats/${encodeURIComponent(id)}/preview`,
    residentName: () => session.resident.trim(),
  },
  // Rename is DEV-ONLY for the same reason saving is: the manifest lives on
  // disk beside the units and only the dev server can write it. Omitting the
  // callback in a production build leaves the cards read-only, which is what
  // the module does without it.
  onRename: import.meta.env.DEV
    ? async (entry, newName) => {
        const res = await fetch("/__library/rename", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id, name: newName }),
        });
        const r = (await res.json()) as { ok: boolean; error?: string };
        if (!r.ok) throw new Error(r.error ?? "unknown error");
        showToast("info", `Renamed ${entry.id} to "${newName}".`);
      }
    : undefined,
  onOpen: (file) => {
    file
      .text()
      .then((text) => {
        let src: unknown;
        try {
          src = (JSON.parse(text) as { sourceProject?: unknown }).sourceProject;
        } catch {
          src = undefined;
        }
        if (!src || typeof src !== "object") {
          showToast("error", `${file.name} carries no sourceProject — cannot open a copy.`);
          return;
        }
        // A copy, not the library file: the import names nothing, so saving
        // the opened design later creates a NEW entry (ids suffix, never
        // overwrite). The panel closes only when something actually loaded —
        // declining the replace-confirm keeps it open.
        if (importProjectText(JSON.stringify(src))) unitBrowser.close();
      })
      .catch((err: Error) => showToast("error", `Could not read ${file.name}: ${err.message}`));
  },
});
document.getElementById("units-btn")!.addEventListener("click", () => unitBrowser.toggle());

// ---- Dev-only `?project=` loader ------------------------------------------
// Opens the app with a project already loaded, so a fixture can be examined
// without a human operating the file picker. `import.meta.env.DEV` is replaced by
// the literal `false` in a production build, so this whole block is dropped by
// tree-shaking and never ships.
//
// It goes through `readAndImport`, the SAME function the Import button calls, so
// parsing, the confirm, error handling and history behave identically. Only where
// the File comes from differs. A bare name resolves against `testflats/`.
if (import.meta.env.DEV) {
  // Dev-only handle on the live state, so a check can MEASURE the scene rather
  // than read a screenshot. The `?project=` loader made fixtures scriptable and
  // this makes their result scriptable too: span widths, marker positions, view
  // toggles and mesh visibility are all questions a picture answers badly.
  // Same `import.meta.env.DEV` gate, so it is dropped from a production build.
  (window as unknown as { __app: unknown }).__app = {
    floors, camera, scene, controls, renderer,
    enterPlanMode, exitPlanMode, isPlanMode: () => planMode,
    /** Render one frame and write the canvas to `captures/<name>` through the
     *  dev server's capture sink (vite.config.ts). The render has to happen in
     *  the same turn as the read, because the context is created without
     *  `preserveDrawingBuffer`, so anything read a frame later comes back
     *  cleared. */
    /** Build a `dwelling-unit` export from the CURRENT state, through the real
     *  exporter. Dev-only, beside `capture`, and for the same reason: it lets a
     *  check produce the actual artefact rather than describe it. Run 0021 used
     *  it to re-export every library unit so each carries `openCeilings`. */
    buildUnit(name: string, color: string) {
      return buildUnitExport(floors, name, color);
    },
    capture(name: string): Promise<unknown> {
      renderer.render(scene, camera);
      return fetch(`/__capture?name=${encodeURIComponent(name)}`, {
        method: "POST",
        body: canvas.toDataURL("image/png"),
      }).then((r) => r.json());
    },
    /** The one axonometric every flat gets (run 0024), through the exact
     *  function `saveLibraryEntry` and Publish call. Dev-only handle so a
     *  check can drive it directly and read the camera/controls before and
     *  after, to prove it leaves the live view untouched. */
    capturePreview(): { dataUrl: string; bytes: number } {
      return captureFlatPreview();
    },
    /** Load a project (a library entry's `sourceProject`, typically) and
     *  capture its preview in one call, for a batch re-render driven from
     *  outside the app. No confirm, no toast: this is a dev tool operating
     *  on state nobody is looking at, not a user-facing import. Run 0024
     *  used it once to put every committed library unit through the same
     *  function a session publish now uses. */
    loadAndCapturePreview(sourceProject: unknown): { dataUrl: string; bytes: number } {
      floors.loadProject(sourceProject as ProjectFile);
      renderSidebar();
      syncNorthUI();
      return captureFlatPreview();
    },
  };
  const wanted = new URLSearchParams(location.search).get("project");
  if (wanted) {
    const url = wanted.includes("/") ? wanted : `/testflats/${wanted}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.blob();
      })
      .then((blob) => readAndImport(new File([blob], url.split("/").pop() ?? "project.json")))
      .catch((err) => showToast("error", `?project= could not load ${url}: ${err.message}`));
  }
}

// Drag-and-drop a .json onto the viewport. A depth counter keeps the highlight
// stable as the pointer moves over child elements (each fires dragenter/leave).
const dropOverlay = document.getElementById("drop-overlay") as HTMLElement;
let dragDepth = 0;

function showDrop(on: boolean): void {
  dropOverlay.classList.toggle("active", on);
}

viewport.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  showDrop(true);
});
viewport.addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
});
viewport.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) showDrop(false);
});
viewport.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  showDrop(false);
  const file = e.dataTransfer?.files?.[0];
  if (file) readAndImport(file);
});

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
}

// ---- Undo / redo (history) ----
// Restore reuses the project-import rebuild path (floors.loadProject) minus the
// confirm/parse — the SAME code path manual building and import use. It clears
// selection + any stale validation, keeps the active floor if it still exists
// (else clamps), and leaves camera / floor-visibility untouched. Plan mode is
// exited only if the floor STACK shape changed (its per-index bookkeeping would
// otherwise be stale — matching onStructureChange's behaviour).
function restoreState(snapshot: string): void {
  const data = JSON.parse(snapshot) as ProjectFile;
  // View state is NOT part of a snapshot — capture it so the rebuild (which
  // makes fresh, all-visible floors) doesn't disturb it. Active floor + per-
  // floor visibility are preserved by index (clamped if the stack shrank).
  const prevActive = floors.activeIndexValue;
  const prevCount = floors.floors.length;
  const prevVisible = floors.floors.map((_, i) => floors.isFloorVisible(i));

  selection.deselect();
  clearValidation();
  floors.loadProject(data); // rebuilds floors + all derived state; sets active 0
  const newCount = floors.floors.length;

  // Plan mode's per-index bookkeeping goes stale if the stack shape changed;
  // exit it (matching onStructureChange). Otherwise restore visibility by index.
  if (planMode && newCount !== prevCount) {
    exitPlanMode();
  } else if (!planMode) {
    floors.floors.forEach((_, i) => floors.setFloorVisible(i, prevVisible[i] ?? true));
  }

  floors.setActive(Math.min(prevActive, newCount - 1));
  renderSidebar();
  syncNorthUI(); // north is in the snapshot — reflect the restored angle on the dial
  refreshFlatCard(); // an undo/redo/import changes the flat as much as any edit does
}

function updateHistoryButtons(): void {
  undoBtn.disabled = !history?.canUndo;
  redoBtn.disabled = !history?.canRedo;
}

history = new History(
  () => JSON.stringify(serializeProject(floors.floors, floors.northAngle, floors.orientationPreference)),
  restoreState,
  updateHistoryButtons,
  20
);
updateHistoryButtons();

undoBtn.addEventListener("click", () => history?.undo());
redoBtn.addEventListener("click", () => history?.redo());

window.addEventListener("keydown", (e) => {
  // Don't hijack shortcuts while typing in the sidebar inputs.
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (e.key === "Escape") {
    // The single Escape arbitrator: one predictable key, checked in exactly
    // this priority order — cancel an in-progress GESTURE first (palette
    // ghost placement, a Shift+D duplicate ghost, or entrance/door-placement
    // mode), then clear the SELECTION, then exit PLAN MODE.
    // dragDrop/selection/entrance+doorController no longer listen for Escape
    // themselves (see their class docs), so exactly one of these things
    // happens per keypress, never more than one.
    if (dragDrop.isDragging) {
      dragDrop.cancelPlacement();
      return;
    }
    if (selection.isDuplicating) {
      selection.cancelDuplicate();
      return;
    }
    if (entranceController.isActive) {
      entranceController.cancel();
      return;
    }
    if (doubleHeightController.isActive) {
      doubleHeightController.cancel();
      return;
    }
    if (doorController.isActive) {
      doorController.cancel();
      return;
    }
    if (selection.hasSelection) {
      selection.deselect();
      return;
    }
    if (planMode) exitPlanMode();
    return;
  }

  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) {
    e.preventDefault();
    history?.undo();
  } else if (k === "y" || (k === "z" && e.shiftKey)) {
    e.preventDefault();
    history?.redo();
  }
});

// ---- Resize handling ----
const resizeObserver = new ResizeObserver(() => ctx.handleResize());
resizeObserver.observe(canvas);
window.addEventListener("resize", () => ctx.handleResize());

// The save column is always visible (run 0026), so its own state needs one
// startup read rather than waiting for a first "open".
void openSaveDialog();
refreshFlatCard();

// ---- Render loop ----
/** Timestamp of the previous frame, for a real delta rather than an assumed
 *  60 fps. The gesture tweens are time-based, so a slow frame must not make the
 *  ghost lag behind the pointer. */
let lastFrameMs = performance.now();

function animate(): void {
  requestAnimationFrame(animate);
  const now = performance.now();
  // Clamp the delta: a backgrounded tab resumes with a delta of seconds, and an
  // unclamped one would teleport every tween to its destination in one frame.
  const dt = Math.min(0.1, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  if (graphView.visible) {
    // In diagram mode: skip the 3D render, drive the bubble diagram instead.
    graphView.frame();
    return;
  }
  // Gesture motion first, so a tween and the frame that shows it agree.
  ghost.tick(dt);
  tickGhostAnimations(dt);
  for (const f of floors.floors) f.gridView.tick(dt);
  controls.update();
  updateCutaway(scene, camera.position, controls.target);
  updateNorthBadge();
  renderer.render(scene, camera);
}

animate();
