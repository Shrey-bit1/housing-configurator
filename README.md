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

**Entrance validity**
| ID | Severity | Rule |
|---|---|---|
| E1 | 🟢 note | No (working) entrance placed yet — reachability can't be validated. |
| E2 | 🔴 hard | An entrance's edge no longer faces outside (a room was later built against it) — it stops counting as a reachability root. |

**Program completeness**
| ID | Severity | Rule |
|---|---|---|
| P1 | 🔴 hard | A dwelling needs a bathroom. |
| P2 | 🔴 hard | A dwelling needs a kitchen. |
| P3 | 🟢 note | More than one kitchen — atypical, but not a problem. |

**Reachability** (entrance-rooted, whole dwelling, across stairs — corridors are *not* required; a direct room-to-room path is valid)
| ID | Severity | Rule |
|---|---|---|
| H1 | 🔴 hard | Orphaned room — no path of adjacencies reaches any entrance. |
| H2 | 🔴 hard | A room or stair is reachable from an entrance only by passing through a bathroom. |
| H3 | 🔴 hard | A room or stair is reachable from an entrance only by passing through a bedroom. |
| H6 | 🔴 hard | A room or stair is reachable from an entrance only by passing through an outdoor space. |
| ST2 | 🔴 hard | A stair itself is not reachable from any entrance. |

**Adjacency / privacy**
| ID | Severity | Rule |
|---|---|---|
| H4 | 🔴 hard | Bathroom directly adjacent to a kitchen. |
| S3 | 🟡 soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy). |
| S4 | 🟡 soft | Two bedrooms directly adjacent. |
| S5 | 🟢 note | Kitchen and living room adjacent — open-plan; noted, not a problem. |
| G1 | 🟡 soft | No bathroom is reachable without passing through a bedroom (no guest access). |
| G2 | 🟡 soft | An entrance opens directly into a bedroom or bathroom. |

**Corridor justification** (circulation clusters)
| ID | Severity | Rule |
|---|---|---|
| C1 | 🔴 hard | Orphaned corridor — connects to nothing (dead space). |
| C2 | 🟡 soft | Under-used corridor — connects to only one space, so it doesn't circulate. |

**Stairs**
| ID | Severity | Rule |
|---|---|---|
| ST1 | 🟡 soft | Stair connects to nothing on one or both of the floors it should link. |
| ST2 | 🔴 hard | (see Reachability above) |

**Daylight / ventilation** (a room's footprint must have at least one exterior wall)
| ID | Severity | Rule |
|---|---|---|
| D1 | 🔴 hard | A habitable room (Bedroom, Living Room, or Recreation Room) has no exterior wall — no daylight possible. |
| D2 | 🟡 soft | A Kitchen has no exterior wall — no natural ventilation. |

**Room-count / connectivity balance**
| ID | Severity | Rule |
|---|---|---|
| S1 | 🟡 soft | Outdoor/balcony over-connected (more than two adjacencies) — usually a leaf space. |
| S2 | 🟡 soft | Living room under-connected (one or no adjacencies) — typically a social hub. |

**Space-syntax depth** (informational metric: BFS hop-count from the nearest entrance, shown per-room in the report and as a small badge on each diagram node)
| ID | Severity | Rule |
|---|---|---|
| DP1 | 🟡 soft | A room is unusually deep in the layout (≥5 hops from the nearest entrance — tunable via `DEEP_ROOM_THRESHOLD_HOPS`). |

Recreation Room is classified as a **public/social room** (same category as Living Room) for the privacy rules above (`ctx.is.public`), and as **habitable** (same category as Bedroom + Living Room) for the daylight rule (`ctx.is.habitable`).

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
