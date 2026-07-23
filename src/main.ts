import "./style.css";
import * as THREE from "three";
import { type Grid } from "./core/grid";
import { rotatedCells } from "./core/modules";
import { FloorManager } from "./core/floorManager";
import { worldNorthDir } from "./core/orientation";
import { createScene } from "./scene/sceneSetup";
import { GhostPreview } from "./scene/ghostPreview";
import { GroupGhostPreview } from "./scene/groupGhostPreview";
import { Picker } from "./interaction/picker";
import { DragDropController } from "./interaction/dragDrop";
import { SelectionController, type MarkerSelectionAdapter } from "./interaction/selection";
import { updateCutaway, setCutawayEnabled } from "./scene/cutaway";
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
import { buildPalette } from "./ui/palette";
import { showToast } from "./ui/toast";
import { History } from "./core/history";
import {
  serializeProject,
  parseProject,
  ProjectParseError,
  APP_PROJECT_VERSION,
  type ProjectFile,
} from "./core/projectIO";
import { buildUnitExport } from "./core/unitExport";

const DEFAULT_COLS = 16;
const DEFAULT_ROWS = 16;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const sidebar = document.getElementById("sidebar") as HTMLElement;
const resetBtn = document.getElementById("reset-view") as HTMLButtonElement;
const graphCanvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
const topViewBtn = document.getElementById("top-view-toggle") as HTMLButtonElement;
const graphFloorLabel = document.getElementById("graph-floor-label") as HTMLElement;
const graphLegend = document.getElementById("graph-legend") as HTMLElement;
const graphToggleTouch = document.getElementById("graph-toggle-touch") as HTMLInputElement;
const graphToggleDepth = document.getElementById("graph-toggle-depth") as HTMLInputElement;
const graphRelayoutBtn = document.getElementById("graph-relayout") as HTMLButtonElement;
const checkBtn = document.getElementById("check-layout") as HTMLButtonElement;
const validationPanel = document.getElementById("validation-panel") as HTMLElement;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
const selectionReadout = document.getElementById("selection-readout") as HTMLElement;
const shortcutsBtn = document.getElementById("shortcuts-btn") as HTMLButtonElement;
const shortcutsPanel = document.getElementById("shortcuts-panel") as HTMLElement;
const shortcutsClose = document.getElementById("shortcuts-close") as HTMLButtonElement;
const viewControls = document.getElementById("view-controls") as HTMLElement;
const cutawayToggle = document.getElementById("cutaway-toggle") as HTMLButtonElement;
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
const commitHistory = () => history?.commit();

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
  () => entranceController.isActive || doorController.isActive
);

floors.attach({ picker, ghost, groupGhost, dragDrop, selection, groundPlane, sizeGroundPlane });

// A stair placed on the top floor auto-creates a floor above it — refresh the
// sidebar floor tabs when that happens. The floor stack shape changing while
// in plan mode would leave its by-index hidden-floor bookkeeping stale, so
// leave plan mode first (safe/simple over trying to remap indices).
floors.onStructureChange = () => {
  if (planMode) exitPlanMode();
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
  }
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
        if (planMode) exitPlanMode(); // stack shape changes — see onStructureChange
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
      onExport() {
        exportProject();
      },
      onImport() {
        fileInput.click();
      },
      onExportUnit() {
        openUnitExportDialog();
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
    const cells = rotatedCells(inst.def, inst.rotation, inst.mirrored);
    const xs = cells.map((c) => c.cx);
    const zs = cells.map((c) => c.cz);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const d = Math.max(...zs) - Math.min(...zs) + 1;
    text = `${inst.def.name} · Floor ${floors.activeIndexValue} · ${w}×${d}`;
  } else if (insts.length > 1) {
    text = `${insts.length} selected`;
  } else if (entId) {
    text = "Entrance · Floor 0";
  } else if (doorSelected) {
    text = `Door · Floor ${floors.activeIndexValue}`;
  }
  selectionReadout.textContent = text;
  selectionReadout.classList.toggle("visible", !!text);
}

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

