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
  // PLACE / FLOORS / BRIEF (handoff Part 2, 1a). The Project panel is gone: its
  // three actions live in the top bar's Save / Open menu now. Every entry that
  // existed still exists; PLACE regroups them so a reader sees three kinds of
  // thing rather than five lists.
  const scroll = document.createElement("div");
  scroll.id = "palette-scroll";
  scroll.appendChild(sectionHeading("Place"));
  scroll.appendChild(buildGroup("Rooms", ROOM_LIST.filter((d) => !d.cluster), cb));
  scroll.appendChild(
    buildGroup("Circulation & Outdoor", ROOM_LIST.filter((d) => !!d.cluster), cb)
  );
  scroll.appendChild(buildStructureGroup(cb));
  scroll.appendChild(buildFloorsPanel(cb, state));
  scroll.appendChild(sectionHeading("Brief"));
  scroll.appendChild(buildOrientationPanel(state, cb));
  scroll.appendChild(buildGridControls(state, cb));
  root.appendChild(scroll);
  root.appendChild(buildResizeHandle(root));
}

/** A top-level section heading with the 2px ink rule under it. */
function sectionHeading(text: string): HTMLElement {
  const h = document.createElement("p");
  h.className = "section-title";
  h.textContent = text;
  return h;
}

/** STRUCTURE & ACCESS: the stair, the furniture modules, and the two placement
 *  tools. They sit together because none of them is a room, and all four are
 *  things a plan needs before it is finished. */
function buildStructureGroup(cb: PaletteCallbacks): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "palette-group";
  const h = document.createElement("p");
  h.className = "group-title";
  h.textContent = "Structure & Access";
  wrap.appendChild(h);

  const grid = document.createElement("div");
  grid.className = "palette-grid";
  for (const def of [...STAIR_LIST, ...MODULE_LIST]) grid.appendChild(createPaletteItem(def, cb));

  // Entrance and Doorway are TOOLS rather than draggable presets, so they are
  // buttons that arm a placement mode. They are outlined in their own accent
  // (--entry / --violet) so the palette says which mark each one will leave.
  const entrance = document.createElement("button");
  entrance.type = "button";
  entrance.className = "palette-tool tool-entrance";
  entrance.innerHTML = '<span class="pt-name">Entrance</span><span class="pt-size">exterior edge</span>';
  entrance.addEventListener("click", () => cb.onPlaceEntrance());
  const doorway = document.createElement("button");
  doorway.type = "button";
  doorway.className = "palette-tool tool-doorway";
  doorway.innerHTML = '<span class="pt-name">Doorway</span><span class="pt-size">interior wall</span>';
  doorway.addEventListener("click", () => cb.onPlaceDoor());
  grid.appendChild(entrance);
  grid.appendChild(doorway);

  wrap.appendChild(grid);
  return wrap;
}

/** One PLACE group: a heading and a two-column grid of entries. */
function buildGroup(title: string, defs: ModuleDef[], cb: PaletteCallbacks): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "palette-group";
  const h = document.createElement("p");
  h.className = "group-title";
  h.textContent = title;
  wrap.appendChild(h);
  const grid = document.createElement("div");
  grid.className = "palette-grid";
  for (const def of defs) grid.appendChild(createPaletteItem(def, cb));
  wrap.appendChild(grid);
  return wrap;
}

/** Minimal geometric eye glyphs for the per-floor visibility toggle (no emoji,
 *  consistent with the flat Bauhaus icon-free-otherwise style). */
const EYE_OPEN_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8C1 8 4 3 8 3s7 5 7 5-3 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2.1"/></svg>';
const EYE_CLOSED_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8C1 8 4 3 8 3s7 5 7 5-3 5-7 5-7-5-7-5Z"/><line x1="1.5" y1="14" x2="14.5" y2="2"/></svg>';

/**
 * The right-hand hairline, doubling as a 6px col-resize handle (248–480px).
 * Width is session state and is never saved: it is how someone is working right
 * now, not something about the design.
 */
function buildResizeHandle(root: HTMLElement): HTMLElement {
  const handle = document.createElement("div");
  handle.id = "palette-resize";
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = root.getBoundingClientRect().width;
    const move = (ev: PointerEvent) => {
      const w = Math.max(248, Math.min(480, startW + (ev.clientX - startX)));
      root.style.flex = `0 0 ${w}px`;
      root.style.width = `${w}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  return handle;
}


function buildFloorsPanel(cb: PaletteCallbacks, state: FloorState): HTMLElement {
  const section = document.createElement("div");
  section.appendChild(sectionHeading("Floors"));

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


function createPaletteItem(def: ModuleDef, cb: PaletteCallbacks): HTMLElement {
  const item = document.createElement("div");
  item.className = "palette-item";
  item.dataset.moduleType = def.type;

  const swatch = document.createElement("div");
  swatch.className = "palette-swatch";
  swatch.innerHTML = shapeIcon(def);

  const label = document.createElement("div");
  label.className = "palette-label";
  // The size, not the shape word. `description` reads "RECTANGLE · 7×5" and at
  // the grid's 9px the word is repeated eleven times for no information; the
  // footprint is what someone choosing a room actually reads.
  const w = Math.max(...def.cells.map((c) => c.cx)) + 1;
  const d = Math.max(...def.cells.map((c) => c.cz)) + 1;
  label.innerHTML = `<span class="name">${def.name}</span><span class="desc">${w}×${d}</span>`;

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
