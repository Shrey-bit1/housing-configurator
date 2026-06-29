import "./style.css";
import { type Grid } from "./core/grid";
import { FloorManager } from "./core/floorManager";
import { createScene } from "./scene/sceneSetup";
import { GhostPreview } from "./scene/ghostPreview";
import { Picker } from "./interaction/picker";
import { DragDropController } from "./interaction/dragDrop";
import { SelectionController } from "./interaction/selection";
import { updateCutaway } from "./scene/cutaway";
import { computeAdjacencyGraph } from "./core/adjacencyGraph";
import { GraphView } from "./ui/graphView";
import { buildPalette } from "./ui/palette";

const DEFAULT_COLS = 16;
const DEFAULT_ROWS = 16;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const sidebar = document.getElementById("sidebar") as HTMLElement;
const resetBtn = document.getElementById("reset-view") as HTMLButtonElement;
const graphCanvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
const graphFloorLabel = document.getElementById("graph-floor-label") as HTMLElement;

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
const ghost = new GhostPreview(f0.group, f0.grid);
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
        f.grid.resize(cols, rows);
        f.gridView.rebuild();
        sizeGroundPlane(f.grid);
        const culled = f.store.reconcileAfterResize();
        if (culled.length > 0) {
          console.info(
            `Floor resized to ${cols}x${rows}; removed ${culled.length} item(s) that no longer fit.`
          );
        }
        renderSidebar();
      },
      onSwitchFloor(index) {
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
  () => computeAdjacencyGraph(floors.active.store),
  () => `Floor ${floors.activeIndexValue}`,
  graphFloorLabel
);
viewToggle.addEventListener("click", () => {
  graphView.toggle();
  viewToggle.textContent = graphView.visible ? "3D View" : "Diagram";
  // Hide the 3D-only chrome while in diagram mode.
  resetBtn.style.display = graphView.visible ? "none" : "";
  document.getElementById("hint")!.style.display = graphView.visible ? "none" : "";
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
  renderer.render(scene, camera);
}
animate();