function enterPlanMode(): void {
  if (planMode) return;
  setDiagramVisible(false); // mutually exclusive with the bubble-diagram view
  planMode = true;
  prePlanVisibility = floors.floors.map((_, i) => floors.isFloorVisible(i));
  applyPlanVisibility();
  floors.setDoorArcsVisible(true); // door-swing arcs are a plan-view symbol
  controls.enableRotate = false;
  ctx.frameBox(floors.contentBox(), "top");
  topViewBtn.textContent = "Axo View";
  topViewBtn.classList.add("active");
}

/** Leave plan mode: restore every floor's pre-plan visibility, unlock orbit,
 *  and re-frame back to the default axo extent (the one guaranteed exit). */
function exitPlanMode(): void {
  if (!planMode) return;
  planMode = false;
  prePlanVisibility.forEach((v, i) => floors.setFloorVisible(i, v));
  floors.setDoorArcsVisible(false); // arcs are plan-only
  controls.enableRotate = true;
  topViewBtn.textContent = "Top View";
  topViewBtn.classList.remove("active");
  ctx.frameBox(floors.contentBox(), "axo");
}

topViewBtn.addEventListener("click", () => {
  if (planMode) exitPlanMode();
  else enterPlanMode();
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
  viewToggle.textContent = graphView.visible ? "3D View" : "Diagram";
  // Hide the 3D-only chrome while in diagram mode (Check Layout stays available).
  const hide = graphView.visible ? "none" : "";
  resetBtn.style.display = hide;
  document.getElementById("hint")!.style.display = hide;
  viewControls.style.display = hide; // cutaway toggle + compass dial
  northBadge.style.display = hide; // camera-aware north arrow
}
viewToggle.addEventListener("click", () => setDiagramVisible(!graphView.visible));

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
viewControls.appendChild(compassDial.el);

/** Re-sync the dial + live badge angle to the model's north (after load/undo,
 *  which set `floors.northAngle` through the rebuild path). */
function syncNorthUI(): void {
  displayNorthAngle = floors.northAngle;
  compassDial.setAngle(floors.northAngle);
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
  northBadgeRot.setAttribute("transform", `rotate(${angle} 20 20)`);
}

// Cutaway toggle (default ON = current dollhouse behaviour). Session view-state
// only — never serialized, untouched by undo/load.
let cutawayOn = true;
cutawayToggle.addEventListener("click", () => {
  cutawayOn = !cutawayOn;
  setCutawayEnabled(cutawayOn);
  cutawayToggle.classList.toggle("active", cutawayOn);
});

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
  const violations = validate(graph);
  const depths = computeEntranceDepths(graph);
  graphView.setHover(null); // a stale hover from the previous report shouldn't survive a re-check
  clearHoverEmphasis();
  renderValidationPanel(validationPanel, graph, violations, depths, "Dwelling", clearValidation, onHoverViolation);
  graphView.setHighlights(violations);
  // (Diagram depth badges are computed by GraphView itself each frame from the
  // live graph when its depth toggle is on — no longer pushed from here, so
  // they no longer require Check Layout to appear. See GraphView.frame().)
  applyRoomHighlights(floors.floors, violations);
  validated = true;
}

checkBtn.addEventListener("click", runCheck);
// A stale report is worse than none: drop it as soon as any floor's layout
// changes (validation spans the whole dwelling now).
floors.onLayoutChange = () => clearValidation();

// ---- Project save / load (export & import JSON) ----
// Manual, client-side only. Export downloads a real .json; import replaces the
// whole project (after a confirm) and rebuilds it through the normal placement
// path, so a loaded design is identical to a hand-built one.

