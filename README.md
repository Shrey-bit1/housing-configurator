# Flat Configurator

A browser-based 3D flat / housing configurator built with **TypeScript + Three.js** (bundled with Vite). Rooms, modules, stairs, and entrances are placed on a 0.6 m grid and viewed in an axonometric (isometric) projection, with a 2D bubble-diagram view of room adjacency. Part of an ongoing thesis project — this repo tracks work in progress.

## Current features

- **Grid system** — 0.6 m cells; per-floor grid size is adjustable (width × depth) with live re-fit of placed items.
- **Room-type presets** — fixed-footprint rooms defined as data: Living Room, Kitchen, Bedroom (Small/Large), Bathroom (Small/Large), Recreation Room, Circulation (Single/Double), and Outdoor/Balcony (Single/Double). L-shaped and rectangular footprints, rendered as hollow shells (floor + perimeter walls) with a camera-aware dynamic cutaway so interiors stay visible while orbiting. The Kitchen is furnished with authored voxel furniture (counter, cabinets, stove, sink, fridge).
- **Furniture modules** — small 0.6 m shape modules (Single, Domino, L-Triomino).
- **Stairs** — a 180° dogleg stair (2×6 footprint, two flights + half-landing) connecting a floor to the one above. Cuts a matching hole in the floor plate above (kept in sync on move/rotate/delete), auto-creates a floor above when placed on the topmost floor, and is blocked if the floor above has no clear plate to open into.
- **Entrances** — a door marker bound to an exterior edge of a ground-floor room or circulation cluster. Roots reachability for the layout rules below; multiple entrances are allowed. Re-validated on every check (see rule **E2**).
- **Placement & editing** — drag from the palette with a green/red validity ghost, snap to grid, collision-checked against everything on the floor; click to select, `R` to rotate 90°, drag to move, `Delete`/`Backspace` to remove.
- **Multi-floor support** — stack multiple floors (each with its own grid and contents); switch the active floor via tabs, add/delete floors. Inactive floors render dimmed and non-interactive.
- **Adjacency graph + bubble-diagram view** — a toggleable 2D force-directed diagram of the whole dwelling: rooms/clusters/stairs as nodes, touch-based adjacency as edges, cross-floor stair links shown as "↑/↓ Floor N" stubs, entrances marked with an ENTRY ring.
- **Layout rules validation ("Check Layout")** — on-demand, advisory only (never blocks placement). Reads the whole-dwelling adjacency graph (all floors + cross-floor stair edges), rooted at entrances. Results are shown as a grouped text report, highlighted nodes/edges in the bubble diagram, and tinted shells/markers in the 3D view. See **Layout rules** below for the full list.
- **Save / Load** — export the whole project (all floors, rooms, modules, stairs, entrances) to a `.json` file; import via a file picker or drag-and-drop onto the viewport. Versioned format with graceful handling of older/newer files.
- **Camera** — orbit/zoom (OrbitControls) with a **Reset View** button to return to the default axonometric angle.

## Layout rules

All rules are advisory (never block placement) and run on demand via **Check Layout**. Severity: 🔴 hard (likely failure), 🟡 soft (atypical, not wrong), 🟢 note (informational). Defined as data in `src/core/rules.ts` (`RULES`) — add/edit/remove entries there without touching the validation engine.

