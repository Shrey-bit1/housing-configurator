import { COMPASS_SECTORS, type CompassSector, type OrientationPreference } from "../core/orientation";
import {
  MODULE_LIST,
  ROOM_LIST,
  STAIR_LIST,
  type ModuleType,
  type ModuleDef,
} from "../core/modules";

export interface FloorState {
  floors: { label: string; visible: boolean }[];
  activeIndex: number;
  /** Active floor's grid dimensions (the grid-size control reflects these). */
  cols: number;
  rows: number;
  /** The project's stated orientation preference, so the two selects show what
   *  is actually saved rather than whatever was last typed into them. */
  orientationPreference: OrientationPreference;
}

export interface PaletteCallbacks {
  /** Apply grid-size to the ACTIVE floor only. */
  onApplyGridSize: (cols: number, rows: number) => void;
  /** Pressing a palette entry begins placing it on the active floor. */
  onGrabModule: (type: ModuleType, e: PointerEvent) => void;
  onSwitchFloor: (index: number) => void;
  onAddFloor: () => void;
  onDeleteFloor: () => void;
  /** Show/hide floor `index` in the 3D view (view state, not design state). */
  onToggleFloorVisibility: (index: number) => void;
  /** Enter entrance-placement mode (ground floor only). */
  onPlaceEntrance: () => void;
  /** Enter door-placement mode (interior boundaries, any floor). */
  onPlaceDoor: () => void;
  /** Download the whole project as a .json file. */
  onExport: () => void;
  /** Open the native file picker to import a project .json. */
  onImport: () => void;
  /** Export the dwelling as a `dwelling-unit` bridge file (docs/bridge-format.md). */
  onExportUnit: () => void;
  /** Replace the project's orientation preference. Either half may be
   *  undefined, which means no opinion; the caller stores it and commits
   *  history, because it is design state that belongs in the project file. */
  onSetOrientationPreference: (pref: OrientationPreference) => void;
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
  root.appendChild(buildOrientationPanel(state, cb));
  root.appendChild(buildGridControls(state, cb));
}

/** Minimal geometric eye glyphs for the per-floor visibility toggle (no emoji,
 *  consistent with the flat Bauhaus icon-free-otherwise style). */
const EYE_OPEN_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8C1 8 4 3 8 3s7 5 7 5-3 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2.1"/></svg>';
const EYE_CLOSED_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8C1 8 4 3 8 3s7 5 7 5-3 5-7 5-7-5-7-5Z"/><line x1="1.5" y1="14" x2="14.5" y2="2"/></svg>';

/** Access tools: entrance (ground floor) + interior door (any floor). */
function buildAccessPanel(cb: PaletteCallbacks): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading("Access"));

  const row = document.createElement("div");
  row.className = "floor-actions";

  const entranceBtn = document.createElement("button");
  entranceBtn.type = "button";
  entranceBtn.className = "secondary";
  entranceBtn.textContent = "+ Entrance";
  entranceBtn.addEventListener("click", () => cb.onPlaceEntrance());
  row.appendChild(entranceBtn);

  const doorBtn = document.createElement("button");
  doorBtn.type = "button";
  doorBtn.className = "secondary";
  doorBtn.textContent = "+ Door";
  doorBtn.addEventListener("click", () => cb.onPlaceDoor());
  row.appendChild(doorBtn);

  section.appendChild(row);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent =
    "Entrance: click just outside a ground-floor exterior wall (the reachability root). " +
    "Door: hover an interior wall between two spaces to open a doorway — reachability is door-based.";
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

  const unitBtn = document.createElement("button");
  unitBtn.type = "button";
  unitBtn.className = "secondary";
  unitBtn.textContent = "Export unit";
  unitBtn.addEventListener("click", () => cb.onExportUnit());
  actions.appendChild(unitBtn);

  section.appendChild(actions);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent =
    "Save the whole project to a .json file, or import one (also drag a file onto the view). " +
    "“Export unit” writes a dwelling-unit bridge file for the building packer.";
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
    const row = document.createElement("div");
    row.className = "floor-tab-row";

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "floor-tab" + (i === state.activeIndex ? " active" : "");
    tab.textContent = f.label;
    tab.addEventListener("click", () => cb.onSwitchFloor(i));
    row.appendChild(tab);

    const vis = document.createElement("button");
    vis.type = "button";
    vis.className = "floor-vis-toggle" + (f.visible ? "" : " hidden");
    vis.title = f.visible ? "Hide this floor" : "Show this floor";
    vis.innerHTML = f.visible ? EYE_OPEN_ICON : EYE_CLOSED_ICON;
    vis.addEventListener("click", () => cb.onToggleFloorVisibility(i));
    row.appendChild(vis);

    tabs.prepend(row);
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

/**
 * The project's orientation preference: one sector it would like habitable
 * rooms to face and one it would rather they did not, both optional.
 *
 * It sits here rather than beside the compass dial, which is a viewport overlay
 * for a value that MOVES GEOMETRY and therefore wants to be next to the model it
 * turns. A preference moves nothing; it is a statement about the brief, in the
 * same family as the project's name and grid, so it lives in the left panel with
 * the rest of the project's settings. Only `avoid` drives a rule today (OR2).
 */
function buildOrientationPanel(state: FloorState, cb: PaletteCallbacks): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(heading("Orientation preference"));

  const row = document.createElement("div");
  row.className = "field-row";
  const prefer = sectorField("Prefer", state.orientationPreference.prefer);
  const avoid = sectorField("Avoid", state.orientationPreference.avoid);
  row.appendChild(prefer.field);
  row.appendChild(avoid.field);
  section.appendChild(row);

  const push = () =>
    cb.onSetOrientationPreference({
      prefer: readSector(prefer.select),
      avoid: readSector(avoid.select),
    });
  prefer.select.addEventListener("change", push);
  avoid.select.addEventListener("change", push);

  const note = document.createElement("p");
  note.className = "hint-text";
  note.textContent =
    "Saved with the project, never in the unit export. \"Avoid\" drives rule OR2, " +
    "which reports any habitable room or kitchen glazed ONLY that way. \"Prefer\" is " +
    "recorded for the brief and drives no rule.";
  section.appendChild(note);
  return section;
}

/** A labelled 8-wind select with a leading "no opinion" option. */
function sectorField(labelText: string, value: CompassSector | undefined) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "—";
  select.appendChild(none);
  for (const sector of COMPASS_SECTORS) {
    const opt = document.createElement("option");
    opt.value = sector;
    opt.textContent = sector;
    select.appendChild(opt);
  }
  select.value = value ?? "";
  field.appendChild(label);
  field.appendChild(select);
  return { field, select };
}

/** The select's value as a sector, or undefined for the "—" option. */
function readSector(select: HTMLSelectElement): CompassSector | undefined {
  return select.value === "" ? undefined : (select.value as CompassSector);
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
