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
import {
  flatPhase,
  canSend,
  sendButton,
  afterEdit,
  type SendState,
  showsDropHint,
  checksRun,
  showsLanding,
  UNTITLED,
  DASH,
  EMPTY_HINT,
  NO_WAY_IN,
  type FlatPhase,
} from "./core/flatState";
import { saveDraft, readDraft, DRAFT_RESTORED, type DraftStore } from "./core/draft";
import { JOURNEY, journeyTones } from "./core/journey";
import { slugifyUnitName } from "./library/ids";
import { unitNameFor, nextFreeNumber, findLibraryEntry } from "./library/naming";
import { parseUnitLibraryIndex, type UnitManifestEntry } from "./library/manifest";
import {
  outputLabel,
  type OutputKind,
  type OutputResult,
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
  whoLine,
  sessionLine,
  publishUnit,
  publishPreview,
  landingRecall,
  inventCode,
  startGroup,
  noSuchGroupText,
  checkGroup,
  storeAbsentText,
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
// flat's figures, its check chip, the empty state's drop hint and step 02's
// gate (run 0027, `refreshFlatFigures` below) all piggyback on the SAME
// single point rather than adding a second, narrower hook.
const commitHistory = () => {
  const snapshot = history?.commit() ?? null;
  refreshFlatFigures();
  // The flat is kept as you draw (run 0036). The SAME string the history just
  // took, so there is one serialization in the app and the draft cannot drift
  // from what undo restores. Every mutating action already comes through here.
  if (snapshot !== null) saveDraft(draftStore, snapshot);
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
// The menu reads "Open" since run 0027 and holds no save path at all: step
// 02's red button is the only thing that sends, and "More" beside it is the
// only thing that writes files. What is left here are the two ways to bring
// something IN, which is what the bar is for.
document.getElementById("menu-import")!.addEventListener("click", () => {
  setSaveOpenOpen(false);
  fileInput.click();
});
// Start over goes back to the landing WITHOUT touching the flat. A menu item
// that quietly destroyed an afternoon's work would be the worst thing in the
// app; the landing's own primary door reads "Back to your flat" while there
// is something to come back to, and "Open a file" from there still replaces
// it through the usual import confirm.
document.getElementById("menu-start-over")!.addEventListener("click", () => {
  setSaveOpenOpen(false);
  showLanding();
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

// The Check Layout button left the top bar in run 0027. The check chip is the
// way in now (`refreshFlatFigures` wires both copies of it to `runCheck`), and
// the report closes from its own ✕, which `renderValidationPanel` has always
// carried. Escape is still NOT a second way out: it already arbitrates
// drag-abort, selection-clear and plan-view exit (see the keydown handler),
// and giving it a fourth meaning would make which one fires depend on state
// the user cannot see.
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
/** The design number left the screen in run 0036 and is chosen automatically:
 *  the next free one across the library and this group, proposed by
 *  `openSaveDialog`. It stays a number the app knows rather than one a resident
 *  has to pick, because nothing they could pick would be better than the next
 *  free one and a wrong pick collides with a neighbour. */
let designNumber = 1;
const saveColorInput = document.getElementById("save-color") as HTMLInputElement;
const saveNamesLine = document.getElementById("save-names") as HTMLElement;
const saveResultsEl = document.getElementById("send-results") as HTMLElement;
const saveGoBtn = document.getElementById("save-go") as HTMLButtonElement;
const saveGoLabelEl = document.getElementById("save-go-label") as HTMLElement;
const sendStaleEl = document.getElementById("send-stale") as HTMLElement;
/** How far this flat has got towards the group, in this visit (run 0034, a
 *  third state in run 0035). It is what turns step 02's one red button from
 *  the send button into the way to the group, and what puts the line under it
 *  saying the group is looking at an older flat. ONE value: the rules that
 *  read it are `sendButtonLabel` and `staleNotice` in src/core/flatState.ts,
 *  and `afterEdit` is the only thing that moves it on an edit. */
let sendState: SendState = "never";
/** How many things the layout check has to say about this flat. Counted once
 *  in `refreshFlatFigures`, where the chip already counts them, and read by
 *  the one button rule (run 0036). */
let complaints = 0;

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

// ---- The flat's own figures (run 0026 in the save column; run 0027 in the
// top bar while drawing and under the drawing while sending) ----
// They read what the CURRENT design already is, not what a save is about to
// write, straight from `floors` — the same source `buildUnitExport` and
// `validate` read for the layout report and for the unit build below.
//
// TWO places render them, one per step, and never both at once: the bar's
// strip (step 01) and the read-out under the drawing (step 02). One call
// writes both, so they cannot drift.
const figBar = document.getElementById("tb-figures") as HTMLElement;
const figAreaEl = document.getElementById("fig-area") as HTMLElement;
const figStoreysEl = document.getElementById("fig-storeys") as HTMLElement;
const figGlazingEl = document.getElementById("fig-glazing") as HTMLElement;
const figCheckEl = document.getElementById("fig-check") as HTMLButtonElement;
const readoutEl = document.getElementById("flat-readout") as HTMLElement;
const frNameEl = document.getElementById("fr-name") as HTMLElement;
const frAreaEl = document.getElementById("fr-area") as HTMLElement;
const frStoreysEl = document.getElementById("fr-storeys") as HTMLElement;
const frGlazingEl = document.getElementById("fr-glazing") as HTMLElement;
const frRoomsEl = document.getElementById("fr-rooms") as HTMLElement;
const frCheckEl = document.getElementById("fr-check") as HTMLButtonElement;
const dropHintEl = document.getElementById("drop-hint") as unknown as SVGSVGElement;
const dropHintShape = document.getElementById("drop-hint-shape") as unknown as SVGPolygonElement;
const dropHintLabel = document.getElementById("drop-hint-label") as unknown as SVGTextElement;

/**
 * Trace the ACTIVE floor's grid onto the screen, so the empty state's hint is
 * the plate's own size and shape.
 *
 * It was a CSS diamond of a fixed 190px, which could not be either: how big the
 * plate looks depends on the grid dimensions and on where the camera is, and a
 * box in the page knows neither. So the four corners are projected through the
 * camera every frame the hint is up, which is only ever an empty flat.
 *
 * The grid is centred on the world origin (`sizeGroundPlane` above scales a
 * unit plane, and `floorManager.ts:917` reads the same half-extents), so the
 * corners are ±half the world width by ±half the world depth at the floor's
 * own height.
 */
const dropHintCorner = new THREE.Vector3();
function syncDropHint(): void {
  if (!dropHintEl.classList.contains("show")) return;
  // The hint is also drawn outside the loop, on the frame it appears, when the
  // renderer may not have run since the camera last moved. `project` reads
  // `matrixWorldInverse`, which only the renderer maintains, so refresh both
  // here rather than trusting whatever the last render left behind.
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const grid = floors.active.grid;
  const halfW = grid.worldWidth / 2;
  const halfD = grid.worldDepth / 2;
  const y = floors.active.group.position.y;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  let cx = 0;
  let cy = 0;
  const points: string[] = [];
  // Wound in order, so the polygon is the quadrilateral and not a bow tie.
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    dropHintCorner.set(sx * halfW, y, sz * halfD).project(camera);
    const px = (dropHintCorner.x * 0.5 + 0.5) * w;
    const py = (-dropHintCorner.y * 0.5 + 0.5) * h;
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    cx += px / 4;
    cy += py / 4;
  }
  dropHintShape.setAttribute("points", points.join(" "));
  dropHintLabel.setAttribute("x", cx.toFixed(1));
  dropHintLabel.setAttribute("y", cy.toFixed(1));
}

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
  // A hidden tab runs no animation frames at all, so a tween started there
  // would never write its own result and the number would sit at whatever it
  // last showed until the next edit (found live: an area stuck on a dash
  // while the storeys and glazing beside it were right). Write it straight
  // out instead; there is nobody watching it move.
  if (document.hidden) {
    el.textContent = String(target);
    state.shown = target;
    state.raf = 0;
    countState.set(el, state);
    return;
  }
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

/** How many modules are placed across every floor, of any kind. The one
 *  input the empty-state rule needs: a resident who has dropped a single
 *  hall tile has started, and the grid should stop hinting at them. */
function placedRooms(): number {
  return floors.floors.reduce((n, f) => n + f.store.instances.size, 0);
}

/** How many of those are ROOMS, which is what step 02's fourth figure
 *  claims to count. Circulation, outdoor and stairs are placed the same
 *  way but are not rooms, and a 1x1 hall tile counting as one would make
 *  a four-room flat read as twenty-nine (found live). The three tests are
 *  `unitExport.ts`'s own `kindOf`, restated rather than imported, since
 *  that function is internal to the export. */
function habitableRooms(): number {
  return floors.floors.reduce(
    (n, f) =>
      n +
      [...f.store.instances.values()].filter(
        (i) =>
          i.def.cluster !== "outdoor" && i.def.cluster !== "circulation" && i.def.category !== "stair"
      ).length,
    0
  );
}

/** The phase the whole chrome reads, recomputed here and nowhere else
 *  (run 0027). Kept as the last answer so a caller that only wants to ask
 *  "can this be sent yet?" does not have to build the unit again. */
let phase: FlatPhase = "empty";

/**
 * Recomputed on every mutating action (`commitHistory`, above) and once at
 * startup: the phase, the three figures, the check chip, the drop hint and
 * the step-02 gate, all from ONE build of the unit through
 * `buildUnitExport`, the same function the save itself calls, so nothing on
 * screen can disagree with what a send would write.
 *
 * Before anything is placed the figures read dashes, the name reads
 * "Untitled" and the chip is a hint rather than a fault: an untouched grid
 * has no fault to report. From the first placed room the numbers and the
 * check line behave exactly as they did before run 0027, including the
 * gate's own reason when the unit cannot be built yet.
 */
function refreshFlatFigures(): void {
  // A flat that has been edited has not been sent as it now stands, so step 02's
  // button goes back to being the send button and, if something DID go to the
  // group before this edit, says so underneath (run 0034, run 0035).
  sendState = afterEdit(sendState);
  const rooms = placedRooms();
  const built = buildUnitExport(floors, "", "#000000");
  phase = flatPhase(rooms, built.ok);
  const stats = built.ok ? unitStats(built.file.storeys) : { areaM2: 0, storeys: 0, glazingM: 0 };
  const empty = phase === "empty";

  // A figure is only shown when the unit BUILDS, since `unitStats` reading
  // that one build is the only source any of these numbers have. Before the
  // first room there is nothing to measure; while the flat has no way in
  // there is no unit to measure either, and run 0026 showed 0 m² there,
  // which reads as a measurement rather than as the absence of one. A dash
  // says the true thing in both cases, and the chip beside it says which.
  const measured = built.ok;
  const storeys = measured ? String(stats.storeys) : DASH;
  const glazing = measured ? String(stats.glazingM) : DASH;
  // The area is the one figure that counts up, matching the wireframe (only
  // its area carries the counting class).
  for (const el of [figAreaEl, frAreaEl]) {
    if (!measured) el.textContent = DASH;
    else animateCount(el, stats.areaM2);
  }
  figStoreysEl.textContent = storeys;
  figGlazingEl.textContent = glazing;
  frStoreysEl.textContent = storeys;
  frGlazingEl.textContent = glazing;
  frRoomsEl.textContent = empty ? DASH : String(habitableRooms());
  figBar.classList.toggle("figures-empty", !measured);
  readoutEl.classList.toggle("figures-empty", !measured);

  // The check chip, in both places. It is the only way into the layout
  // report since Check Layout left the bar (run 0027), so it stays
  // pressable in every state; the empty phase is the one exception, where
  // there is nothing to report and it reads as the hint the wireframe
  // asks for.
  let label: string;
  let cls: string;
  let title: string;
  if (!checksRun(phase)) {
    complaints = 0;
    // A hint, carrying no fault: it drops the pill outline entirely and
    // reads as the muted sentence FlatEmpty.dc.html shows in its card.
    label = EMPTY_HINT;
    cls = "chip chip-hint";
    title = EMPTY_HINT;
  } else if (!built.ok) {
    complaints = 1;
    label = "1 must fix";
    cls = "chip chip-acc";
    title = built.reason;
  } else {
    const hard = validate(
      computeDwellingGraph(floors.floors),
      floors.orientationPreference
    ).filter((v) => v.severity === "hard");
    // The same count the chip shows, kept for step 02's button so the two can
    // never disagree about how many things there are to look at (run 0036).
    complaints = hard.length;
    label = hard.length ? `${hard.length} must fix` : "All checks pass";
    cls = hard.length ? "chip chip-acc" : "chip chip-ok";
    title = hard.length ? `${hard[0].description} — open the layout report` : "Open the layout report";
  }
  for (const chip of [figCheckEl, frCheckEl]) {
    chip.className = cls;
    chip.textContent = label;
    chip.title = title;
    chip.disabled = !checksRun(phase);
  }

  dropHintEl.classList.toggle("show", showsDropHint(phase));
  // Once on the way in, so it is right on the frame it appears rather than one
  // frame later; `animate` keeps it right after that.
  syncDropHint();
  syncStepTabs();
  syncSaveDialog();
}

/** "Show me" and the chip are the same door into the layout report, which
 *  is the report Check Layout used to open from the bar. */
figCheckEl.addEventListener("click", () => runCheck());
frCheckEl.addEventListener("click", () => runCheck());

// ---- Two steps, one panel at a time (run 0027) ------------------------------
// `body[data-step]` is the whole switch; style.css shows and hides against it,
// and nothing moves in the DOM, so the scene is never rebuilt by a step change.
// Step 02 is locked while `canSend` says the flat has no way in, and pressing
// it anyway says why rather than doing nothing.

type Step = "draw" | "send";
const stepDrawBtn = document.getElementById("step-draw") as HTMLButtonElement;
const stepSendBtn = document.getElementById("step-send") as HTMLButtonElement;
const forwardGoBtn = document.getElementById("forward-go") as HTMLButtonElement;
const forwardWhyEl = document.getElementById("forward-why") as HTMLElement;
let step: Step = "draw";

function setStep(next: Step): void {
  if (next === "send" && !canSend(phase)) {
    showToast("warn", NO_WAY_IN);
    return;
  }
  step = next;
  document.body.dataset.step = next;
  syncStepTabs();
  if (next === "send") {
    // The flat is shown whole and centred on this screen, so the camera is
    // framed on arrival. `resetToExtent` is the same framing Frame does.
    resetToExtent();
    void openSaveDialog(); // the proposed number may be stale by now
  }
}

/** The tabs read the current step and the gate, and nothing else. Called on
 *  every mutating action through `refreshFlatFigures`, so an entrance placed
 *  in step 01 lights step 02 up at once. */
function syncStepTabs(): void {
  const open = canSend(phase);
  // Run 0034: the bar's 02 and the viewport's forward button read this ONE
  // call, on the same line, so they cannot disagree about whether the flat
  // is ready. The sentence under the button is the same sentence the bar's
  // 02 carries as its title.
  forwardGoBtn.setAttribute("aria-disabled", String(!open));
  forwardWhyEl.textContent = open ? "" : NO_WAY_IN;
  stepDrawBtn.setAttribute("aria-selected", String(step === "draw"));
  stepSendBtn.setAttribute("aria-selected", String(step === "send"));
  stepDrawBtn.classList.toggle("done", step === "send");
  // `aria-disabled` rather than `disabled`: a disabled button fires no click
  // at all, so the one resident who most needs to hear why the step is shut
  // would press it and get silence (found live). It stays pressable and
  // answers; `setStep` is what actually refuses.
  stepSendBtn.setAttribute("aria-disabled", String(!open));
  stepSendBtn.title = open ? "" : NO_WAY_IN;
  // A flat that loses its way in while step 02 is up (an entrance deleted
  // through undo, say) drops back rather than stranding a resident on a
  // screen whose one button cannot work.
  if (step === "send" && !open) setStep("draw");
}

stepDrawBtn.addEventListener("click", () => setStep("draw"));
stepSendBtn.addEventListener("click", () => setStep("send"));
// One way forward out of step 01 (run 0034). It goes through `setStep`, which
// is the same refusal the bar's 02 gets, so an asleep press says why rather
// than doing nothing.
forwardGoBtn.addEventListener("click", () => setStep("send"));

// ---- The landing (run 0027) -------------------------------------------------
// It covers the editor rather than replacing it, so the scene behind it is
// already warm by the time a resident picks a door.

/** Where the building app lives. ONE constant: the landing's "Go to your
 *  group" is the only handoff between the two apps that a resident drives,
 *  and it carries the group CODE rather than any flat data, because the
 *  store (docs/store.md) is the shared thing both apps read. Sending the
 *  key and letting the far side fetch is the database-mediated exchange
 *  the `interoperability` skill's own decision matrix points at for two
 *  tools that already share a store. */
const BUILDING_APP_URL = "http://localhost:5182/";

/** The building app on THIS resident's group, or its front door when there
 *  is no group yet. One place, read by the landing's "Go to your group" and
 *  by step 02's button after a send (run 0034). */
function groupUrl(): string {
  return session.code
    ? `${BUILDING_APP_URL}?session=${encodeURIComponent(session.code)}`
    : BUILDING_APP_URL;
}

const landingEl = document.getElementById("landing") as HTMLElement;
const landingDoors = document.getElementById("landing-doors") as HTMLElement;

/** Show the doors again without replaying run 0034's arrival. Coming back
 *  from the join form or the new-group form re-shows the same element, and a
 *  `display` change restarts a CSS animation, so a resident pressing "back"
 *  would sit through the stagger a second time. `.no-arrive` in style.css
 *  turns it off; the first show, in `showLanding`, never carries it. */
function showLandingDoors(): void {
  landingDoors.classList.add("no-arrive");
  landingDoors.hidden = false;
}
const landingJoinForm = document.getElementById("landing-join-form") as HTMLFormElement;
const landingStartLabel = document.getElementById("landing-start-label") as HTMLElement;
const landingCode = document.getElementById("landing-code") as HTMLInputElement;
const landingName = document.getElementById("landing-name") as HTMLInputElement;
const landingWhy = document.getElementById("landing-join-why") as HTMLElement;
const landingRecallLine = document.getElementById("landing-join-recall") as HTMLElement;
const landingNewForm = document.getElementById("landing-new-form") as HTMLFormElement;
const landingNewCode = document.getElementById("landing-new-code") as HTMLElement;
const landingNewName = document.getElementById("landing-new-name") as HTMLInputElement;
const landingNewWhy = document.getElementById("landing-new-why") as HTMLElement;
const landingGroupLink = document.getElementById("landing-group") as HTMLAnchorElement;

function showLanding(): void {
  landingEl.hidden = false;
  landingDoors.hidden = false;
  landingJoinForm.hidden = true;
  landingNewForm.hidden = true;
  // Nothing is destroyed on the way here, so the primary door says what it
  // will really do: open an empty grid the first time, and hand back an
  // afternoon's work every time after that.
  landingStartLabel.textContent = isEmptyProject() ? "Start a flat" : "Back to your flat";
  // One rule, one place (src/session/session.ts): a first visit shows two empty
  // fields and says nothing, and a return visit says plainly that it is picking
  // up rather than guessing at the person in front of it.
  const recall = landingRecall(session);
  landingCode.value = recall.code;
  landingName.value = recall.name;
  landingRecallLine.textContent = recall.line;
  landingRecallLine.hidden = recall.line.length === 0;
  landingWhy.textContent = "";
  landingGroupLink.href = groupUrl();
}

function hideLanding(): void {
  landingEl.hidden = true;
}

/** The journey strip, rendered from src/core/journey.ts rather than written
 *  into the landing's markup, so the building app can render the same six
 *  steps from the same array. */
function renderJourney(): void {
  const strip = document.getElementById("journey-strip") as HTMLElement;
  // Run 0034, the brief: all six dots always, the two this app owns in ink,
  // the building app's four dim, and the one a resident is on in red. The
  // building app calls the same function with "building" and gets the mirror.
  const tones = journeyTones("draw", "flat");
  const parts: HTMLElement[] = [];
  JOURNEY.forEach((s, i) => {
    if (i > 0) {
      const rule = document.createElement("div");
      rule.className = "journey-rule";
      parts.push(rule);
    }
    const el = document.createElement("div");
    el.className = `journey-step ${tones[i]}`;
    const dot = document.createElement("span");
    dot.className = "journey-dot";
    const label = document.createElement("span");
    label.className = "journey-label";
    label.textContent = s.label;
    el.append(dot, label);
    parts.push(el);
  });
  strip.replaceChildren(...parts);
}

document.getElementById("landing-start")!.addEventListener("click", () => {
  hideLanding();
  setStep("draw");
});
document.getElementById("landing-open")!.addEventListener("click", () => {
  // The same picker the bar's Open menu uses. The landing hides only once a
  // file actually loads, which `readAndImport` reports through `importProjectText`.
  fileInput.click();
});
// Start a group: invent a code, start it in the store, show it back. A code
// the store refuses is one somebody else already took, so it tries again with
// another rather than telling the resident about a collision they did not cause.
document.getElementById("landing-new")!.addEventListener("click", async () => {
  landingDoors.hidden = true;
  landingNewForm.hidden = false;
  landingNewWhy.textContent = "";
  landingNewCode.textContent = "…";
  landingNewName.value = session.resident;

  const tried = new Set<string>();
  let code: string | null = null;
  for (let i = 0; i < 5 && code === null; i++) {
    const candidate = inventCode((c) => tried.has(c));
    if (candidate === null) break;
    tried.add(candidate);
    if (await startGroup(candidate)) code = candidate;
  }
  if (code === null) {
    landingNewCode.textContent = "—";
    landingNewWhy.textContent = "Could not reach the store to start a group. Try again in a moment.";
    return;
  }
  landingNewCode.textContent = code;
  landingNewName.focus();
});
document.getElementById("landing-new-back")!.addEventListener("click", () => {
  landingNewForm.hidden = true;
  showLandingDoors();
});
landingNewForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const next = { resident: landingNewName.value, code: normalizeCode(landingNewCode.textContent ?? "") };
  const why = whyPublishDisabled(next);
  if (why !== null) {
    landingNewWhy.textContent = why;
    return;
  }
  session = next;
  writeSession(sessionStorageArea, session);
  saveResidentInput.value = session.resident;
  saveCodeInput.value = session.code;
  syncSessionUI();
  syncSaveDialog();
  hideLanding();
  setStep("draw");
});
document.getElementById("landing-join")!.addEventListener("click", () => {
  landingDoors.hidden = true;
  landingJoinForm.hidden = false;
  landingCode.focus();
});
document.getElementById("landing-join-back")!.addEventListener("click", () => {
  landingJoinForm.hidden = true;
  showLandingDoors();
});
landingJoinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  // The SAME two values the send panel's own fields hold, written through
  // the same `writeSession`, so joining here and typing there leave state
  // that cannot be told apart. `whyPublishDisabled` is reused as the one
  // definition of "these two are usable".
  const next = { resident: landingName.value, code: normalizeCode(landingCode.value) };
  const why = whyPublishDisabled(next);
  if (why !== null) {
    landingWhy.textContent = why;
    return;
  }
  // Joining means joining (run 0032). Before this a code nobody had started was
  // conjured on the spot, so one typo started an empty group of one while the
  // resident believed they had joined the twenty.
  landingWhy.textContent = "";
  const checked = await checkGroup(next.code);
  if ("failure" in checked) {
    landingWhy.textContent =
      checked.failure === "absent"
        ? storeAbsentText()
        : `The store could not answer for ${next.code}. Try again in a moment.`;
    return;
  }
  if (!checked.started) {
    landingWhy.textContent = noSuchGroupText(next.code);
    return;
  }
  session = next;
  writeSession(sessionStorageArea, session);
  saveResidentInput.value = session.resident;
  saveCodeInput.value = session.code;
  syncSessionUI();
  syncSaveDialog();
  hideLanding();
  setStep("draw");
});
// The four "What to write" checkboxes went in run 0036, with the design number
// and the Replace tick. All four were ticked by default, so one press wrote
// four things and two of them landed in a resident's Downloads folder
// uninvited. Three are now separate, named presses under More; the fourth is
// the button itself.

