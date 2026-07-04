import {
  MODULE_LIST,
  ROOM_LIST,
  STAIR_LIST,
  type ModuleType,
  type ModuleDef,
} from "../core/modules";

export interface FloorState {
  floors: { label: string }[];
  activeIndex: number;
  /** Active floor's grid dimensions (the grid-size control reflects these). */
  cols: number;
  rows: number;
}

export interface PaletteCallbacks {
  /** Apply grid-size to the ACTIVE floor only. */
  onApplyGridSize: (cols: number, rows: number) => void;
  /** Pressing a palette entry begins placing it on the active floor. */
  onGrabModule: (type: ModuleType, e: PointerEvent) => void;
  onSwitchFloor: (index: number) => void;
  onAddFloor: () => void;
  onDeleteFloor: () => void;
  /** Enter entrance-placement mode (ground floor only). */
  onPlaceEntrance: () => void;
  /** Download the whole project as a .json file. */
  onExport: () => void;
  /** Open the native file picker to import a project .json. */
  onImport: () => void;
}

/**
 * Builds the full sidebar: Floors panel, Rooms, Modules, and the (per-active-
 * floor) grid-size control. Rebuilt by main whenever floor state changes, so
 * the tabs and grid-size inputs always reflect the active floor.
 */
export function buildPalette(
  root: HTMLElement,
  cb: PaletteCallbacks,
  state: FloorState
): void {
  root.innerHTML = "";
  root.appendChild(buildProjectPanel(cb));
  root.appendChild(buildFloorsPanel(cb, state));
  root.appendChild(buildSection("Rooms", ROOM_LIST, cb));
  root.appendChild(buildSection("Stairs", STAIR_LIST, cb));
  root.appendChild(buildAccessPanel(cb));
  root.appendChild(buildSection("Modules", MODULE_LIST, cb));
  root.appendChild(buildGridControls(state, cb));
}

/** Entrance placement tool (ground floor only). */
function buildAccessPanel(cb: PaletteCallbacks): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading("Access"));

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary";
  btn.textContent = "+ Entrance";
  btn.addEventListener("click", () => cb.onPlaceEntrance());
  section.appendChild(btn);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent =
    "Click just outside a ground-floor room's exterior wall to add an entrance (the reachability root).";
  section.appendChild(note);
  return section;
}

function buildProjectPanel(cb: PaletteCallbacks): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading("Project"));

  const actions = document.createElement("div");
  actions.className = "floor-actions";

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "secondary";
  exportBtn.textContent = "Export";
  exportBtn.addEventListener("click", () => cb.onExport());
  actions.appendChild(exportBtn);

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "secondary";
  importBtn.textContent = "Import";
  importBtn.addEventListener("click", () => cb.onImport());
  actions.appendChild(importBtn);

  section.appendChild(actions);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent = "Save the whole project to a .json file, or import one (also drag a file onto the view).";
  section.appendChild(note);
  return section;
}

function buildFloorsPanel(cb: PaletteCallbacks, state: FloorState): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading("Floors"));

  const tabs = document.createElement("div");
  tabs.className = "floor-tabs";
  // Topmost floor first so the list reads like the building (roof → ground).
  state.floors.forEach((f, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "floor-tab" + (i === state.activeIndex ? " active" : "");
    tab.textContent = f.label;
    tab.addEventListener("click", () => cb.onSwitchFloor(i));
    tabs.prepend(tab);
  });
  section.appendChild(tabs);

  const actions = document.createElement("div");
  actions.className = "floor-actions";

  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary";
  add.textContent = "+ Add Floor";
  add.addEventListener("click", () => cb.onAddFloor());
  actions.appendChild(add);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "secondary danger";
  del.textContent = "Delete Floor";
  del.disabled = state.floors.length <= 1;
  del.addEventListener("click", () => cb.onDeleteFloor());
  actions.appendChild(del);

  section.appendChild(actions);
  return section;
}

function buildSection(
  title: string,
  defs: ModuleDef[],
  cb: PaletteCallbacks
): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading(title));
  const list = document.createElement("div");
  list.className = "palette-list";
  for (const def of defs) list.appendChild(createPaletteItem(def, cb));
  section.appendChild(list);
  return section;
}

function createPaletteItem(def: ModuleDef, cb: PaletteCallbacks): HTMLElement {
  const item = document.createElement("div");
  item.className = "palette-item";
  item.dataset.moduleType = def.type;

  const swatch = document.createElement("div");
  swatch.className = "palette-swatch";
  swatch.innerHTML = shapeIcon(def);

  const label = document.createElement("div");
  label.className = "palette-label";
  label.innerHTML = `<span class="name">${def.name}</span><span class="desc">${def.description}</span>`;

  item.appendChild(swatch);
  item.appendChild(label);

  item.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    cb.onGrabModule(def.type, e);
  });

  return item;
}

/**
 * A small SVG of the footprint, in the def's colour, scaled so any footprint
 * (a 1-cell module or a 7×6 room) fits the swatch box.
 */
function shapeIcon(def: ModuleDef): string {
  const color = "#" + def.color.toString(16).padStart(6, "0");
  const maxX = Math.max(...def.cells.map((c) => c.cx)) + 1;
  const maxZ = Math.max(...def.cells.map((c) => c.cz)) + 1;
  const box = 30;
  const pad = 3;
  const u = (box - pad * 2) / Math.max(maxX, maxZ);
  const offX = pad + ((Math.max(maxX, maxZ) - maxX) * u) / 2;
  const offZ = pad + ((Math.max(maxX, maxZ) - maxZ) * u) / 2;
  const gap = u > 4 ? 0.8 : 0.3;

  const rects = def.cells
    .map((c) => {
      const x = offX + c.cx * u;
      const y = offZ + c.cz * u;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(u - gap).toFixed(
        2
      )}" height="${(u - gap).toFixed(2)}" fill="${color}"/>`;
    })
    .join("");
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">${rects}</svg>`;
}

function buildGridControls(state: FloorState, cb: PaletteCallbacks): HTMLElement {
  const gridSection = document.createElement("div");
  gridSection.appendChild(heading("Grid size — active floor"));

  const row = document.createElement("div");
  row.className = "field-row";
  const colsInput = numberField("Width (X)", state.cols);
  const rowsInput = numberField("Depth (Z)", state.rows);
  row.appendChild(colsInput.field);
  row.appendChild(rowsInput.field);
  gridSection.appendChild(row);

  const apply = document.createElement("button");
  apply.className = "primary";
  apply.textContent = "Apply";
  apply.addEventListener("click", () => {
    const cols = clampInt(colsInput.input.value, 1, 100, state.cols);
    const rows = clampInt(rowsInput.input.value, 1, 100, state.rows);
    colsInput.input.value = String(cols);
    rowsInput.input.value = String(rows);
    cb.onApplyGridSize(cols, rows);
  });
  gridSection.appendChild(apply);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent =
    "1 cell = 0.6 m. Applies to the active floor only; shrinking removes anything that no longer fits.";
  gridSection.appendChild(note);
  return gridSection;
}

function heading(text: string): HTMLElement {
  const h = document.createElement("p");
  h.className = "panel-title";
  h.textContent = text;
  return h;
}

function numberField(labelText: string, value: number) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "100";
  input.value = String(value);
  field.appendChild(label);
  field.appendChild(input);
  return { field, input };
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