| ID | Severity | Rule |
|---|---|---|
| E1 | 🔴 hard | No entrance defined — the entrance is the unit's interface to the building. |
| E2 | 🔴 hard | Entrance is blocked — its edge no longer faces outside. |
| DR1 | 🟢 note | No doors placed — reachability requires doors. |
| DR2 | 🟢 note | Bedroom has an unusual number of doors for a private room. |
| P1 | 🔴 hard | A dwelling needs a bathroom. |
| P2 | 🔴 hard | A dwelling needs a kitchen. |
| P3 | 🟢 note | More than one kitchen — atypical, but not a problem. |
| MB1 | 🟡 soft | A floor has bedrooms but no bathroom. |
| H1 | 🔴 hard | Orphaned room — no path of adjacencies (including stairs) reaches an entrance. |
| H2 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bathroom. |
| H3 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bedroom. |
| H4 | 🔴 hard | Direct door between a bathroom and a kitchen — food prep opening onto a toilet. |
| S6 | 🟢 note | Shared wet wall between kitchen and bathroom — efficient services. |
| H6 | 🔴 hard | A room or stair reachable from an entrance only by passing through an outdoor space. |
| C1 | 🟡 soft | Orphaned corridor — a circulation space connected to nothing (dead space). |
| C2 | 🟡 soft | Under-used corridor — connects to only one space, so it doesn't circulate. |
| A1 | 🟡 soft | Circulation narrower than 1.2 m (below accessible width). |
| O1 | 🟡 soft | Outdoor space is unconnected — nothing opens onto it. |
| OD1 | 🔴 hard | Outdoor space is not reachable from the dwelling. |
| ST1 | 🟡 soft | Stair connects to nothing on one or both floors it should link. |
| ST2 | 🔴 hard | Stair not reachable from any entrance. |
| ST3 | 🔴 hard | A floor is not reachable by stairs from the entrance floor. Fires once for the whole dwelling; H1, C1 and OD1 stay quiet about spaces on that floor, since they would all be restating the same cause. |
| D1 | 🔴 hard | Room has no exterior wall — no daylight possible. |
| D2 | 🟡 soft | Kitchen has no exterior wall — no natural ventilation. |
| W1 | 🟡 soft | Room's glazing is below its daylight target. |
| OR1 | 🟡 soft | Room is lit only from the north (no direct sun). |
| OR2 | 🟡 soft | Room's glazing faces only the orientation this project asks to avoid (see **Orientation preference** in the sidebar). |
| G1 | 🟡 soft | No bathroom is reachable without passing through a bedroom (guest access). |
| G2 | 🟡 soft | Entrance opens directly into a private room. |
| S1 | 🟡 soft | Outdoor / balcony over-connected (more than two doors) — usually a leaf space. |
| S2 | 🟡 soft | Living room under-connected (one or no doors) — typically a social hub. |
| S3 | 🟡 soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access). |
| AC1 | 🟡 soft | Bedroom shares a wall with a stair — stair noise against a sleeping room. |
| S5 | 🟢 note | Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation. |
| S7 | 🟢 note | En-suite bathroom (accessed via bedroom). |
| DP1 | 🟡 soft | Room is unusually deep in the layout (≥5 hops from the entrance, tunable via `DEEP_ROOM_THRESHOLD_HOPS`). |
| N1 | 🟡 soft | Circulation-heavy layout — too much of the interior is circulation. |
| PG1 | 🟡 soft | Inverted privacy gradient — bedrooms are shallower than living spaces. |
| F1 | 🟡 soft | Room is far from any exit (more than 4 hops from the nearest entrance or stair, tunable via `ESCAPE_DEPTH_MAX`). |
| WET1 | 🟡 soft | Wet rooms (bathrooms, kitchen) are split across separate groups on a floor. Split wet areas mean long installation runs and shafts that cannot bundle to the next storey. |
| FAC1 | 🔴 hard | Habitable room has no facade — it touches neither open sky nor a balcony. (PBG LS 700.1 § 302: every habitable room needs a facade window) |

Recreation Room is classified as a **public/social room** (same category as Living Room)
for the privacy rules above (`ctx.is.public`), and as **habitable** (same category as
Bedroom + Living Room) for the daylight and facade rules (`ctx.is.habitable`).

Listed in the order they appear in `RULES`, which groups them by theme. This table is
generated from the code; if it disagrees with `src/core/rules.ts`, the code is right.

## Views and modes

Every control in the interface, and what it does. Nothing here changes the saved
project unless it says so: the view toggles are session state and are never written to
a `.json` file.

**Top left.**

- **DIAGRAM** replaces the 3D view with the bubble diagram, a force-directed graph of
  the whole dwelling. Rooms, clusters and stairs are nodes; a solid line is an access
  edge (a door, or a french window onto a balcony) and a dashed line is spaces merely
  touching. Cross-floor stair links appear as "↑/↓ Floor N" stubs. Check Layout stays
  available while it is open.
- **TOP VIEW** switches from the axonometric to a straight-down plan, and it works.
  Pressing it hides every floor above the active one, keeps the ones at or below it,
  turns on the door-swing arcs, which are a plan symbol and are hidden otherwise, locks
  camera rotation so the view cannot be tumbled off axis, and re-frames onto the
  building's extent from above. The button then reads **Axo View**, and pressing it
  again restores every floor's previous visibility, hides the arcs, unlocks rotation and
  re-frames to the axonometric. It is mutually exclusive with DIAGRAM.