/** Once the colour is touched by hand it stops following the name hash, for
 *  the rest of the session. */
let saveColorTouched = false;

/** The three things a resident may still ask to have written, under More. The
 *  last two exist in the dev build only: a library entry is written by a Vite
 *  endpoint that no deployed build has. */
const saveProjectCopyBtn = document.getElementById("save-project-copy") as HTMLButtonElement;
const saveLibraryBtn = document.getElementById("save-library") as HTMLButtonElement;
const saveUnitFileBtn = document.getElementById("save-unit-file") as HTMLButtonElement;
saveLibraryBtn.hidden = !import.meta.env.DEV;
saveUnitFileBtn.hidden = !import.meta.env.DEV;

// ---- The session: who, and which room (src/session/session.ts) -------------
// Two fields at the top of the save dialog, remembered in localStorage under
// one key and shown in the top bar. A `?session=` in the URL wins over the
// stored code and is stored. Neither is ever written into a project file.
const saveWhoLineEl = document.getElementById("save-who-line") as HTMLElement;
const saveWhoChangeBtn = document.getElementById("save-who-change") as HTMLButtonElement;
const saveSessionFields = document.getElementById("save-session-fields") as HTMLElement;
/** Whether the resident asked to see the two fields again. Once open, they
 *  stay open for the visit: somebody who pressed "change" is mid-correction and
 *  should not have the fields fold under them on the next keystroke. */