function exportProject(): void {
  const data = serializeProject(floors.floors, floors.northAngle);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flat-project-${fileTimestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Unit export (flat → building bridge, docs/bridge-format.md) ----
// READ-ONLY: no store mutation, no history commit. Name + colour are
// export-time inputs collected by the <dialog> in index.html — NOT new
// project-file fields. Hard gates (entrance, connectivity) toast-and-refuse;
// hard RULE violations only confirm (advisory stance — export anyway on OK).

/** Small deterministic default palette; picked by name hash so the same name
 *  always proposes the same colour (bottom-up's catalog colour family). */
const UNIT_COLORS = ["#4dabf7", "#38d9a9", "#ffd43b", "#ff922b", "#ff6b6b", "#9775fa", "#f783ac"];
function defaultUnitColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return UNIT_COLORS[h % UNIT_COLORS.length];
}

const unitDialog = document.getElementById("unit-export-dialog") as HTMLDialogElement;
const unitNameInput = document.getElementById("unit-export-name") as HTMLInputElement;
const unitColorInput = document.getElementById("unit-export-color") as HTMLInputElement;
let unitColorTouched = false;
unitColorInput.addEventListener("input", () => (unitColorTouched = true));
unitNameInput.addEventListener("input", () => {
  if (!unitColorTouched) unitColorInput.value = defaultUnitColor(unitNameInput.value || "Unit");
});

function openUnitExportDialog(): void {
  unitColorTouched = false;
  unitColorInput.value = defaultUnitColor(unitNameInput.value || "Unit");
  unitDialog.showModal();
}

unitDialog.addEventListener("close", () => {
  if (unitDialog.returnValue !== "export") return;
  exportUnit(unitNameInput.value.trim() || "Unit", unitColorInput.value);
});

function exportUnit(name: string, color: string): void {
  // Hard gates first (fail fast with a clear toast)…
  const result = buildUnitExport(floors, name, color);
  if (!result.ok) {
    showToast("error", `Unit export refused: ${result.reason}`);
    return;
  }
  // …then the ADVISORY hard-rule confirm: violations never block, only inform.
  const hard = validate(computeDwellingGraph(floors.floors)).filter((v) => v.severity === "hard");
  if (hard.length > 0) {
    const ok = window.confirm(
      `Check Layout reports ${hard.length} HARD violation(s) in this dwelling.\n` +
        `The unit will export anyway (rules are advisory). Continue?`
    );
    if (!ok) return;
  }
  const blob = new Blob([JSON.stringify(result.file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `unit-${name.replace(/[^\w-]+/g, "_")}-${fileTimestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("info", `Unit "${name}" exported (${result.file.storeys.length} storey(s)).`);
}

/** Validate, confirm, then load — keeping the app's state intact on any failure. */
function importProjectText(text: string): void {
  let parsed;
  try {
    parsed = parseProject(text);
  } catch (err) {
    const msg =
      err instanceof ProjectParseError
        ? err.message
        : "Could not read this file.";
    showToast("error", `Import failed: ${msg}`);
    return;
  }

  // Newer-than-app files: warn prominently and fold the replace confirm in, so
  // the user makes one informed decision.
  let confirmMsg = "This will replace your current layout. Continue?";
  if (parsed.status === "newer")
    confirmMsg =
      `This file was created with a newer version (v${parsed.fileVersion}) of the app ` +
      `than you're running (v${APP_PROJECT_VERSION}). Some elements may not load correctly.\n\n` +
      `This will also replace your current layout. Continue?`;
  if (!window.confirm(confirmMsg)) return;

  try {
    clearValidation();
    selection.deselect();
    floors.loadProject(parsed.data);
    renderSidebar();
    syncNorthUI(); // a loaded file carries its own north — reflect it on the dial
    commitHistory(); // importing a project is an undoable action
  } catch (err) {
    console.error(err);
    showToast("error", "Import failed while loading — the file may be corrupt.");
    return;
  }

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
}

function readAndImport(file: File): void {
  const reader = new FileReader();
  reader.onload = () => importProjectText(String(reader.result ?? ""));
  reader.onerror = () => showToast("error", "Could not read that file.");
  reader.readAsText(file);
}

function fileTimestamp(): string {
  // App code (not a workflow script) — Date is fine here.
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
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

// Drag-and-drop a .json onto the viewport. A depth counter keeps the highlight
// stable as the pointer moves over child elements (each fires dragenter/leave).
const viewport = document.getElementById("viewport") as HTMLElement;
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
}

function updateHistoryButtons(): void {
  undoBtn.disabled = !history?.canUndo;
  redoBtn.disabled = !history?.canRedo;
}

history = new History(
  () => JSON.stringify(serializeProject(floors.floors, floors.northAngle)),
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

// ---- Render loop ----
function animate(): void {
  requestAnimationFrame(animate);
  if (graphView.visible) {
    // In diagram mode: skip the 3D render, drive the bubble diagram instead.
    graphView.frame();
    return;
  }
  controls.update();
  updateCutaway(scene, camera.position, controls.target);
  updateNorthBadge();
  renderer.render(scene, camera);
}

animate();
