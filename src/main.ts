import "./style.css";
import { type Grid } from "./core/grid";
import { FloorManager } from "./core/floorManager";
import { createScene } from "./scene/sceneSetup";
import { GhostPreview } from "./scene/ghostPreview";
import { Picker } from "./interaction/picker";
import { DragDropController } from "./interaction/dragDrop";
import { SelectionController } from "./interaction/selection";
import { updateCutaway } from "./scene/cutaway";
import { computeDwellingGraph } from "./core/adjacencyGraph";
import { validate, computeEntranceDepths } from "./core/rules";
import { GraphView } from "./ui/graphView";
import { renderValidationPanel } from "./ui/validationPanel";
import { applyRoomHighlights, clearRoomHighlights } from "./scene/highlight";
import { EntranceController } from "./interaction/entranceController";
import { buildPalette } from "./ui/palette";
import { showToast } from "./ui/toast";
import {
  serializeProject,
  parseProject,
  ProjectParseError,
  APP_PROJECT_VERSION,
} from "./core/projectIO";

const DEFAULT_COLS = 16;
const DEFAULT_ROWS = 16;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const sidebar = document.getElementById("sidebar") as HTMLElement;
const resetBtn = document.getElementById("reset-view") as HTMLButtonElement;
const graphCanvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
const graphFloorLabel = document.getElementById("graph-floor-label") as HTMLElement;
const checkBtn = document.getElementById("check-layout") as HTMLButtonElement;
const validationPanel = document.getElementById("validation-panel") as HTMLElement;

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

// ---- Interaction ----
const ghost = new GhostPreview(f0.group, f0.grid, f0.store);
const picker = new Picker(canvas, camera, f0.grid, groundPlane);
const dragDrop = new DragDropController(canvas, picker, ghost, f0.store, controls);
const selection = new SelectionController(
  canvas,
  picker,
  ghost,
  f0.store,
  controls,
  dragDrop
);

floors.attach({ picker, ghost, dragDrop, selection, groundPlane, sizeGroundPlane });

// A stair placed on the top floor auto-creates a floor above it — refresh the
// sidebar floor tabs when that happens.
floors.onStructureChange = () => renderSidebar();

// Entrance placement (ground floor only). Binds a door marker to an exterior
// edge of a floor-0 room/cluster; placing one drops any stale validation report.
const entranceController = new EntranceController(
  canvas,
  picker,
  controls,
  () => floors.floors[0],
  () => clearValidation()
);

// ---- Sidebar (rebuilt whenever floor state changes) ----
function renderSidebar(): void {
  buildPalette(
    sidebar,
    {
      onGrabModule(type) {
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
      },
      onSwitchFloor(index) {
        clearValidation();
        floors.setActive(index);
        renderSidebar();
      },
      onAddFloor() {
        floors.addFloor();
        renderSidebar();
      },
      onDeleteFloor() {
        if (floors.floors.length <= 1) return;
        const ok = window.confirm(
          "Delete this floor and everything on it? This cannot be undone."
        );
        if (!ok) return;
        floors.deleteFloor();
        renderSidebar();
      },
      onPlaceEntrance() {
        // Entrances are ground-floor only — switch to floor 0 first if needed.
        if (floors.activeIndexValue !== 0) {
          floors.setActive(0);
          renderSidebar();
        }
        selection.deselect();
        entranceController.start();
      },
      onExport() {
        exportProject();
      },
      onImport() {
        fileInput.click();
      },
    },
    {
      floors: floors.floors.map((_, i) => ({ label: `Floor ${i}` })),
      activeIndex: floors.activeIndexValue,
      cols: floors.active.grid.cols,
      rows: floors.active.grid.rows,
    }
  );
}
renderSidebar();

// ---- Camera reset ----
resetBtn.addEventListener("click", () => ctx.resetView());

// ---- Bubble-diagram (adjacency graph) view ----
const graphView = new GraphView(
  graphCanvas,
  () => computeDwellingGraph(floors.floors),
  () => floors.activeIndexValue,
  graphFloorLabel
);
viewToggle.addEventListener("click", () => {
  graphView.toggle();
  viewToggle.textContent = graphView.visible ? "3D View" : "Diagram";
  // Hide the 3D-only chrome while in diagram mode (Check Layout stays available).
  resetBtn.style.display = graphView.visible ? "none" : "";
  document.getElementById("hint")!.style.display = graphView.visible ? "none" : "";
});

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
  if (validated) clearRoomHighlights(floors.floors);
  validated = false;
}

function runCheck(): void {
  const graph = computeDwellingGraph(floors.floors);
  const violations = validate(graph);
  const depths = computeEntranceDepths(graph);
  renderValidationPanel(validationPanel, graph, violations, depths, "Dwelling", clearValidation);
  graphView.setHighlights(violations);
  graphView.setDepths(depths);
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
  const data = serializeProject(floors.floors);
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
  renderer.render(scene, camera);
}
animate();