let whoFieldsOpen = false;
const saveResidentInput = document.getElementById("save-resident") as HTMLInputElement;
const saveCodeInput = document.getElementById("save-session") as HTMLInputElement;
// The Replace tick went in run 0036. A flat belongs to whoever published it
// (docs/store.md), and taking over somebody else's is no longer something a
// resident can do from this screen. The store still refuses it with a 409,
// which is reported as it comes.
const tbSession = document.getElementById("tb-session") as HTMLElement;
const tbCode = document.getElementById("tb-code") as HTMLElement;

// Run 0025 folded these two fields behind a one-line summary once both were
// set, which earned its place while they sat at the top of a save dialog
// full of other things. On step 02 they ARE the screen, next to the button
// that uses them (FlatSend.dc.html), so run 0027 retired the fold and both
// fields stay open.

/** localStorage, or null where the browser refuses it (a sandboxed frame). */
/** The draft's own storage, separate from the session's only so that a
 *  failure to read one cannot cost the other. Same `localStorage`. */
const draftStore: DraftStore | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

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
  // Who is sending and where to, answered once on the landing (run 0036). The
  // fields are folded while the answer is complete, and open while it is not,
  // because a resident who has not said who they are needs somewhere to say it.
  const who = whoLine(session);
  saveWhoLineEl.textContent = who.line;
  saveWhoChangeBtn.hidden = !who.ready;
  saveSessionFields.hidden = who.ready && !whoFieldsOpen;
  tbSession.textContent = sessionLine(session);
  tbSession.classList.toggle("set", session.code.length > 0);
  // The code itself, read from `session` rather than kept anywhere new, so
  // there is still exactly one place it lives.
  tbCode.textContent = session.code;
  tbCode.hidden = session.code.length === 0;
}