**Top right.**

- **CHECK LAYOUT** runs the layout rules once, on demand, and opens the report panel.
  It is advisory: nothing it says blocks placement, saving or export. Results also tint
  the implicated rooms in 3D and highlight the matching nodes in the bubble diagram.
  Any change to the layout clears the report, because it would otherwise describe a
  building that no longer exists.
- **RESET VIEW** frames the camera on whatever is currently placed, rather than jumping
  to a fixed position, so it stays useful however large the grid gets.
- **?** lists the keyboard shortcuts.

**Bottom right.** These four are pure view state.

- **CUTAWAY** (on by default) hides whichever walls face the camera so you can see into
  the rooms. Turning it off renders every wall, which is how to look at the building as
  a solid object with its facades and windows.
- **Seeds** outlines each elastic room's authored rectangle inside the shape it grew
  into. Living rooms, bedrooms and recreation rooms expand to absorb enclosed leftover
  space, and this shows what was actually placed versus what was derived.
- **Structure** is an x-ray: it hides the walls and glazing of those same elastic rooms,
  leaving the serviced and structural parts, meaning bathrooms, kitchen, circulation,
  stairs and entrances, reading on their own.
- **Interface view** shows only what the flat owes the building around it. The
  perimeter stands with its glazing, and wet rooms, the stair, balconies and the
  entrance stay as they are; every other room loses its partitions, furniture, door
  markers and colour, so the rest reads as one open plate. Bedrooms keep a tinted plate
  marking position.
- The **compass** below them sets the north direction. This one is not view state: it is
  saved with the project and it moves the windows, because glazing is biased toward the
  south.

**Left sidebar.**

- **EXPORT** writes the whole project, every floor and everything on it, to a `.json`
  file. **IMPORT** reads one back; a file can also be dragged onto the view. **EXPORT
  UNIT** writes a different and much smaller file, a `dwelling-unit` bridge file
  describing this flat as one unit for the building packer in the companion repository.
- **FLOORS** lists the floors. One is active and interactive at a time and the rest
  render dimmed; the eye icon hides a floor entirely. Add and delete floors here. A
  stair placed on the top floor creates the floor above automatically.
- **ROOMS**, **MODULES** and **STAIRS** are the palette. Drag an entry onto the grid to
  place it. A green ghost means the position is legal and a red one means it collides.
  Once placed, click to select, `R` rotates by 90°, `M` mirrors, dragging moves, and
  `Delete` removes. Shift-click adds to a selection and the whole selection moves or
  deletes together.

Three example flats live in `testflats/`. Open one with IMPORT to see a finished layout
rather than starting from an empty grid. In development only, `?project=` loads one
straight from the URL, for example `http://localhost:5173/?project=flat-1-two-storey.json`;
a bare name resolves against `testflats/`. It goes through the same import path as the
button and is stripped from production builds.

## Run locally

Requires Node.js (18+).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Project structure

```
src/
  core/        grid, occupancy, room/module definitions, floors, placement store,
               adjacency graph, layout rules engine, entrances, exterior-edge
               detection, project save/load (JSON)
  scene/       Three.js scene, camera, meshes, room shells + dynamic cutaway,
               stair geometry, stairwell holes, entrance markers, connector
               cluster shells, voxel furniture props, rules-validation highlighting
  interaction/ pointer picking, drag-to-place, selection/move/rotate/delete,
               entrance placement
  ui/          sidebar palette, floor tabs, grid-size controls, bubble-diagram
               view, layout-check report panel, toast notifications
  main.ts      wiring
```

## Notes

- Rooms, modules, and stairs on a given floor share one occupancy map (collision is checked uniformly between them); each floor is otherwise independent, except that a stair's footprint reserves a matching hole on the floor directly above.
- The adjacency graph and layout rules span the *whole dwelling* (all floors), not just the active floor — cross-floor reachability is carried by stair edges.
- Facade/window placement is not implemented yet; the daylight rules (D1/D2) only check that a room *has* an exterior wall, not what's on it (planned follow-up, will reuse the existing exterior-edge utility).
- The rules documents are kept here as HTML (`docs/rules-list.html`, `docs/rules-reference.html`) and the PDFs are generated on demand with `python docs/build-pdf.py docs/rules-reference.html docs/rules-reference.pdf`. The built PDFs live on the shared Drive rather than in this repo, because they are large binaries that change on every rules edit.