function onSessionInput(): void {
  session = { resident: saveResidentInput.value, code: normalizeCode(saveCodeInput.value) };
  if (saveCodeInput.value !== session.code) saveCodeInput.value = session.code;
  writeSession(sessionStorageArea, session);
  syncSessionUI();
  syncSaveDialog();
}
saveWhoChangeBtn.addEventListener("click", () => {
  whoFieldsOpen = true;
  syncSessionUI();
  saveCodeInput.focus();
});
saveResidentInput.addEventListener("input", onSessionInput);
saveCodeInput.addEventListener("input", onSessionInput);
saveResidentInput.value = session.resident;
saveCodeInput.value = session.code;
syncSessionUI();

/** The design number, chosen automatically (run 0036). */
function saveDesignNumber(): number {
  return designNumber;
}

/** Names line, proposed colour, and the Send button's enabled state, all
 *  re-derived from the inputs. Nothing ticked is not a save, and a flat with
 *  no way in cannot be sent at all (run 0027's one rule, the same one that
 *  gates step 02, so the button and the tab can never disagree). */
function syncSaveDialog(): void {
  const n = saveDesignNumber();
  // The flat's name lives here rather than in `refreshFlatFigures` because
  // the design number is proposed ASYNCHRONOUSLY (the manifest and the
  // group's own flats are both fetched): the figures are drawn long before
  // the number lands, and this is the one function that runs again when it
  // does (found live, where the read-out said "Unit 1" beside a line
  // promising "Flat 6 and Unit 6").
  frNameEl.textContent = phase === "empty" ? UNTITLED : unitNameFor(n);
  // What the flat will be called in the group. One name now rather than a
  // list built from four checkboxes (run 0036).
  saveNamesLine.textContent =
    `It becomes ${unitNameFor(n)}` +
    (numberCountsSession ? `, the next free number in the library and in ${session.code}` : "");
  if (!saveColorTouched) saveColorInput.value = defaultUnitColor(unitNameFor(n));
  // ONE rule for the button and the line under it (run 0036), over three
  // facts: whether the flat is ready, how far it has got towards the group,
  // and what the layout check has to say. Nothing here decides any of it.
  const button = sendButton(phase, sendState, complaints);
  saveGoLabelEl.textContent = button.label;
  sendStaleEl.textContent = button.notice;
  saveGoBtn.disabled = sendState === "sent" ? false : !button.awake;
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
 * Refresh the send panel's proposed number and session-derived state: the
 * NEXT FREE NUMBER, the lowest positive integer neither the library manifest
 * nor (with a group set) the group's own flats hold (src/library/naming.ts).
 * Named for what it did before run 0026 — open the dialog — since its call
 * sites (startup, opening "More", arriving on step 02) are the same "this is
 * now stale, freshen it" moments a dialog-open used to be.
 */
async function openSaveDialog(): Promise<void> {
  syncSessionUI();
  syncSaveDialog();
  // Once a flat has gone to the group it IS that number, so proposing again
  // would rename it under the resident and a copy saved from More would carry
  // a different name from the flat their neighbours are looking at (found
  // live: sent as Unit 31, saved as flat-32.json). The number only moves while
  // nothing has been sent (run 0036).
  if (sendState !== "never") return;
  const entries = await readManifestEntries();
  const sessionFlats = await readSessionFlatNames();
  numberCountsSession = session.code.length > 0;
  designNumber = nextFreeNumber(entries, sessionFlats);
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
 * Send the flat to the group, and do nothing else (run 0036).
 *
 * Pressing the red button used to run `runSave`, which downloaded a project
 * file, downloaded a unit file, wrote a library entry and published, in that
 * order, whichever of the four were ticked. All four were ticked by default,
 * so one press put two files in a resident's Downloads folder they had not
 * asked for. Sending is now sending: the only thing that leaves this machine
 * is the flat, and it goes to the group.
 *
 * The unit's own bytes are the same bytes the unit file would carry, built
 * from the same `buildUnitExport`, so what the group holds and what a resident
 * can save under More cannot differ.
 *
 * A resident's own earlier flat in the group is replaced without asking. The
 * store decides that, by `sameResident` (docs/store.md): a republish under the
 * same name is not a conflict and needs no `?replace=1`. Taking over somebody
 * ELSE's flat is no longer something a resident can do from this screen; the
 * store still refuses it with a 409, which is reported as it comes.
 */
async function runSend(): Promise<void> {
  const n = saveDesignNumber();
  const unitName = unitNameFor(n);
  saveResults.clear();
  setSaveResult("publish", "pending", "sending…");
  saveGoBtn.disabled = true;

  const built = buildUnitExport(floors, unitName, saveColorInput.value);
  if (!built.ok) {
    setSaveResult("publish", "failed", `not sent — ${built.reason}`);
    syncSaveDialog();
    return;
  }

  const id = slugifyUnitName(unitName);
  const text = unitFileText(built.file);
  const doFetch: FetchLike = (url, init) => fetch(url, init);
  const r = await publishUnit(doFetch, "", session, id, unitName, text, false);
  if (r.ok) {
    // Words, run 0026: "Sent to <code> as <label>", the brief's exact phrasing.
    // The version shows only when it moved, since "version 1" says nothing a
    // first send does not already imply.
    let line = `Sent to ${session.code} as ${r.label}`;
    if (r.version > 1) line += `, version ${r.version}`;
    // The axonometric follows to the SAME id. A failed preview is noted on the
    // same line and never undoes the flat itself.
    const preview = captureFlatPreview();
    if (preview.dataUrl.startsWith("data:image/jpeg") && preview.bytes >= 1000) {
      const jpeg = await fetch(preview.dataUrl).then((res) => res.blob());
      const pr = await publishPreview(doFetch, "", session.code, r.id, jpeg);
      if (!pr.ok) line += ` (preview not sent — ${pr.reason})`;
    } else {
      line += ` (preview not sent — read back ${preview.bytes} bytes)`;
    }
    line += " · open Units to see your group.";
    setSaveResult("publish", "written", line);
    sendState = "sent"; // the button now reads "Go to your group"
    void unitBrowser.refresh(); // an open panel shows the neighbours' list with this flat in it
  } else {
    const detail =
      r.ownerResident !== undefined
        ? `not sent — ${r.ownerResident} already has ${unitName} in ${session.code}`
        : `not sent — ${r.status ? `${r.status} ` : ""}${r.reason}`;
    setSaveResult("publish", "failed", detail);
  }
  syncSaveDialog();
}

// `runSave` was here until run 0036. It wrote whichever of four outputs were
// ticked: a project download, a unit download, a library entry and a publish,
// with all four ticked by default. One press therefore put two files in a
// resident's Downloads folder they had not asked for. Sending is now sending
// (`runSend` above), and the writing that a resident may still want lives
// under More as three separate, named choices.

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

saveColorInput.addEventListener("input", () => {
  saveColorTouched = true;
  syncSaveDialog();
});

// The three things under More, each its own press (run 0036). None of them is
// needed to send, and none of them happens unless it is pressed.
saveProjectCopyBtn.addEventListener("click", () => {
  const n = saveDesignNumber();
  const text = projectFileText(
    serializeProject(floors.floors, floors.northAngle, floors.orientationPreference)
  );
  const name = projectFileName(n);
  downloadAs(URL.createObjectURL(new Blob([text], { type: "application/json" })), name, true);
  setSaveResult("project", "written", `${name} saved — ${floors.floors.length} floor(s), ${text.length} bytes`);
});

saveUnitFileBtn.addEventListener("click", () => {
  const n = saveDesignNumber();
  const built = buildUnitExport(floors, unitNameFor(n), saveColorInput.value);
  if (!built.ok) {
    setSaveResult("unit", "failed", `not saved — ${built.reason}`);
    return;
  }
  const text = unitFileText(built.file);
  const name = unitFileName(n);
  downloadAs(URL.createObjectURL(new Blob([text], { type: "application/json" })), name, true);
  setSaveResult("unit", "written", `${name} saved — ${built.file.storeys.length} storey(s), ${text.length} bytes`);
});

saveLibraryBtn.addEventListener("click", () => {
  const n = saveDesignNumber();
  const color = saveColorInput.value;
  const built = buildUnitExport(floors, unitNameFor(n), color);
  if (!built.ok) {
    setSaveResult("library", "failed", `not written — ${built.reason}`);
    return;
  }
  void saveLibraryEntry(unitNameFor(n), color, built.file);
});
saveGoBtn.addEventListener("click", () => {
  if (sendState === "sent") {
    window.open(groupUrl(), "_blank", "noopener");
    return;
  }
  // There is no group yet, so there is nowhere to send. The landing's join is
  // where that is answered, and it is where the button goes (run 0036).
  if (!whoLine(session).ready) {
    showLanding();
    document.getElementById("landing-join")!.click();
    return;
  }
  void runSend();
});

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
/**
 * The id of the library entry whose copy is currently open, or null.
 *
 * The editor holds a COPY of a library flat and deliberately forgets where it
 * came from, so that saving it later adds a new entry rather than overwriting
 * one (see `onOpen` below). That is right for saving and wrong for deleting:
 * the library's Delete control has to refuse the flat on screen, and nothing
 * else in the app knows which one that is. So this records it, set only after a
 * library open succeeds and cleared here, at the one function every project
 * replacement goes through, which means any other import drops it.
 */
let openLibraryUnitId: string | null = null;

function importProjectText(text: string): boolean {
  openLibraryUnitId = null;
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
  reader.onload = () => {
    // A file opened FROM the landing dismisses it, and only once something
    // actually loaded: a file that fails to parse, or a replace-confirm the
    // resident declines, leaves them on the landing with their doors rather
    // than dropping them into an editor they did not ask for (run 0027).
    if (importProjectText(String(reader.result ?? ""))) hideLanding();
  };
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
  // Delete is DEV-ONLY beside Rename and saving, and for the same reason: the
  // manifest and the two files live on disk and only the dev server can remove
  // them. Without the sink the control is simply absent rather than broken.
  onDelete: import.meta.env.DEV
    ? async (entry) => {
        const res = await fetch("/__library/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id }),
        });
        const r = (await res.json()) as { ok: boolean; error?: string; removed?: string[] };
        if (!r.ok) throw new Error(r.error ?? "unknown error");
        showToast("info", `Deleted "${entry.name}" and ${r.removed?.length ?? 0} of its files.`);
      }
    : undefined,
  storeAbsentText,
  openUnitId: () => openLibraryUnitId,
  onOpen: (file, source) => {
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
        if (importProjectText(JSON.stringify(src))) {
          // AFTER the import, which clears this: a library card's open is the
          // one path that sets it, so the Delete control can refuse this flat.
          if ("areaM2" in source) openLibraryUnitId = source.id;
          unitBrowser.close();
        }
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
  refreshFlatFigures(); // an undo/redo/import changes the flat as much as any edit does
  // An undo is a change to the flat like any other, and `History.commit` is
  // deliberately a no-op while restoring, so the draft is written here too.
  // The snapshot is already in hand, so this costs no serialization (run 0036).
  saveDraft(draftStore, snapshot);
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

// The send panel's own state needs one startup read rather than waiting for
// a first "open", and the figures, the drop hint and the step gate all come
// from the same first pass.
// The flat is kept as you draw (run 0036), so a refresh, a closed tab or a
// crash no longer costs an afternoon. `readDraft` is the one rule that says
// whether to bring it back: a URL naming a project wins over it, and a draft
// with no rooms in it is not worth announcing. The restore goes through
// `restoreState`, which is the same rebuild an import and an undo use.
const draft = readDraft(draftStore, location.search);
if (draft !== null) {
  restoreState(draft);
  showToast("info", DRAFT_RESTORED);
}

void openSaveDialog();
refreshFlatFigures();
renderJourney();
setStep("draw");
// The landing decides itself, from the URL alone (src/core/flatState.ts). A
// link that already names a project or a group belongs to someone coming
// back, and opens straight into the editor.
if (showsLanding(location.search)) showLanding();

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
  // AFTER the render, not before. `Vector3.project` reads
  // `camera.matrixWorldInverse`, which the renderer refreshes as part of
  // rendering, so projecting first uses the PREVIOUS frame's matrix and the
  // outline lags a frame behind the plate under it, which reads as a drift
  // during an orbit. No-op unless the flat is empty and the hint is up.
  syncDropHint();
}

animate();
