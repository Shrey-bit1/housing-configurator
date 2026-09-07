# PROJECT_STATE.md

Reference doc for reorienting after context loss. Reflects the actual code in
the working tree on `main` — the interior-doors feature (§2i) and rules batches
①/②/③ (§8) are committed here alongside this doc (baseline `30bf5dd` = mirroring
+ multi-select/group-ops). Reference-style, not prose. **Read the cited files to
confirm before relying on any detail.**

---

## 1. What the project is

A browser-based **3D flat / housing configurator** built with **TypeScript +
Three.js**, bundled with **Vite**. It is a thesis tool: the user places
modular rooms, furniture, and stairs on a 0.6 m grid across multiple floors,
viewed in an axonometric (isometric) or straight-down plan projection. Rooms
snap to the grid, can be rotated in 90° increments, mirrored (left/right flip —
since the elastic-rooms batch ① every room PRESET is a rectangle, so only the
chiral dogleg stair gains a new shape from it; see §2g), moved, and
deleted, singly or as a **multi-selection** (Shift-click, group move/delete —
see §2h); the
app renders rooms as hollow "dollhouse" shells with a camera-aware cutaway so
interiors are visible. The user authors **entrances** (exterior edges) and
**doors** (interior edges) — and **reachability is strictly door-based**:
two spaces are connected only when a door joins them (see §2i). A whole-dwelling
adjacency graph (rooms/clusters/stairs as nodes; physical TOUCH edges +
authored-door ACCESS edges) feeds an advisory, on-demand layout rules engine and
a toggleable bubble-diagram view. Projects save/load to JSON. It is a
work-in-progress research artifact, not a production app.

---

## 2. Core architecture — systems and the files that own them

| System | Owner file(s) | Notes |
|---|---|---|
| Grid + occupancy + coordinate conversion | `src/core/grid.ts` | `Grid` class: dims, occupancy `Map<"cx,cz", instanceId>`, `holeCells` (stairwell voids), `gridToWorld`/`worldToGrid` (grid centred on world origin), `canPlace(cells, exclude?: string \| Set<string>)` (a Set excludes every id in it at once — the group-move self-exclusion primitive, §2h), `plateAvailable`/`occupy`/`free`/`setHoles`/`ownerAt`/`inBounds`/`resize`. `CELL_SIZE = 0.6`. |
| Room / module / stair definitions + **THE central footprint transform** | `src/core/modules.ts` | `MODULE_DEFS` registry, `ModuleDef` (`category: "module" \| "room" \| "stair"`), `rect()`/`lShape()` footprint helpers, `ROOM_HEIGHT = 4`. **Every room preset is a RECTANGLE** (elastic-rooms batch ①): Living 7×5, Kitchen 4×4, Bedroom-S 5×4, Bedroom-L 6×5, Bathrooms 3×3/4×4, Recreation 5×5, Circulation/Outdoor 1×1/1×2. Run 0020 added `wc` 2×3, `bathroom_full` 4×4 and `bathroom_full_compact` 3×4 (§2t), and replaced the single 2×6 stair with five stair entries (§2a). `lShape` is currently caller-less (kept + exported as a shared utility; rectangles are the seeds for the coming derived-expansion batch). Transform: `rotateCell`/`mirrorCell`/**`transformCell`**/`rotatedCells`/`occupiedCells` — **mirror THEN rotate**, see §2g. `MODULE_LIST` (furniture), `ROOM_LIST`, `STAIR_LIST`. |
| Placed-instance store (place/move/rotate/**mirror**/delete, **group ops**) | `src/core/store.ts` | `ModuleStore`: single source mutating occupancy + scene together. `instances: Map<id, ModuleInstance>` (each carries `mirrored: boolean`), `onChange` hook, `extraPlacementCheck?` (cross-floor stair rule, set by FloorManager), `canPlaceInstance(def, cells, excludeId?: string \| Set<string>)`, `place(type,origin,rotation,mirrored)`, `move(id,origin,rotation,mirrored?)` (rebuilds the mesh when rotation OR mirror changes), `rotate(id)`/`mirror(id)` (both pivot on the origin cell, both collision-checked), `reconcileAfterResize`, `maxRoomHeightCells`. **Group ops** (§2h): `moveMany(moves)` (atomic rigid move, all-or-nothing, self-exclusion via a Set, never rebuilds meshes since rotation/mirror are untouched), `removeMany(ids)` (single `onChange`), `placeMany(items)` (atomic batch place — new ids, no exclusion needed — used by group duplicate). |
| Mesh building: solid cubes, **room shells**, connector tiles, **concave-corner wall logic**, **window panel-kit + glazing** | `src/scene/moduleMesh.ts` | `buildModuleMesh()` routes: `category==="stair"` → `buildStairGroup` (stairMesh.ts); connector → tile; room → `buildRoomShell` (hollow open-top shell, walls built directly at the floor's true height — see §2b); else solid cubes. `buildBoundaryWalls()` is the shared clean-corner wall generator (exported; reused by clusters), and — given a per-edge `windows` map — replaces a windowed edge's solid segment with sill/lintel panels + a glazing pane (see §2d), and — given a `doors` edge-key set — cuts a fixed 0→`DOOR_OPENING_H` opening with a solid header above (see §2i). `rebuildRoomWalls()` rebuilds just a room's wall+glazing meshes in place when height, windows, or doors change. `makeGlassMaterial()`, `setSelected()`, `setHovered(group, hovered, selected)` (subtler emissive intensity 0.15 vs selection's 0.35; no-ops when `selected` or when a rules-violation tint owns the material — §2h). `WALL_T = 0.1`, `FLOOR_H = 0.15`. |
| **Rule-driven window generator** (derived, per room) | `src/core/windows.ts` | `computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys, northAngle=0) → WindowPlan`. Pure computation (no Three.js). `WINDOW_CONFIG` per-type table (target ratio + variant). Seed runs sorted by SOUTHERNNESS under `northAngle` (§2d, §2k). The plan's `GlazingStat` carries `sectors`/`northLit` (derived orientation). See §2d. |
| **North / orientation** (compass convention + bearings) | `src/core/orientation.ts` | THE one place the north concept lives: convention (north = world −Z rotated CW-from-above by `northAngle`), `normalBearing`/`sideBearing` (normal→compass bearing), `bearingSector` (8-wind), `southDistance` (south-bias score), `isNorthLit`/`NORTH_SECTOR_HALF_WIDTH` (OR1), `worldNorthDir` (arrow projection). Pure, no Three.js. See §2k. |
| **Compass dial** (north-setting control) | `src/ui/compassDial.ts` | `createCompassDial({onInput,onCommit})` — draggable SVG dial (top-down frame, N-marked needle); `onInput` live during drag, `onCommit` on release (commit-on-release). `setAngle` syncs display after load/undo. See §2k. |
| **Stair proportions** (the arithmetic) | `src/core/stairSpec.ts` | `STAIR_SPECS` (five entries, four types), `planStair`, `spiralPlan`, `riserCountFor`, `splitRisers`. Pure, no three.js. See §2a. |
| **Stair geometry** (four types, two floors) | `src/scene/stairMesh.ts` | `buildStairGroup(def, rotation, ghost, mirrored, storeyHeightM)` + `rebuildStairRise`. Built at the floor's TRUE height, never scaled. See §2a; mirroring negates x centres only (winding-safe, §2g). |
| Dynamic dollhouse **cutaway** | `src/scene/cutaway.ts` | Skips meshes tagged `userData.structureHidden` (the Structure fixed-layer view outranks it, §2n) and never sees railings (they carry no `wallNormal`). `updateCutaway()` hides wall meshes whose `userData.wallNormal · viewDir > THRESHOLD (0.12)`; throttled (recompute on camera move or `markCutawayDirty()`). `setCutawayEnabled(on)` toggles the whole pass — OFF shows every wall (solid exterior; the "Cutaway" view control, §2k). Unaffected by the §2b wall-height mechanism (walls are rebuilt, not scaled — `wallNormal` tags are untouched either way) or the top view (a straight-down `viewDir` dots to ~0 against every wall normal, which are always in the XZ plane — every wall stays visible, reading correctly as a plan). |
| **Multi-floor** support, stacking, **wall/stair height reconciliation**, **window generation**, **floor visibility**, **zoom-to-extent box** | `src/core/floor.ts`, `src/core/floorManager.ts` | See §2b (height), §2d (windows), §5 (visibility/framing). `Floor` = own grid + `ModuleStore` + `GridView` + `HoleView` + `EntranceView` + `entrances[]` + `windowStats` + `clusterGroup`, all under one `group`. `FloorManager`: stack, active floor, vertical stacking offsets, dim inactive floors, stairwell holes, `rebuildAllShells()` (all floors' room walls + windows + DOOR OPENINGS + merged cluster shells), `pruneStaleDoors()` (auto-remove doors a mutation stranded, inside the same undo snapshot), `doorTargets()`/`isDoorValid()` (door placement/validity), floor visibility, content bounding box. `DEFAULT_FLOOR_CELLS = 4`, `CLEARANCE_CELLS = 1`. |
| Grid dots / floor visual | `src/scene/gridView.ts` | Intersection dots + border; `setDimmed`. |
| Stairwell **hole** rendering | `src/scene/holeView.ts` | `HoleView`: recessed dark panel + outline per stairwell opening (merged per connected component). Purely visual; occupancy blocking is `Grid.holeCells`. |
| Ground-floor **entrance** marker rendering | `src/scene/entranceView.ts` | `EntranceView` + `makeEntranceMesh` + `entranceSpan`: renders `Floor.entrances` as two-cell DOOR LEAVES at `DOOR_OPENING_H`, with a floor threshold strip (the plan read) and two `ENTRY` canvas-texture label plates in the wall plane. The second cell is DERIVED at draw time via `Floor.canWidenEntrance`, never stored (§2p). Every descendant is tagged `userData.entranceId`, because picking reads it off whichever object the ray hit. |
| **Entrance placement** interaction | `src/interaction/entranceController.ts`, `src/core/entrance.ts` | `EntranceController`: ghost preview + click-to-place (ground floor only). `isActive` getter + public `cancel()` — Escape is arbitrated centrally by main.ts (§2h), not handled internally here. `Entrance { id, cell, side }`. Entrances are also SELECTABLE/DELETABLE (via `SelectionController`, see §2f) but explicitly EXCLUDED from multi-select/group ops (§2h): click a marker to select, Delete to remove. `Floor.removeEntrance(id)`; `EntranceView.markers`/`setSelectedId`. |
| **Interior door** model + validity + space-target resolver | `src/core/door.ts` | `Door { id, cell, side }` (2-edge span, edge-key bound); `DOOR_SPAN=2`, `DOOR_OPENING_H=2.1`, `BELOW_PREFIX`; `doorId`/`doorEdges`; **`resolveDoorSpaces(door, targetAt)`** (the one definition of door validity + connectivity — both edges must join the SAME two distinct spaces); **`buildSpaceTargets(floor, floorBelow?)`** (cell → space token: room/stair id, cluster node id, or `^stair` for a hole projected up from below — shared by placement, pruning, and the graph); `doorWallCuts` (per-door room-local + cluster-absolute opening edge sets). See §2i. |
| Interior-door **marker rendering** | `src/scene/doorView.ts` | `DoorView` + `makeDoorMesh`: a violet floor-threshold strip across each door's opening (reads in plan view; the door's click target, `userData.doorId`). Renders `Floor.doors` on ANY floor. Also `makeDoorArc` — the standard architectural swing symbol (leaf line + quarter-circle arc) per door in a separate `arcs` group, shown only in plan view (`setArcsVisible`, §2i swing). |
| **Door placement** interaction | `src/interaction/doorController.ts` | `DoorController`: hover a shared interior boundary → a 2-edge ghost slides along the nearest wall, green/red per `FloorManager.isDoorValid`; click commits. `isActive`/public `cancel()`, Escape arbitrated centrally (§2h). Doors are SELECTABLE/DELETABLE via `SelectionController` (§2f, its second `MarkerSelectionAdapter`), on any floor. |
| **Undo / redo history** (snapshot-based) | `src/core/history.ts` | `History`: undo/redo stacks of serialized-project snapshots (cap 20), commit-after-action model, restore via the import rebuild path. See §2f. |
| **Exterior-edge detection** (reusable) | `src/core/exteriorEdges.ts` | `exteriorEdges(cells, occupied) → BoundaryEdge[]`. Standalone/generic: consumed by entrance placement/validity, the daylight rules (D1/D2 via `GraphNode.hasExteriorEdge`), and reserved for a future facade/window task. |
| **Circulation / Outdoor cluster merging** | `src/scene/clusterShells.ts` (+ `src/core/cluster.ts`) | `rebuildClusterShells(floor, grid, wallHeight, doors?)` groups connector cells by `def.cluster`, flood-fills connected components (`connectedComponents`), draws ONE merged boundary shell per cluster (outer walls only) via `buildBoundaryWalls` — cutting any door openings (ABSOLUTE edge keys) on the cluster side of a room↔cluster / cluster↔cluster boundary. |
| **Voxel furniture prop** system | `src/scene/props/*` | `voxelProp.ts` (format + `PROP_LIBRARY`, now auto-loaded from `data/*.json` via `import.meta.glob` — drop a JSON in, no code change), `place.ts` (transform/tiling/clip/wall-clip + merged `InstancedMesh`; `buildPropsMesh(..., mirror)` negates emitted voxel x + mirrors the clip footprint, §2g), `kitchen.ts` (Kitchen layout), `rooms.ts` (Bathroom/Bedroom/Living/Recreation layouts, §2l), `index.ts` (`PROP_BUILDERS: Record<string, (mirrored) => Group>` — kitchen + the 6 room-type builders). Data in `src/scene/props/data/*.json` (19 props). |
| **Whole-dwelling adjacency graph** (rules + bubble-diagram data) | `src/core/adjacencyGraph.ts` | `computeDwellingGraph(floors) → DwellingGraph`. See §2c. |
| **Layout rules engine** (advisory, on-demand) | `src/core/rules.ts` | `RULES: Rule[]`, `validate(graph)`, `computeEntranceDepths(graph)`. See §8 for the full current rule table. |
| Rules-violation **3D highlighting** | `src/scene/highlight.ts` | `applyRoomHighlights(floors, violations)` / `clearRoomHighlights(floors)`: emissive tint on implicated room/cluster/stair shells + entrance markers, across ALL floors, resolved via `parseDwellingNodeId`. Plus `setHoverEmphasis`/`clearHoverEmphasis`: an intensity-only boost on top of an active tint, for report-card hover — see §2j. |
| Bubble-diagram **view** | `src/ui/graphView.ts` | Toggleable full-screen 2D force-directed diagram of the WHOLE dwelling at once — one column per floor, stairs straddling their floor-pair boundary, draggable/pinnable nodes. See §2j. |
| Validation report panel | `src/ui/validationPanel.ts` | `renderValidationPanel()`: the 256px horizontal bottom sheet of §2s, a header of counts and metrics over a rail of one card per violation. It replaced a vertical top-left column with grouped sections. Cards with a resolvable target fire `onHoverViolation` on mouseenter/leave (orchestrated in main.ts — see §2j); dwelling-level cards don't. |
| **Project save / load** | `src/core/projectIO.ts` | `serializeProject(floors) → ProjectFile`, `parseProject(text) → ParsedProject` (tolerant/versioned). Per-floor `entrances` AND `doors` are additive edge-bound lists (`normalizeEdgeBound` serves both). See §3. Camera state and floor visibility are deliberately excluded (view state, not design state). |
| **Elastic-room expansion** (derived effective footprints) | `src/core/expansion.ts` | `computeExpansion(floor) → Map<instanceId, Cell[]>` — pure, per-floor, recomputed on every layout change. See §2m for the class split, algorithm, and the two-tier occupancy contract. `isElastic(def)` lives in modules.ts. |
| **Unit export — flat → building bridge** | `src/core/unitExport.ts` (+ `docs/bridge-format.md`) | `buildUnitExport(fm, name, color) → {ok, file \| reason}`: the `dwelling-unit` v1 exporter for the bottom-up-design building packer. READ-ONLY (no store mutation, no history commit). Envelope per storey = `buildSpaceTargets` key set; edges classified entrance/glazed/open/blank by reusing graph entrance re-validation, `computeWindows`, and Outdoor-cluster membership. See §9. |
| Sidebar palette / grid-size / floor tabs / floor-visibility toggles | `src/ui/palette.ts` | Rebuilt on floor-state change. |
| Scene/camera/lights, **zoom-to-extent framing** | `src/scene/sceneSetup.ts` | Orthographic camera, `frameBox(box, direction)`. See §5. |
| Interaction | `src/interaction/picker.ts`, `dragDrop.ts`, `selection.ts` | Raycast picking (`cellAt`/`groupAt`/`groundPoint`, scoped to the ACTIVE floor's store — this is also why floor visibility needs no picker-side filtering, see §5), palette→canvas placement, select/**multi-select**/move/**group-move**/rotate/**mirror**/delete/**group-delete**/**Shift+D-duplicate** (any count) of modules, plus entrance AND door select/delete (two `MarkerSelectionAdapter`s — mutually exclusive singletons, excluded from multi-select). `R`/`M` work on the palette ghost, the move ghost, the duplicate ghost, and a SINGLE selected instance — no-op on 2+ (§2h). `dragDrop.cancelPlacement()`/`selection.cancelDuplicate()`/`entranceController.cancel()` are public, no-argument, and NOT wired to their own Escape listeners — Escape is arbitrated centrally by main.ts (§2h). `dragDrop`/`selection` take an `onAfterAction` callback (fires after a committed mutation → undo snapshot, see §2f); `selection` also takes `onSelectionChange`/`onNoopHint` callbacks and an `EntranceSelectionAdapter`. |
| **Group-move ghost** | `src/scene/groupGhostPreview.ts` | `GroupGhostPreview`: one translucent ghost mesh per selected member, positioned by its cell offset from the grabbed member's target origin, tinted green/red as ONE unit (mirrors `GhostPreview`'s shape/API). See §2h. |
| Wiring / render loop / view-mode orchestration, **dev-only `?project=` loader + `window.__app` capture handle** | `src/main.ts` | Constructs everything; `animate()` renders 3D or drives the graph view; owns Reset View, plan-mode, diagram-mode toggle logic (mutually exclusive, see §5), the undo/redo history wiring (§2f), the central Escape-priority handler, and the selection-readout/shortcuts-legend wiring (§2h). Default grid 16×16. |
| **The session store** (shared HTTP store for many residents, run 0022) | `src/session/store.ts`, `netlify/functions/session.mts` | `handleSession(req, kv)`: one Netlify function under `/api/session/{code}` routed by path regex + method; `KV` interface (`get`/`getWithMetadata`/`set`/`delete`, the last added in run 0035) that `@netlify/blobs`' `Store` satisfies structurally, so `store.test.ts` drives it through a `Map`. Never imports the app. `sameResident(a, b)` (run 0026: trimmed, case-insensitive) is the ownership check's rule, and run 0035's leave and rename calls reach it through `residentKey`, `flatsOwnedBy` and `storedName` rather than answering the same question a second time; a building run's optional `plot` (run 0026, opaque) rides alongside `genome`/`summary`. See §12. |
| **The preview** (one axonometric for every flat, run 0024) | `src/core/previewFrame.ts` | `axoFrame(box, aspect)`: pure box-corner-projection math (no THREE, no DOM) for the app's own isometric pose, pinned in `previewFrame.test.ts` against a known box. Applied to the live camera by `captureFlatPreview` in `main.ts`. See §10, §11. |
| **The flat's three live numbers** (run 0026) | `src/core/unitStats.ts` | `unitStats(storeys)`: area (cells × 0.36 m²), storey count, glazing length (glazed edges × 0.6 m) off an already-built unit's storeys. Its own file, not a function in `unitExport.ts`, specifically so a fast test importing it never pays that module's runtime import graph (`./adjacencyGraph`, `./door`, `./windows`) — see `unitExport.test.ts`'s own header and `unitStats.ts`'s. Read by `refreshFlatFigures` (`main.ts`), which writes the bar's strip in step 01 and the read-out under the drawing in step 02. See §11, §14. |
| **The flat is kept as you draw** (run 0036) | `src/core/draft.ts` | `saveDraft(store, snapshot)`, `readDraft(store, search)` and `draftHasRooms(text)`, over a two-method `DraftStore` that `localStorage` satisfies. The draft is the SAME string the undo history takes as a snapshot, so the app serializes once per action. `readDraft` is the one rule with three reasons to say no: no store, a URL naming a project, or a draft with no rooms. `draft.test.ts` drives it with a Map. See §17. |
| **The rules the chrome runs on** (run 0027) | `src/core/flatState.ts` | `flatPhase(placedRooms, unitBuilds)` → `empty` / `unready` / `ready`, plus `canSend`, `showsDropHint`, `checksRun`, the empty screen's own words, `showsLanding(search)`, and (run 0036) `sendButton(phase, state, complaints)`, the whole rule for step 02's one button, answering a label, a notice and whether it is awake. Pure, no DOM: one production rule over one state value, read by the numbers, the check chip, the drop hint, the Send button and step 02's tab, so none of them can disagree. `flatState.test.ts` drives both rules directly. See §14. |
| **The landing, shared by both apps** (run 0037) | `_cowork/design/landing/landing.html`, `landing.css` | The whole landing as one fragment both repositories render, byte for byte, with `data-app="flat"` or `"building"` on the root picking the doors and the dot tones. Self-contained: every selector scoped under `#landing`, every colour and font declared on `#landing` itself. Inlined by `src/main.ts` with `?raw` at build time. The Context folder holds the source; `src/landingShared.test.ts` fingerprints this copy against the hash in the brief. See §18. |
| **The journey, as data** (run 0027) | `src/core/journey.ts` | `JOURNEY`, six ordered steps across the two apps, with `journeyIndex(id)` and (run 0034) `journeyTones(currentId, thisApp)` → `now` / `here` / `elsewhere`, which replaced run 0027's `journeyMarks` and its `done` / `now` / `ahead`. Since run 0037 the landing does NOT render it: the six dots are markup in the shared fragment and their tones come from `data-app` in CSS. `JOURNEY` stays the record of what the six steps are, and `landingShared.test.ts` checks the fragment's dots against it in order and wording, so the two cannot part company. Pure, no DOM; `journey.test.ts` pins the order and the tones. See §14, §18. |
| **The session settings + the publish call** (who, which group, the fourth output, and the takeover confirm, runs 0023-0026) | `src/session/session.ts` | `readSession`/`writeSession` over a two-method `KeyValue` (localStorage key `reconfigure.session`, shape `{resident, code}`; `?session=` wins and is stored), `normalizeCode`/`isValidCode` (the store's rule mirrored), `whyPublishDisabled`, `sessionLine`, `publishUnit(fetchLike, base, settings, id, label, text, replace?)` which PUTs the unit bytes and never throws, `takeoverConfirmText(owner)` and `decideTakeover(r, replaceTicked, confirmed)` (run 0025: the post-409 decision — retry, decline with its exact line, or proceed — pulled out so `window.confirm` never has to be driven in a test). Pure; `session.test.ts` drives it with a Map and a stub. Its OWN strings say "group", never "session" or "room" (run 0026, words only — the module, the type, the storage key and every `/api/session/…` path keep their names). See §10, §11, §12. |

**Concave-corner wall logic** (part of `buildBoundaryWalls`): walls are inset to
the INTERIOR side of their boundary line (no protrusion). N/S walls (run in x)
take full length and "own" corner squares; E/W walls (run in z) are trimmed by
one wall thickness at any end where the same cell also has a perpendicular
boundary (convex corner). At concave corners the two walls belong to different
cells and meet edge-to-edge with no overlap. Walls are grouped into ≤4 merged
meshes by outward normal (±x, ±z), each tagged `userData.wallNormal` for
cutaway. Unaffected by which height value the caller passes in (§2b) — the
XZ tracing/corner math is independent of `fullH`.

### 2a. Stair geometry (`stairSpec.ts` + `stairMesh.ts`)

**FOUR REAL STAIRS since run 0020.** The 13 August supervisor meeting called
the old one-cell stair illegal: a 0.6 m flight is not a stair. The proportions
now come from `core/stairSpec.ts`, pure and tested (`stairSpec.test.ts`, 23
cases), and `scene/stairMesh.ts` draws exactly what that reports.

**The rule.** Riser target 170 mm, tread 270 mm, walking rule 2R + T = 610.
The riser is derived, not chosen: the storey height fixes the total rise, the
riser count is the one landing nearest 170 mm, and the exact riser is carried
UNROUNDED. At the default 3.0 m storey that is **18 risers of 166.667 mm**, so
2R + T = 603.3 mm, 6.7 mm under target. The tread holds at 270 mm and
compresses only when a footprint would otherwise be overrun (`treadCompressed`
says so); the suite checks every type across storeys from 2.4 to 4.2 m, because
occupancy is the contract and geometry must never leave the cells it claims.

| type | cells | metres | flights | risers | run per flight |
|---|---|---|---|---|---|
| `stair_straight` | 2×8 | 1.2 × 4.8 | 1 | 18 | 17 × 270 = 4.59 m |
| `stair_dogleg` (default) | 3×6 | 1.8 × 3.6 | 2 | 9 + 9 | 8 × 270 = 2.16 m |
| `stair_dogleg_wide` | 4×6 | 2.4 × 3.6 | 2 | 9 + 9 | 2.16 m |
| `stair_spiral` | 4×4 | 2.4 × 2.4 | 1 turn | 18 | 20° per tread |
| `stair_c` | 4×6 | 2.4 × 3.6 | 3 | 6 + 6 + 6 | 5 × 270 = 1.35 m |

The dogleg ships TIGHT (two 0.9 m flights) as the default because that is the
standard domestic dogleg and what a dwelling can spare; the generous 2.4 m
version is a separate palette entry rather than an option on the same one.

**The spiral is the exception, and says so.** A going on a spiral is an arc, so
it depends where it is measured. In a 2.4 m square with a 100 mm newel the
walking line sits at 650 mm, where 18 treads of 20° give a **227 mm** going,
not 270, so 2R + T comes to 560.2 mm. Reaching 270 mm at that tread angle needs
a 773 mm walking line, hence a 2.89 m circle and a **5×5** cell square.
`spiralPlan` returns both numbers so the trade stays visible; the 4×4 was
built as asked and the miss is reported rather than hidden.

**Built at true height, never scaled.** Until run 0020 a stair was built once at
a 3.0 m reference rise and stretched by `group.scale.y`, so the risers on screen
were never the risers the model meant and the proportion drifted with the floor.
`buildStairGroup(def, rotation, ghost, mirrored, storeyHeightM)` now builds at
the real floor-to-floor height — the same `wallHeight` the room shells get
through `ModuleStore.wallHeightProvider` — and `FloorManager.updateStairScales`
holds `scale.y` at 1, calling `rebuildStairRise` (a no-op unless the height
actually moved) when a tall room changes the storey. Same in-place, same-material
pattern as `rebuildRoomWalls`, so selection and violation tints survive.

Each flight is a RAKING SLAB: steps on top, a 180 mm soffit underneath, ends
closed vertically. They were briefly solid masses down to the ground, which
made a dogleg a 1.8 × 3.6 × 3.0 m block with steps scratched into the top and
read as disjoint lumps from most angles; a flight you can see under is what
makes a stair legible. Landings are 120 mm slabs for the same reason. All four
are built in the un-rotated local frame and placed
in a subgroup rotated by −rotation·90°. Mirroring negates x centres and angles,
NEVER `scale.x = -1` (which would invert winding and normals — the bug class
behind the old stair-wedge fix). `mergeGeometries` is fed geometries normalized
to non-indexed first: it returns null on a mixed set, and the spiral's newel is
an indexed `CylinderGeometry` among non-indexed extrusions.

**The retired stair.** `MODULE_DEFS.stair` (the 2×6 with 0.6 m flights) is out
of `STAIR_LIST`, so nothing new can be placed, and still in `MODULE_DEFS`, so
pre-0020 files load with their stair, their stairwell hole and their
floor-to-floor connection intact. `testflats/flat-1-two-storey.json` still
carries one, verified loading and still reading its 12-issue baseline.

### 2t. The two bathrooms, and cross-storey visibility (run 0020)

**Three new wet rooms**, from the 13 August user test: the participant wanted a
small room with only a basin and a WC, and the meeting added that a proper
bathroom with a bathtub should sit beside it.

| type | cells | metres | fixtures |
|---|---|---|---|
| `wc` | 2×3 | 1.2 × 1.8 | WC, basin |
| `bathroom_full` | 4×4 | 2.4 × 2.4 | bath, basin, WC |
| `bathroom_full_compact` | 3×4 | 1.8 × 2.4 | bath, basin, WC |

All three join `BATHROOM_TYPES`, which is THE one list `isBathroom`, `isWet`,
`WET_TYPES` and rules.ts's `ctx.is.bathroom` all read, so they carry the whole
wet interface with no other edit anywhere.

**The sizes were checked, not assumed.** The props are drawn at true size from
the voxel data (50 mm per voxel): WC 400 × 700, basin 500 × 400, bathtub
1700 × 750 — the tub is exactly the 170 × 75 the meeting named.
`props/bathroomFit.test.ts` (19 cases) measures the clear floor each layout
leaves against domestic figures (600 mm at a WC, 600 at a basin, 700 at a bath)
and reads the numbers off the SAME files the app draws:
- `wc` leaves **600 mm** clear in front of the WC (1800 − 700 − 500) over the
  full 1.2 m width, and 800 mm clear past the basin. Standard cloakroom, tight
  and legal.
- `bathroom_full` leaves **950 mm** between the tub's face and the WC's, with
  700 mm to spare along the tub wall.
- `bathroom_full_compact` keeps the same 950 mm, and **the tub is what binds**:
  1700 mm in an 1800 mm wall leaves 100 mm. One cell narrower does not admit a
  bath at all, which is why 3×4 is the floor.

**Cross-storey visibility.** Editing an upper storey used to hide the stair you
were connecting to, for two separate reasons, both fixed:
- `HoleView`'s opening was an OPAQUE dark plate, drawing a black hole exactly
  where the arriving flight should show. It is now a translucent wash
  (`VOID_OPACITY` 0.18) with `depthWrite: false`, so it still reads as a recess
  over nothing and disappears behind a flight when there is one.
- An inactive floor was dimmed by lerping colours 0.74 toward the background,
  which is flat grey and fully opaque. `Floor`'s `fade()` now also drops opacity
  (`DIM_OPACITY` 0.35) with a gentler `DIM_AMOUNT` 0.62, so a lower storey reads
  as a ghost of itself. Each material's own `transparent`/`opacity` is recorded
  in `userData.baseOpacity`/`baseTransparent` on first touch and restored
  exactly, which is what keeps glazing (already transparent) from being
  flattened when its floor becomes active again.

**Three follow-on fixes**, from testing the above against a real two-storey flat:
- **The shadow-catcher was an invisible occluder.** `sceneSetup.ts`'s ground
  plane is a `ShadowMaterial`, so it is transparent, and it had `depthWrite`
  ON while the FloorManager parks it at the ACTIVE floor's height. Transparent
  objects sort back-to-front by centroid, so whether it drew before or after
  the storey beneath it flipped with the camera angle, and whole stairs and
  rooms blinked out as the view orbited. This only surfaced once dimmed floors
  became transparent themselves: while they were opaque they drew in the
  earlier pass and were safe. It is now `depthWrite: false`, `renderOrder: -1`.
- **Dimmed floors draw at `renderOrder = -2`**, so an inactive storey can never
  paint over the one being edited regardless of orbit.
- **Furniture on an inactive floor is HIDDEN, not faded** (`hideProps`, keyed on
  the `userData.props` tag `props/place.ts` sets). Voxel props carry
  `userData.noDim` because their colour lives in an instanceColor buffer that
  the colour pass cannot reach, so a dimmed storey used to read as a grey shell
  full of full-strength furniture.

### 2u. Double-height rooms (run 0021)

A resident could author a flat over two storeys and nothing said a room may
open into the storey above. The building app was guessing from stacked room
ids, right on 170 of 185 seams and wrong on 15. This is the property that
replaces the guess.

**The room BELOW owns the void.** `ModuleInstance.doubleHeight` (store.ts) is
a per-instance flag on the lower room, toggled only through
`ModuleStore.setDoubleHeight(id, on)`, never written directly, because the
floor above has to be checked first. Only a non-cluster ROOM can carry it:
furniture has no volume worth opening, and a connector is drawn as one merged
cluster shell so a flag on a single piece would mean nothing coherent.

**One void concept, two causes.** `FloorManager.voidCells(floor)` returns the
stair footprints AND the double-height footprints together, and that one list
drives everything: the floor above's `setHoles` (which blocks placement and
draws no plate), and the export's `openCeilings`. Stairwells and double-height
rooms are different intentions with the same consequence, so they meet in one
place rather than being tracked apart.

**Refusal, never deletion.** `store.doubleHeightObstruction` (set by the
FloorManager, which is the only thing that knows the stack) returns the
OBSTRUCTING CELLS rather than a boolean, so the refusal can name them. Marking
a room whose volume above is occupied fails and the toast lists the cells;
nothing on the floor above is ever removed to make room. Verified: a 7×5
living room under a 5×4 bedroom refuses with 20 cells named, the bedroom
intact.

**The derived storey height does NOT change.** The room takes the storey above
rather than making its own storey taller, so `maxRoomHeightCells` still reads
`def.height` and the stack does not move. Measured: the walls rise to 6.0 m
while the floor spacing stays 3.0 m.

**A mark on the topmost floor CREATES the floor above**, exactly as a stair
does, because the mark claims a storey and that storey had better exist.
`syncStairsAndHoles` reads `voidCells(top)` rather than `stairCells(top)` for
that branch, so both cases take one path. Appending a floor no longer drops
plan mode either: `onStructureChange` extends `prePlanVisibility` and re-applies
it rather than exiting, so placing a stair while reading a plan leaves you in
the plan.

**Geometry.** `rebuildAllShells` passes `height + floorHeight(above)` for a
marked room, so the walls rise through both storeys. It adds the floor ABOVE's
own height rather than doubling this one, which stays correct when the two
storeys differ. No ceiling had to be removed: `buildRoomShell` already draws an
open-top shell. On the upper storey the footprint is a hole, and `HoleView`'s
panel is now translucent (`VOID_OPACITY` 0.18, `depthWrite: false`) so the room
below reads through it instead of being hidden behind a dark plate.

**The void is the GROWN room, and growth is constrained by the storey above.**
Both halves matter and they are one mechanism.

An elastic room that grew IS that bigger room, so `doubleHeightCells` reads
`floor.effectiveCells` and falls back to the seed only before the first derive
pass. Reading the seed left a grown double-height room roofed over the part it
had grown into, which is a floor hanging in mid-air inside a two-storey space.

And a double-height room may only GROW where the storey above is free, because
growing is how it claims more of that storey. `computeExpansion` takes an
`occupiedAbove` predicate and skips a double-height room as a candidate for any
gap cell whose volume above is occupied; the cell is still offered to other
rooms, so an ordinary neighbour can take space the double-height room cannot.
Single-height rooms are untouched by it, since they claim nothing up there.

**The order this needs, and why it is not circular.** The dependencies read:

    holes(N)     ← voidCells(N−1) ← effective(N−1)
    effective(N) ← holes(N)  and  ← RAW occupancy(N+1)

The first is a chain UP the stack, so floor N−1 finishes before floor N starts.
The second reaches downward only as far as raw placed cells, which are source of
truth and derived from nothing, so it closes no loop.
`FloorManager.deriveVoidsAndExpansion` therefore walks the stack BOTTOM-UP,
setting each floor's holes and then its effective footprints in the same step.
Doing all the holes first and all the expansion after, which is what run 0021
originally did, meant a floor's holes came from the PREVIOUS pass's effective
footprints and lagged a whole sync behind the growth.

**And the opening is DRAWN cell by cell** (`scene/holeView.ts`). Each opening
used to be one rectangle spanning its connected component's extent, which is
exact for a stairwell, whose footprint is always rectangular, and wrong for
anything else: a room that grew around an obstruction is an L, and the bounding
box painted the notch as open floor when the floor was really there. The wash
is now a quad per cell merged into one geometry, and the outline is every cell
edge whose neighbour is not also open, which traces the true boundary of any
shape and still reads as a single line around a plain rectangle. Adjacent
openings merge on their own, so `connectedComponents` is no longer needed here.

Measured on a living room with a 35-cell seed and a 7-cell enclosed strip it
grows into: it holds 42 cells and voids 42; put a bathroom on the storey above
covering four of those strip cells and it retracts to 38, voids 38, and paints
38 (it painted a 42-cell rectangle before); remove the bathroom and it returns
to 42. `src/core/doubleHeight.slow.test.ts` pins all of it, plus the rule that a
single-height room in the same layout keeps all 42.

**The control is a TOOL in Structure & Access**, beside Entrance and Doorway
(`interaction/doubleHeightController.ts`, armed from `ui/palette.ts`). Arm it,
click a room, and the mark toggles; the tool stays armed so several rooms can
be marked in a row, hovering highlights the room the click would affect through
the same emissive selection uses, and Escape disarms it through main.ts's
central arbitrator. It is a tool rather than a button on the selection readout
because marking a room is the same shape of act as placing an entrance or a
doorway, and this app already says that with an armed mode and a click.

**Serialization is additive.** `InstanceData.doubleHeight?: boolean` beside
`mirrored`, defaulted false by `normalizeInstance`, so a pre-0021 project loads
with every room single height, which is what it meant. `APP_PROJECT_VERSION`
stays 1. `loadProject` restores the flag directly rather than through
`setDoubleHeight`, because the floors above are still being filled in during
the load loop and re-validating mid-load would reject valid projects on loop
order alone.

**On the bridge** it becomes `storeys[i].openCeilings` (§9 and
docs/bridge-format.md), the per-cell list of seams with no floor.

### 2b. Wall / floor-to-floor height

`FloorManager.floorHeight(floor)` (private) = `(max(DEFAULT_FLOOR_CELLS,
floor.store.maxRoomHeightCells) + CLEARANCE_CELLS) * CELL_SIZE` — the vertical
floor-to-floor spacing used both for stacking (`recomputeStack()`) and for
wall height.

**Walls are built directly at their floor's true height — no scale hack.**
(An earlier version of this fix tagged wall meshes with `userData.
wallBaseHeight` and rescaled `scale.y` in a FloorManager pass; that was
replaced this session with true-height geometry, since a hidden scale factor
would have complicated the upcoming window/door band-slicing feature and
distorted any future wall texture.) `buildBoundaryWalls()` (moduleMesh.ts)
still takes an explicit `fullH` param — nothing about its XZ boundary-tracing/
concave-corner logic changed — but every CALLER now passes the floor's real
`floorHeight(floor)` instead of a fixed reference constant:
- `ModuleStore.wallHeightProvider?: () => number` (set by `FloorManager.
  createFloor()` to `() => this.floorHeight(floor)`, same pattern as the
  existing `extraPlacementCheck`) — `buildModuleMesh()`/`buildRoomShell()`
  build a NEW or ROTATED room's walls at the correct height from the start.
- `rebuildClusterShells(floor, grid, wallHeight)` — takes an explicit height
  param (was the fixed `FULL_H = ROOM_HEIGHT * CELL_SIZE` constant); fed
  `floorHeight(floor)` from `store.onChange`. Cluster shells already fully
  rebuild from occupancy on every change, so this needed no new rebuild
  trigger, just the correct height value.
- `FloorManager.rebuildWalls()` (private, replaces the old
  `updateWallHeights()`; called from `syncStairsAndHoles()` right after
  `updateStairScales()` — same trigger, same frequency, on every place/move/
  rotate/delete/resize) walks every ROOM instance (`category==="room"`, not a
  connector) on each floor and calls `rebuildRoomWalls(inst.group, inst.def,
  inst.rotation, floorHeight(floor))` (exported from moduleMesh.ts) —
  removes and disposes the group's existing `userData.isWall`-tagged
  children and rebuilds them via `buildBoundaryWalls()` at the target height.
  Floor slab and interior props are untouched; the room's existing shared
  `userData.material` is reused (verified: selection/dim tinting survives
  the rebuild, since it's the same material object, not a fresh one).
  Reconciles EVERY room on the floor unconditionally (not just the one just
  placed) — this is what makes an existing room's walls follow suit if some
  OTHER room's placement changes the floor's height. Stairs are excluded
  (their `group.scale.y` rise-scaling in `updateStairScales()` is
  semantically intended — a taller floor means taller risers — and stays
  untouched).

Verified: `scale.y === 1` on every wall mesh (room shells AND cluster
shells) after place/rotate/floor-add, wall tops still land exactly on the
next floor's slab start (zero gap, same bounding-box check as before),
selection tint survives an in-place rebuild.

**Implication for future work:** wall geometry is now correctly sized at
build time — a window/door band-slicing feature (or a future wall texture)
can compute against a wall mesh's actual dimensions directly, with no hidden
scale factor to account for.

### 2c. Whole-dwelling adjacency graph (`adjacencyGraph.ts`)

`computeDwellingGraph(floors: Floor[]) → DwellingGraph` spans ALL floors (not
just the active one). Node ids are namespaced `<floor>/<rawId>`
(`dwellingNodeId`/`parseDwellingNodeId`) since per-floor instance/cluster ids
collide across floors.

**Two edge kinds** (`GraphEdge.viaDoor`, see §2i and §3):
- **TOUCH** (`viaDoor: false`): footprints share a wall (orthogonal cells) —
  physical adjacency. Also a cross-floor `viaStair` touch where a stair
  physically underlies the floor above. Consumed ONLY by the proximity rules
  (H4/S3/S4/S5) and drawn faint/dashed in the diagram.
- **ACCESS** (`viaDoor: true`): an authored door binds the two spaces (§2i).
  The ONLY edges that confer reachability — every reachability/connectivity
  rule traverses these (see §2i, §8). Built by resolving each door to the two
  spaces its edges bind, via the shared `buildSpaceTargets` map.

**Stairs are graph nodes** (`kind: "stair"`), not a same-floor-to-next-floor
shortcut. A stair gets TOUCH edges from the generic pass (bottom-side same-floor
adjacency + a `viaStair` top-side touch to whatever overlies its footprint on the
floor above), but those confer NO reachability. A stair connects for reachability
ONLY where a door faces it: a door on the stair's own floor → a bottom ACCESS
edge; a door on the floor above facing the stair's hole projection → a top
`viaStair` ACCESS edge (the `^`-prefixed below-stair token in `buildSpaceTargets`).
So a room on floor N reaches a room on floor N+1 only through a DOORED stair at
both ends. The stair is inspectable via ST1 (door connections at top/bottom) and
ST2 (door-reachable from an entrance).

Entrances are floor-0-only, RE-VALIDATED on every graph build (not cached):
`EntranceStatus.blocked` is true if the host cell no longer resolves to a
room/cluster, or the edge is no longer exterior (via `exteriorEdges` against
the floor's full occupied-cell set) — so a room built later against an
existing entrance's edge correctly invalidates it. `entryIds` = every
non-blocked entrance's host node id (multiple entrances allowed; "any one
entrance reaches it" is sufficient for reachability, see rules.ts's doc
comment).

`GraphNode.hasExteriorEdge` is computed once per floor (post-pass) and consumed
by the daylight rules (D1/D2) rather than recomputed per-rule. Its occupied set
is the **`buildSpaceTargets(floor, floorBelow)` key set** — the SAME source the
door system uses — so it counts, beyond this floor's rooms/clusters/stairs, the
**stair-hole projections from the floor below**. An edge facing the stairwell
void (no sky) is therefore NOT exterior: without this, a floor-N+1 room bordering
the hole would falsely pass D1 and window onto the void (a live bug, fixed —
same-floor stairs were already covered as real occupants; the hole was the gap).

`GraphNode.glazing?: GlazingStat` (rooms only) carries the derived window
generator's achieved-vs-target glazing, read from `floor.windowStats` (§2d) —
consumed by the W1 rule rather than recomputing windows.

### 2d. Rule-driven windows (`windows.ts`, exterior edges only)

Windows are **DERIVED, never stored** — regenerated from room type + exterior
edges on every wall rebuild, exactly like cluster shells and stair holes.
Nothing new is serialized; export/import reproduces identical windows because
they're a pure function of placement (verified by round-trip). **Exterior
edges only** — interior openings are the separate, AUTHORED door system (§2i),
not derived here.

**What "exterior" means** lives in ONE place — `exteriorEdges(cells, occupied,
isOutside)` — and every consumer passes the same `Floor.isOutside`: an edge is
exterior iff the cell across it is unoccupied AND border-reachable (or out of
bounds). See §2o's sealed-void note; the predicate is required, not optional, so
a call site cannot silently fork the definition.

**Generator** (`computeWindows(cells, roomTypeId, floorHeight, occupied,
isOutside, entranceEdgeKeys, northAngle=0, frenchEdges?) → WindowPlan`, pure, no
Three.js — the plan is a pure function of footprint + floorHeight + occupancy +
entrances + **northAngle**, so it reproduces identically on
load/undo/rotate/mirror/dial):
- Per-type policy in `WINDOW_CONFIG` (tunable): Living/Recreation → ratio 1/6,
  full-height; Bedroom S/L → 1/10, framed; Kitchen → fixed one 2-edge band,
  framed; Bathroom/Circulation/Outdoor (absent from the table) → none.
- **SOUTH BIAS** (§2k): seed runs are chosen SOUTHERNMOST-first — each run's
  compass bearing under `northAngle` (via `sideBearing`), nearest due south
  wins, `southDistance` ascending; length is the tie-break; a final stable
  `runKey` breaks a genuine tie (north pointing exactly inter-cardinal makes two
  faces equidistant from south). The 2-edge-minimum seed check, band growth, and
  corner-wrapping (below) are all UNCHANGED — only the run ORDER changed, so
  glazing migrates to the sunny faces (`northAngle=0` = grid-south = due south =
  the pre-north behaviour exactly). Verified: rotating north 180° jumps a
  bedroom's band from its grid-south to its grid-north face; every other angle
  lands it on whichever face is then most-southern (§6).
- **Orientation** (OR1 + report): after placement, each windowed edge's side →
  bearing under `northAngle` → sector; the plan's `GlazingStat.sectors` is the
  distinct set (south-first), and `northLit` is true iff there IS glazing and
  every windowed edge is within `NORTH_SECTOR_HALF_WIDTH` of due north.
- Targets a glazing-AREA ratio of the room's floor area (floorArea =
  cellCount × 0.36 m²). Per-edge glazing = 0.6 × (floorHeight − 0.9)
  full-height, or 0.6 × (floorHeight − 1.8) framed. `edgesNeeded =
  ceil(area × ratio ÷ perEdge)`.
- **2-edge minimum (1200 mm), enforced — no 1-edge windows ever**: a computed
  1 rounds up to 2; a "need exactly 1 more" is absorbed by extending/overshoot
  so a 1-edge band is never emitted.
- **Edge selection**: exterior edges (`exteriorEdges`, minus any coinciding
  with an entrance — a door wins that edge) grouped into continuous straight
  same-side runs (`buildRuns` — a run itself never turns a corner; see corner
  wrapping below for how a BAND still can). Longest run first; if the run
  alone covers the remaining need, the ORIGINAL centred-slice placement
  (unchanged): band centred on the run, grown to the remaining need (still
  ≥2). Otherwise the WHOLE run is used and the shortfall is sought via corner
  wrapping before falling back to a separate band on the next-longest run.
  Insufficient exterior supply → glaze what's possible; the shortfall is
  flagged by W1, not forced.
- **Corner wrapping**: when a band exhausts its seed run before the target is
  met, it continues around a CONVEX exterior corner onto the adjoining run —
  an L in plan, or (falling out naturally, not special-cased) a U if both ends
  of the seed run wrap. `Arm`/`stepArm`/`cornerCheckSide`/`wrapDirection`
  implement a two-ended walk outward from the seed run's own two ends,
  alternating the low/high arm one edge at a time (so a U grows evenly rather
  than exhausting one side first). Each step either continues straight along
  the current run, or — at a run's end — tests whether THIS SAME CELL also has
  an exterior, not-yet-used edge on the perpendicular face pointing the way
  the arm is heading. That same-cell test can only ever be true at a CONVEX
  corner: a concave/notch corner's two edges belong to two DIFFERENT diagonal
  cells, which a same-cell test structurally never examines — no separate
  concave exclusion is needed, verified both by construction and by an
  extreme-ratio test that saturates a whole L-room's perimeter without ever
  bridging its own notch (§6). An entrance edge is already absent from the
  exterior-edge set the walk reads, so wrapping stops there exactly like a
  straight run does — verified the algorithm reroutes the shortfall to
  whichever end IS open rather than forcing it (§6). **Assumption** (choose
  sensibly / ambiguity noted per the task spec): only a run whose OWN length
  is already ≥2 is ever chosen as a SEED — a run shorter than 2 is skipped
  even if wrapping could reach the minimum some other way; a WRAP segment
  itself can be as short as 1 edge once attached to an already-≥2 seed (the
  band as a whole is what the 2-edge minimum applies to). A run already
  touched by an earlier band's wrap is never re-picked as an independent
  seed — distinct runs are otherwise edge-disjoint by construction, so this
  only ever trips for a wrap-consumed run. Wrapped edges are ordinary entries
  in the same `edges` map (a corner cell can carry two entries, one per side)
  and count toward `achievedRatio` identically to straight ones — **W1's math
  is unchanged**. Deterministic/pure like the rest of `computeWindows` — same
  tie-break discipline, verified across all 4 rotations × mirror (§6).
- Output `WindowPlan`: `edges: Map<absoluteEdgeKey, WindowVariant>` +
  `GlazingStat { targetRatio, achievedRatio, belowTarget }`.

**Panel kit** (built in `buildBoundaryWalls`, moduleMesh.ts): a windowed edge's
full-height solid segment is replaced by a **sill** panel (0→900 mm, always), an
optional **lintel** panel (framed variant: top 900 mm; full-height variant omits
it and the floor slab above acts as lintel), and a translucent **glazing** pane
filling the gap. Panel heights are ABSOLUTE (stay 900 mm on taller floors; the
glazing gap absorbs extra height) — this is why walls are now true-height
geometry (§2b), so the bands are computed against real dimensions. Sill/lintel
are still SOLID wall (same shared room material, merged into the same per-normal
wall mesh → they tint/dim/cutaway exactly like wall); glazing uses a per-room
`makeGlassMaterial()` (translucent, `depthWrite:false`, `renderOrder:1`,
`baseColor` so dimming fades it). Glass meshes carry the SAME
`userData.wallNormal` tag as solid walls, so the cutaway hides panels + glass
together with their face (verified).

**Corner glazing — glass-to-glass, no post** (same `buildBoundaryWalls`). Sill
and lintel need NO wrap-specific handling: both are solid boxes using the exact
same `(xMin,xMax,zMin,zMax)` footprint a plain wall segment would, so they
already close at a corner via the pre-existing corner-ownership trim (N/S owns
the square, E/W is trimmed away from it) — the same mechanism already verified
for plain walls. Only the GLAZING pane needed a fix: it's a thin `GLASS_T`
sliver INSET from that trim boundary, so two independently-wrapped panes would
each fall short of the true corner by about half a wall thickness, leaving a
gap. Fix, deliberately ASYMMETRIC: when a cell's own perpendicular edge is ALSO
windowed (the same same-cell convex-corner test windows.ts uses), the E/W
pane's glazing extends PAST its usual trim to the TRUE corner; the N/S pane is
left completely UNCHANGED (it already spans the corner untrimmed, same as a
plain wall — never needs adjustment). The two panes now overlap by about a
`GLASS_T` at the seam instead of falling short — no gap, no corner post,
imperceptible at that scale (verified via pixel sampling across the full window
height, not just one point — §6). Chosen over a symmetric split-at-the-
centreline specifically for the cutaway case below: since the N/S pane is
NEVER shrunk, it still fully covers its own face by itself if the E/W leg is
the one hidden by cutaway — and vice versa, since the E/W extension doesn't
depend on N/S being present either. **Cutaway**: both legs keep their own
face's `userData.wallNormal` tag unchanged (untouched by wrapping), so cutaway
hides one leg while the other remains — correct for a corner window, and (per
the asymmetric design above) verified to leave no seam artifact either way
(§6).

**Integration**: `FloorManager.rebuildAllShells()` computes the floor's occupied
set as the **`buildSpaceTargets(floor, floorBelow)` key set** (rooms + clusters +
this-floor stairs + stair-HOLE PROJECTIONS from the floor below — one source of
truth with the door system and `hasExteriorEdge`, so a room never windows onto
the stairwell void) plus floor-0 entrance edges, then per room calls
`computeWindows(..., this.northAngle)`, converts the ABSOLUTE windowed edges →
LOCAL edge keys (abs − origin; side unchanged since the room group isn't
rotated), and passes them into `rebuildRoomWalls(..., localWindows)`. The
`GlazingStat` (achieved-vs-target PLUS the derived `sectors`/`northLit`
orientation, §2k) is stashed on `floor.windowStats` (instanceId → stat) — read
by W1 (`belowTarget`) and OR1 (`northLit`) and the report's orientation line
(`sectors`), carried onto the room node via `node.glazing`. Windows ride the
existing wall-rebuild pass, so move/rotate/delete of any room — OR a north-dial
change (`FloorManager.setNorthAngle` → `refreshWalls`, §2k) — regenerates them
automatically. Entrance placement doesn't go through `store.onChange`, so it
calls `FloorManager.refreshWalls()` (public) to re-skip the door's edge. Cluster
shells (Circulation/Outdoor) never get windows from the EXTERIOR generator (they
have no daylight target). That sentence is about §2d only, and it should not be
read as a decision about the SEMI-EXTERIOR (french-window) pass, which is a
different system — see the circulation-to-outdoor note below.

**Circulation-to-outdoor (run 0009).** A corridor meeting a balcony used to build
NO wall at all, so a flat stood open to its own balcony along the corridor. The
dissolve in `clusterShells.ts` `clusterWallOpts` was TWO-SIDED there: outdoor
dissolved toward circulation and circulation dissolved toward outdoor, so each
deferred to the other and neither built a segment. Every other case is one-sided
(a room keeps all its walls, only the connector gives way), and two clusters
facing each other is the case that convention did not cover. Circulation now
KEEPS its wall toward outdoor; outdoor still gives way to circulation, so the
boundary carries exactly one segment, the corridor's.

The second half of that boundary is NOT fixed. `semiExterior.ts` filters its
per-room loop with `if (def.category !== "room" || def.cluster) continue;`, so
circulation clusters never enter `plan.boundary` and never receive french-window
glazing. A corridor therefore gets a solid wall to its balcony where a room would
get glass. Fixing it needs a keying decision: `glazedByRoom` is keyed by ROOM
INSTANCE id, while a cluster is a merged component drawn per component by
`rebuildClusterShells`, which currently passes `undefined // clusters never get
windows` to `buildBoundaryWalls`.

### 2e. Undo / redo (snapshot history, `history.ts`)

Snapshot-based, leveraging that all DESIGN state is tiny serializable
source-of-truth (`projectIO`) and all DERIVED state rebuilds from it through the
same code paths as manual building. A snapshot is a serialized-project JSON
string; a restore is the project-import rebuild path.

`History` (core/history.ts) holds `undoStack`/`redoStack` of snapshot strings
(cap **20**) plus `lastState` (the serialized state as of the last commit).
Constructed with `serialize`, `restore`, `onChange` callbacks.
- **commit()** — called AFTER each mutating user action. Serializes current; if
  unchanged from `lastState` it's a NO-OP (so failed placements, invalid moves,
  same-cell drops, collision-blocked rotates record nothing); otherwise pushes
  the previous `lastState` onto undo, adopts the new one, and clears redo.
- **undo()/redo()** — swap states between the stacks and re-apply via `restore`
  (guarded so restore never re-enters commit).

**Commit hook points** (each = one snapshot): module place (`DragDropController.
onUp`), move/rotate/**mirror**/delete + entrance delete (`SelectionController`,
via its `onAfterAction` callback), entrance place (the
`EntranceController.onPlaced` callback in main), floor add/delete, grid resize,
project import — all wired in main to `commitHistory = () => history.commit()`.
A multi-step drag is ONE action: `store.move` and the commit fire only in
`onPointerUp`, never per `pointermove`, so a whole gesture is a single snapshot
(and an invalid drop commits nothing). A collision-blocked rotate OR mirror
likewise records nothing (serialized state unchanged).

**Restore** (`restoreState` in main): `JSON.parse` → `floors.loadProject(data)`
(the exact import rebuild path — floors recreated, instances re-placed via
`store.place`, all derived state rebuilt), then re-apply VIEW state that the
snapshot doesn't carry: keep the active floor (clamped if the stack shrank) and
per-floor visibility (by index). Clears selection + any stale validation.
Camera is untouched (loadProject doesn't move it). Plan mode is exited only if
the floor-stack shape changed (its per-index bookkeeping would otherwise be
stale — matches `onStructureChange`).

**Explicitly OUTSIDE history** (never snapshotted, never changed by undo):
camera, Reset View, plan-mode toggle, floor visibility, active-floor switch,
selection, diagram toggle, Check Layout — all VIEW state.

**Controls**: Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo (main's
window keydown, ignored while typing in sidebar inputs); plus `#undo-btn` /
`#redo-btn` in the viewport (bottom-left), enabled/disabled from
`history.canUndo`/`canRedo`.

### 2f. Entrance selection / deletion (`selection.ts` + `EntranceView`)

Entrances are first-class selectable objects, handled by `SelectionController`
alongside modules (mutually exclusive selection, shared Delete/Escape). An
injected `EntranceSelectionAdapter` (built in main) does the entrance-specific
work: `pick(x,y)` (raycasts `Floor.entranceMarkers`, gated to when floor 0 is
active), `setSelected(id)` (marker emissive highlight via
`EntranceView.setSelectedId`), `remove(id)` (`Floor.removeEntrance` +
`FloorManager.refreshWalls` so the freed edge may regain a window +
`clearValidation`). Clicking a marker selects it (deselecting anything else);
Delete removes it; Escape deselects. Both place and delete are undoable (§2e).
Deleting the last entrance empties `entryIds`, returning validation to the E1
"place an entrance" gate with no stale highlight/report.

### 2g. Mirroring (all placeables — rooms, furniture, connectors, stairs)

Every `ModuleInstance` carries `mirrored: boolean` (default false) beside its
`rotation`. A CHIRAL footprint can reach all **8 orientations** (4 rotations ×
2 mirror states). Since the elastic-rooms batch ① the only chiral PLACEABLES
are the dogleg stair and the L-triomino furniture piece — every room preset is
now a rectangle, whose mirror is the SAME shape as a rotation (possibly
translated, since the pivot is the origin cell). The mirror MACHINERY is
footprint-agnostic and unchanged — nothing downstream ever assumed 8 distinct
shapes; `mirrored` still round-trips and props still reflect (verified across
4 rotations × 2 mirror states per rect preset in batch ①).

**THE transform order — mirror FIRST, then rotate** (`transformCell` in
modules.ts, the single source of truth):
```ts
mirrorCell({cx,cz})            = {cx: -cx, cz}        // reflect across local X (negate cx)
transformCell(c, rot, mirrored) = rotateCell(mirrored ? mirrorCell(c) : c, rot)
rotatedCells(def, rot, mirrored)          // relative cells
occupiedCells(def, origin, rot, mirrored) // absolute cells
```
Mirror-then-rotate ≠ rotate-then-mirror (`M·R = R⁻¹·M`) — verified they differ
for every L-room, so the order is load-bearing and every consumer must use
`transformCell`/`rotatedCells`/`occupiedCells` rather than rolling its own.

**Consumers all route through it** (each passes `inst.mirrored`): ghost preview
(`ghostPreview.update`, `setMirror`), occupancy/collision (`store.place`/`move`/
`canPlaceInstance`/`reconcileAfterResize`), mesh building (`buildModuleMesh` →
room shell / connector tile / cube path / `rebuildRoomWalls`), prop placement,
stair geometry, `floorManager` (stair cells, occupied set, window generation,
wall rebuild), `adjacencyGraph` (3 sites), `clusterShells`. Exterior edges,
windows, clusters, stairwell holes, and the graph are all pure functions of the
transformed cells, so they follow automatically — **verified**, not assumed
(§6).

**Pivot: the instance's ORIGIN cell** — the same pivot `rotate` uses (local
(0,0)). A symmetric footprint keeps its shape but, like rotation, may translate
(a 3×3 rect mirrored about its origin extends −x instead of +x); a 1×1 is a true
geometric no-op. Both are allowed and harmless.

**Geometry: NEVER negative scale.** `scale.x = -1` inverts triangle winding and
normals — the exact bug class behind the stair-wedge fix (§2a). Mirroring is
always done by **mirroring the data and rebuilding the geometry**:
- *Rooms/walls*: mirrored cells → the existing `buildBoundaryWalls` tracing.
  Verified reflection-equivariant: for every L-room the mirrored wall vertex set
  is the **exact x-reflection** of the unmirrored one (identical vertex counts,
  identical ±x/±z normal set) — concave corners mirror cleanly, nothing to fix.
- *Props*: `buildPropsMesh(placements, footprint, mirror)` negates each emitted
  voxel's local x (`emit`) and mirrors the wall-clip footprint, rebuilding the
  merged `InstancedMesh`. The prop group's `rotation.y` is applied after, so
  props compose as rotate ∘ mirror, matching the cells. Verified: mirrored
  Kitchen props are the exact x-reflection, same 19,195 voxels (wall-clip found
  the reflected walls), all instance matrices +determinant.
- *Stairs*: `buildStairGroup(def, rot, ghost, mirrored)` negates only the three
  lane x-centres (`laneAx`/`laneBx`/`fullCx`). Each piece is a **constant-
  cross-section prism extruded along x**, so reflecting it across x = 0 is
  identical to re-extruding the same CCW profile at the mirrored centre `−cx` —
  a pure translation of a symmetric prism. Profile point lists and extrusion
  width are untouched, so **no winding reversal is needed**: every face keeps
  its CCW-outward winding, material stays default `FrontSide`. Handedness flips
  because lane B swaps sides (which lane the 180° turn goes to). Verified: the
  mirrored stair's (position, outward-normal) pairs are the **exact reflection**
  of the unmirrored one (516 verts, 0 mismatches; x-extent [−0.27,0.87] →
  [−0.87,0.27]); riser normals stay (0,0,−1) on flight 1 and (0,0,+1) on flight
  2 (correct for each flight's climb, unchanged since an x-reflection never
  touches z); the stairwell hole above matches the mirrored footprint.

A whole-scene audit confirms **zero objects with a negative scale component and
zero meshes with a non-positive `matrixWorld` determinant** (with mirrored
rooms, props, and stairs present).

**Serialization is ADDITIVE** — `InstanceData.mirrored?: boolean`. The tolerant
`normalizeInstance` defaults it (`o.mirrored === true`), so pre-feature files
load unchanged with `mirrored=false`. **No format version bump, no migration**
(`APP_PROJECT_VERSION` stays 1). Verified: mirrored round-trips byte-identical
(and rebuilds byte-identical derived state — walls, glazing, props, clusters,
holes); an old file with the field stripped loads all-unmirrored.

**Interaction — `M` toggles mirror:**
- *During ghost placement* (`DragDropController`): rebuilds the preview mesh live
  and re-tints valid/invalid against the mirrored footprint. Reset to false on
  each new palette grab and on cancel.
- *During a move-drag* (`SelectionController.moveMirrored`): flips the in-flight
  ghost; committed with the drop (still ONE snapshot for the gesture).
- *On a selected placed instance*: `store.mirror(id)` → `move(origin, rotation,
  !mirrored)`, collision-checked. If the flipped footprint doesn't fit, `move`
  returns false, the instance is left untouched, and the history commit is a
  no-op (serialized state unchanged) — verified 0 snapshots added.
- Mirroring a placed instance is a mutating action → exactly **one** undo
  snapshot (§2e); undo/redo restore the flag symmetrically. `M` is ignored while
  typing in sidebar inputs. Selection highlight survives the mesh rebuild
  (shared `userData.material`).

**Note (window band centring, benign):** on `living`/`kitchen` the mirrored room's
glazing lands on the opposite side of an **odd-length** exterior run's centre
(a 2-edge band has no exact centre; the tie-break flips under reflection), so
one of the two glazed edges differs from a pure reflection. Edge count, variant,
`achievedRatio`, and `belowTarget` are identical. This is correct by design:
`computeWindows` is a pure function of the *resulting footprint* and knows
nothing about how that footprint was produced (derive-don't-store), so it emits
the canonical plan for that footprint. Walls themselves mirror exactly.

### 2h. Multi-select, group move/delete, hover, duplicate, Escape arbitration, UI polish

**Selection state** (`SelectionController`, `selection.ts`): `selectedIds: Set<string>`
— module instance ids on the ACTIVE FLOOR only (reassigned with `store` on
floor switch, so a stale cross-floor id can never leak in — see the ordering
note below). `selectedEntranceId: string | null` stays a singleton, mutually
exclusive with `selectedIds` (selecting either clears the other). Entrances are
**excluded from multi-select and group ops entirely** — no shift-click
toggling, no group-move participation — because moving them with rooms could
invalidate their bound exterior edge; they remain singly selectable/deletable
exactly as before (§2f).

- **Plain click** on an instance → `setSelection([id])`: replaces the whole set.
- **Shift-click** → `toggleModuleSelection(id)`: adds/removes just that id, a
  pure selection edit with no drag/move initiated (resolved entirely inside
  `onPointerDown`, no pointerup involvement).
- Clicking a MEMBER of an existing multi-selection (no shift) sets up a
  **group-move drag candidate** (`dragIds = new Set(selectedIds)`) but a
  release with NO drag still collapses the selection to just that one instance
  (matches a plain click) — the drag/click distinction is the same
  `DRAG_THRESHOLD_PX` (4px) test used for single-instance moves.
- **`hasSelection`** / **`selectedInstances`** / **`selectedEntranceIdValue`**
  getters expose read-only state to main.ts (readout, Escape arbitration).

**Group move**: dragging any selected member moves the WHOLE set rigidly.
`onPointerMove` snapshots each member's `relOffset` (cell delta from the
grabbed member's origin) once, builds a `GroupGhostPreview` (one ghost mesh per
member, `scene/groupGhostPreview.ts` — mirrors `GhostPreview`'s shape), and on
every move recomputes each member's target cells (`grabbedOrigin +
relOffset`) and validity via `store.canPlaceInstance(def, cells, dragIds)` —
**the whole moving-id Set is excluded from occupancy** (`Grid.canPlace`/
`ModuleStore.canPlaceInstance` were widened to accept `string | Set<string>`),
so members can shuffle into each other's about-to-be-vacated cells (verified:
selecting two adjacent rooms and dragging one so its target lands on the
OTHER's current cells succeeds, while the other member's own target — offset
by the same rigid delta — is validated simultaneously). The group is valid or
invalid as ONE unit (`GroupGhostPreview.setValidity`) — no partial commits.
Commit is `ModuleStore.moveMany(moves)`: validates every member first
(all-or-nothing — if any target is invalid, NOTHING moves), then frees every
member's CURRENT footprint before occupying any NEW footprint (so the two
passes never race regardless of how positions overlap), and — since group move
never touches rotation/mirror — is always a cheap position update, never a
mesh rebuild. One `onAfterAction` call → ONE undo snapshot for the whole
gesture (verified: a mixed rooms+stair+connector group move undoes/redoes as
one step). An invalid drop restores every member's visibility and leaves
everything exactly where it was (verified: 0 snapshots added).

**Group delete**: Del/Backspace with 2+ selected calls `store.removeMany(ids)`
(single `onChange`, so downstream rebuilds run once) — this SUBSUMES the
single-delete path too (removeMany handles 1 or many uniformly; the old
separate single/group branches were unified). One `onAfterAction` call → one
undo snapshot restoring every deleted instance.

**R/M single-selection-only**: rotate/mirror read `selectedIds.size === 1`
before acting; a multi-selection no-ops and fires `onNoopHint?.(message)`
(wired to `showToast("info", …)` in main.ts) rather than silently doing
nothing. Group re-pose (rotating/mirroring a whole selection about a common
centre) is explicitly OUT OF SCOPE for v1 — noted as future work (§7). The
same single-only gating applies to the in-flight move-ghost's R/M (rotating
the ghost mid-drag): a group move-drag silently ignores R/M (no hint — the
key is legitimately meaningless mid-gesture, unlike the idle-selection case).

**Duplicate (Ctrl/Cmd+D OR Shift+D)**: clones the WHOLE current selection —
one instance or many — into a fresh placement ghost that follows the cursor.
Both key combos route into the same `startDuplicate` (see the key handler note
below and the §2h Ctrl/Cmd+D update).
Lives entirely in `SelectionController` (own `duplicating`/`duplicateTemplates`/
`lastDuplicateCell` fields), NOT `DragDropController` — an earlier version
routed a single-instance duplicate through `dragDrop.startPlacementFrom` and
left multi-selection duplicate silently unimplemented (Shift+D was a no-op
with zero feedback whenever 2+ were selected — reported by manual testing,
since automated tests only happened to exercise the single-selection case).
Unified onto the SAME machinery group-move already uses:
- `startDuplicate(insts)`: builds one `GroupGhostMember` template per instance
  (its own def/rotation/mirrored + cell offset from the FIRST instance, the
  anchor), `deselect()`s the real selection, and calls `groupGhost.begin(...)`.
- `onPointerMove` (while `duplicating`) calls `refreshDuplicateGhost(cell)` —
  `picker.cellAt(...)` directly, no grab-offset (unlike group MOVE, there's no
  "pressed" instance to offset from — the ghost just snaps to whatever cell is
  under the cursor). This is what makes it track the cursor freely with **no
  button held** ("pick up, move freely, click to drop", not a press-and-hold
  drag) — `pointermove` fires regardless of button state.
- `onPointerUp` (while `duplicating`) calls `commitDuplicate()`: builds one
  `store.placeMany(items)` call from every template's `(cell + relOffset)` —
  all-or-nothing, single `onChange` — then selects the freshly placed set.
  `onPointerDown` is a no-op while duplicating (commit waits for release), so
  a plain click (down+up, no drag) is what places it.
- R/M rotate/mirror the ghost only when duplicating a SINGLE instance
  (`duplicateTemplates.length === 1`) — rebuilds via `groupGhost.begin(...)`
  then re-runs `refreshDuplicateGhost` to reposition/retint at the last known
  cell. A multi-template duplicate no-ops R/M with a hint (group re-pose is
  out of scope, same rule as elsewhere).
- `cancelDuplicate()` (public) resets everything and is called directly by the
  central Escape arbitrator (`selection.isDuplicating` — checked at the same
  priority tier as `dragDrop.isDragging`, since it's also an active gesture).

`ModuleStore.placeMany` (mirrors `moveMany`/`removeMany`'s shape): validates
every target's cells first — no exclusion needed, these are all brand-new ids
— and if ANY is invalid, NOTHING is placed. A rigid translation of an
already-non-overlapping template set can never introduce a NEW overlap
between the batch's own members, so only EXISTING occupancy needs checking.
`onChange` is suppressed during the placement loop and fired once at the end.

**Key binding: Ctrl/Cmd+D AND Shift+D** (`SelectionController.onKeyDown` 'd'
branch — `if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return; e.preventDefault();`).
Both trigger duplicate; a bare 'd' does nothing.
- **Ctrl/Cmd+D** is the primary binding. It IS interceptable — Ctrl+D (the
  bookmark shortcut) fires a keydown that reaches page JS and `preventDefault()`
  DOES suppress the bookmark in Chrome/Firefox/Edge (unlike the OS-level
  Ctrl+T/N/W, which the browser handles before the page — those genuinely can't
  be overridden). An EARLIER note here claimed Ctrl+D was un-preventable and
  switched to Shift+D; that was over-cautious (it conflated Ctrl+D with the
  OS-level combos). The verification sweep (§6) re-tested and confirmed the
  handler's `preventDefault` fires on a Ctrl+D keydown.
- **Shift+D** is retained as a guaranteed-reliable fallback (matches Blender's
  duplicate convention and this app's R/M single-key style) for any environment
  that does swallow Ctrl+D before the page.
- **Verification caveat (§6):** the browser-automation `key` tool in this dev
  environment cannot emit a MODIFIED keydown at all (Ctrl/Shift both arrive as
  `false`), so the physical bookmark-suppression couldn't be observed through
  automation. It was verified by (a) a faithful synthetic `keydown{ctrlKey:true}`
  whose `preventDefault` fired (dispatchEvent returned cancelled), and (b) the
  full flow — ghost follows the cursor, click places the clone, one undo reverts
  — driven by real mouse + the real Undo button. Real-Ctrl+D + no-bookmark is a
  manual-check item.

**Hover** (`moduleMesh.setHovered`, subtler emissive intensity 0.15 vs
selection's 0.35): `SelectionController.onPointerMove` raycasts
`store.groups` whenever nothing is pressed/dragging and `!dragDrop.isDragging`
(ghost placement owns the cursor's visual feedback while active).
`setHovered(group, hovered, selected)` is a no-op when `selected` is true
(selection's own glow already reads as "in focus" — hover must never
downgrade it) or when `userData.hiPrev !== undefined` (a rules-violation tint,
`highlight.ts`, owns the material — rarer/more important than a passing
mouseover). A `pointerleave` listener clears hover when the cursor exits the
canvas. Hover-clearing is folded into `deselect()` (not a separate path) so it
inherits the SAME floor-switch-safety ordering selection already had:
`FloorManager.setActive()` calls `selection.deselect()` BEFORE reassigning
`.store` to the new floor, so hover/selection cleanup always resolves ids
against the correct (about-to-be-inactive) floor's `instances` map — this
matters because instance ids are per-`ModuleStore` counters, so the SAME id
string can legitimately refer to different instances on different floors.

**Escape — single central arbitrator** (main.ts's keydown listener, extended
from the existing undo/redo handler): exactly this priority order, one thing
happens per keypress —
```
dragDrop.isDragging         → dragDrop.cancelPlacement()   // palette placement
selection.isDuplicating     → selection.cancelDuplicate()  // Shift+D ghost (own flag, not dragDrop's)
entranceController.isActive → entranceController.cancel()
doorController.isActive     → doorController.cancel()       // door-placement mode
selection.hasSelection      → selection.deselect()
planMode                    → exitPlanMode()
```
`dragDrop`/`selection`/`entranceController` no longer listen for Escape
themselves (`cancelPlacement()`/`cancelDuplicate()`/`cancel()` are public
no-arg methods called directly) — previously each had its own independent
Escape branch, which could
all fire for the SAME keypress with no ordering guarantee. Centralizing was
necessary, not cosmetic: the naive fix (keep three listeners, have a fourth
check "did selection already act?" reactively) races, because listeners on the
same `window` node all fire in registration order in the SAME dispatch — by
the time a later listener inspects state, an earlier one may have already
mutated it. One arbitrator, checked top-to-bottom, has no such race.

**Selection readout** (`#selection-readout`, bottom-centre; lifts to `bottom: 312px` while the layout-check sheet is open, §2s):
`updateSelectionReadout()` in main.ts, driven by `SelectionController`'s
`onSelectionChange` callback. Empty when nothing is selected (hidden via a
`.visible` CSS class toggle — NOT `style.display = ""`, which would fall back
to the stylesheet's `display: none` and stay hidden; this exact bug was caught
during verification). Single module → `"{def.name} · Floor {i} · {w}×{h}"`
where the footprint size is the CURRENT rotated+mirrored bounding box
(`rotatedCells(def, rotation, mirrored)`), not the def's nominal rotation-0
size — verified a 7×5 room reads "5×7" once rotated 90°. Multiple → `"{n}
selected"`. A selected entrance → `"Entrance · Floor 0"` (an extension beyond
the spec's literal examples, added for consistency — every selection state
shows something). Floor label uses the same `Floor {i}` (0-indexed) convention
as the sidebar tabs.

**Shortcuts legend** (`#shortcuts-btn`/`#shortcuts-panel`, top-right below
Reset View): static HTML content in index.html (no dynamic data — nothing to
rebuild), reusing `.vp-header`/`.vp-title`/`.vp-close` styles from the
validation panel. A `.open` class toggle shows/hides it; lists every shortcut
(R, M, Del, Shift+Click, Shift+D, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Esc) plus a
note that Reset View/Top View are buttons only.

**Marquee selection: considered, SKIPPED** — plain left-drag on empty ground is
already the camera-orbit gesture (OrbitControls default), and the spec's
literal wording ("click-drag on empty ground rubber-bands a rectangle") would
have overridden that core navigation entirely, which the spec explicitly
permitted skipping if it "fights the interaction model." Shift-click covers
multi-select instead. (A Shift+drag-on-empty-ground variant would sidestep the
conflict — shift+drag is currently unbound — and is a reasonable future
extension; not implemented for v1, see §7.)

### 2i. Interior doors — authored access, door-based reachability

Doors are **authored, stored objects** (the OPPOSITE of derived windows; the
SAME family as entrances). The user places them on shared interior edges, and
**reachability is strictly door-based**: physical touch without a door is not a
connection (the deliberate cutover — old/doorless layouts flag red until doored,
explained by the DR1 note, §8).

**Data model** (`core/door.ts`). `Door { id, cell, side }` — a marker bound to a
shared interior edge, spanning EXACTLY 2 consecutive edges (1200 mm, fixed at 2
for v1); the second edge is implied by the side's run (+x for north/south, +z for
east/west). Stored per floor (`Floor.doors`, ANY floor — unlike floor-0-only
entrances), rebuilt into markers via `DoorView`. `id` = the anchor `edgeKey`.
- **`resolveDoorSpaces(door, targetAt)`** is the ONE definition of door validity
  + connectivity: both of the door's edges must join the SAME two DISTINCT
  spaces (else null → invalid). Caller supplies the token space, so the same
  function serves placement validity and graph access edges.
- **`buildSpaceTargets(floor, floorBelow?)`** maps each cell → an opaque space
  token: a room/stair instance id, a cluster's `clusterNodeId` (all pieces of one
  cluster read as ONE space), or `^`+id for a stair on the floor below projected
  up onto this floor's stairwell hole (how an upper room doors onto the stair
  arrival). Shared by placement validity, stale-door pruning, and the graph.
- **Valid hosts**: room↔room, room↔cluster, cluster↔cluster, and room/cluster↔
  stair (bottom, on the stair's floor; top, on the floor above via the hole
  projection). NOT exterior edges (the entrance's job), interior-to-one-space, or
  edges facing nothing (all verified rejected).

**Geometry — the opening (`moduleMesh.buildBoundaryWalls`, `door.ts`
`DOOR_OPENING_H = 2.1`).** A doored edge gets an OPENING 0→2100 mm with a SOLID
header panel 2100→floorHeight above it. **The deliberate INVERSE of a window**:
a window's sill/lintel panels are FIXED (900 mm) and the glazing GAP absorbs extra
floor height; a door's OPENING is FIXED (2100 mm ergonomic constant) and the
HEADER grows on taller floors. On a 3.0 m floor they coincide (2100 = 3000 − 900)
— do NOT conflate them (verified: at a forced 4.0 m floor the opening stays 2.1 m
and the header grows to fill 2.1→4.0). No sill, no glazing; doors are checked
before windows in `emit` (the two never coincide — windows are exterior-only,
doors interior-only).

**Both wall segments cut.** A shared interior boundary carries TWO wall segments
(each adjacent space builds its own, inset to its side — the concave-corner
architecture). A door must cut BOTH: `FloorManager.doorWallSets` (via
`door.doorWallCuts`) resolves each door edge's two sides through live grid
occupancy and produces a per-room LOCAL opening-edge set (fed to
`rebuildRoomWalls`) AND a cluster-wide ABSOLUTE opening-edge set (fed to
`rebuildClusterShells`). A door onto a stair cuts only the room/cluster side (a
stair/void owner is classified "other" → no shell wall) — verified openings cut
in both a room↔room boundary AND the cluster side of a room↔cluster boundary.

**Marker** (`DoorView`/`makeDoorMesh`). A violet floor-threshold strip across the
opening (distinct from the entrance's magenta), sitting on the slab top so it
reads unambiguously in **plan/top view** where the wall opening is invisible. It
IS the door's click target (`userData.doorId`). Openings/headers inherit the
`wallNormal` tag from the shared wall pass, so cutaway hides them with their face
(same path as windows).

**One door per physical boundary** (`door.doorOverlaps`, `Floor.addDoor`). A door
is rejected if it shares ANY physical boundary edge with an existing door.
`physEdgeKey` keys a unit edge by the unordered pair of cells it separates, so the
TWO (cell, side) representations of one boundary (a door placed from either
adjacent space) map to the same edges — this catches both an opposite-side
duplicate AND two collinear doors overlapping on a shared middle edge (which would
otherwise merge into an illegal 1800 mm opening). `addDoor` returns false on
rejection; the `DoorController` also folds the overlap test into its green/red
validity, so an already-doored boundary shows red and won't commit.

**Placement + selection** (`DoorController`, `selection.ts`). A Door tool (palette
"+ Door", Access panel) enters placement mode; hovering snaps a 2-edge ghost to
the wall nearest the cursor (`picker.groundPoint` → nearest side → span extended
toward the cursor), tinted green (valid) / red (exterior, off-boundary, or an
already-doored boundary); click commits on the ACTIVE floor. Doors are
selectable/deletable exactly like entrances — a second `MarkerSelectionAdapter`
on `SelectionController` (`selectedDoorId`, mutually exclusive with modules +
entrance, EXCLUDED from multi-select); marker click → highlight → Del. Escape
folds into the central arbitrator (§2h). Place, delete, and auto-removal are all
undo-covered. Two interaction-lifecycle guards make this robust:
- **Markers picked before modules** (`selection.onPointerDown`): a door marker is
  a low threshold strip sitting ON TOP of the room/cluster slabs it straddles, so
  a module is always under the cursor too. The entrance/door marker picks run
  FIRST (the marker IS the intended click target), else the underlying room would
  always win and doors could never be selected/deleted.
- **One armed placement mode at a time** (`isToolActive` guard + `main`'s
  `cancelPlacementModes`): while an entrance/door tool is armed, `SelectionController`
  no-ops entirely (its pointer handlers early-return) so a door click never also
  grabs/moves the room under it; and every placement entry point (palette grab,
  +Entrance, +Door) disarms all the others first, so a single pointer release can
  never drive two window-level placement handlers at once.

**Auto-removal of stale doors** (`FloorManager.pruneStaleDoors`, inside
`syncStairsAndHoles` → the store-change pass). Whenever a layout change makes a
door's edges no longer bind two distinct spaces (either side moved/deleted/
changed, or the edge went exterior), the door is removed automatically — in the
SAME synchronous mutation, BEFORE the action's history commit, so ONE Ctrl+Z
restores both the move and the door (verified: moving a room away drops its door
in one snapshot; undo brings back move + door). Doors do NOT travel with rooms —
they are absolute edge-bound and simply vanish when stranded.

**Swing metadata + plan-view arcs** (`Door.swing`, `door.ts`, `doorView.ts`,
`floorManager.assignDefaultSwings`). A door carries an OPTIONAL authored
`swing: { hinge: "a"|"b", into: "A"|"B" }` — which end the leaf pivots on
("a" = anchor end, "b" = far end) and which of the two connected spaces it opens
into ("A" = `door.cell` side, "B" = the neighbour side, matching
`resolveDoorSpaces`'s a/b). Four states (`SWING_STATES`); `nextSwing` cycles them.
- **Default at placement / load** (`computeDefaultSwing`, pure): leaf opens INTO
  THE MORE PRIVATE space — if one side is circulation → into the other (the room);
  else the DEEPER-from-entrance side (`computeEntranceDepths`); tie → space "A".
  Hinge = the opening end at a wall corner of the into-space (so the leaf folds
  against the return wall), else the anchor end "a". `FloorManager.assignDefaultSwings()`
  fills any swing-less door — building the dwelling graph + entrance depths ONCE,
  only if some door needs it — and is called after every door placement
  (`main`'s `doorController.onPlaced`) and after load. Doors are grid-absolute, so
  the default is rotation/mirror/stair-facing agnostic (verified via the pure
  function: corridor→room ⇒ `{hinge:"a",into:"B"}` = into the room; room→room with
  B deeper ⇒ `{hinge:"a",into:"B"}` = into the deeper room).
- **Cycle** — the **S key** on a selected door (`selection.ts` S branch →
  `MarkerSelectionAdapter.cycleSwing` → `Floor.cycleDoorSwing`) steps the 4 states;
  ONE history snapshot per press (undo reverts one cycle — verified). Swing is not
  reachability, so cycling triggers no wall/validation refresh.
- **Render** — `makeDoorArc` draws the leaf line + a 12-segment quarter-circle arc,
  flat just above the threshold strip, in accent violet, in a dedicated `arcs`
  group that is hidden in 3D and shown in plan (`FloorManager.setDoorArcsVisible`,
  toggled by `enterPlanMode`/`exitPlanMode`). Arcs never intercept picking
  (`raycast` disabled) and fade with `setDimmed` (material `userData.baseColor`).

**Serialization** — additive per-floor `doors` list (`DoorData`). Cell+side share
`EntranceData`'s wire shape (`normalizeEdgeBound`), plus an optional `swing`
(`normalizeDoor` wraps the shared reader: a well-formed `{hinge,into}` survives,
absent/garbage → `undefined`, which the loader then fills via
`assignDefaultSwings` — so pre-swing files load with sensible computed defaults).
Tolerant loader → old files load doorless; no version bump (`APP_PROJECT_VERSION`
stays 1). Round-trip verified. `loadProject` restores doors (passing `d.swing`)
after all instances + entrances, then runs one `syncStairsAndHoles()` to cut the
openings and `assignDefaultSwings()` to fill any missing swing.

**`connectionEdges` retired.** The dormant per-room-type `ConnectionEdge`
scaffolding on `ModuleDef` (with its unresolved rotation/mirror semantics) is
SUPERSEDED by authored doors — a user-placed door IS the access specification it
was a proxy for — and was removed from `modules.ts` (reduced to a one-line
historical note). `GraphEdge.viaDoor` is now live, not reserved.

### 2j. Bubble-diagram view — whole-dwelling columns, draggable nodes (`graphView.ts`)

Redesigned from a per-floor view (switched by the active floor) to a single
WHOLE-DWELLING view: one column per floor, left→right ascending, all floors'
nodes force-laid-out in the SAME simulation simultaneously. Pure rendering/
interaction — reads `DwellingGraph` exactly as before; no graph/rules/
serialization changes. Title is static ("Adjacency diagram"); switching the
active floor no longer changes what the diagram shows (only gives the active
column's header a cheap accent-colour emphasis in `drawColumns()` — a `getActiveFloor`
callback is kept for exactly this, nothing else keys off "active" any more).
Column headers sit at the BOTTOM of each column (`drawColumns()`; moved off
the top in the polish pass below — same active-floor emphasis, just
repositioned, `h - HEADER_H/2 - 4`).

**Column geometry** (`columnX0`/`columnCenterX`/`columnBand`/`stairBoundaryX`,
one source of truth reused by layout, drawing, AND pointer handlers so a drag
clamps to exactly the band a node is drawn in): `colWidth = canvasWidth /
floorCount`, recomputed every `frame()`. A room/cluster node's inner keep-out
band is `[floor*colWidth + pad, (floor+1)*colWidth - pad]` (`COL_PAD = 60`,
shrunk adaptively — `clamp(COL_PAD, 4, colWidth/2)` — so a very narrow window
degrades to "pinned at the column's left edge" instead of an inverted/broken
band).

**Stairs straddle the boundary, not a column.** A stair on floor N always has
a floor N+1 (FloorManager guarantees this — placing a stair auto-creates a
floor above if needed, and floor deletion re-creates one if a stair would
otherwise lose it), so `stairBoundaryX(floor) = (floor+1) * colWidth` is always
valid — no "no floor above" fallback needed in practice (not hit in testing).
Multiple stairs on the same floor pair land on the same x at different y
(free vertical placement, same as any node's y). Cross-floor edges (both the
`viaStair` TOUCH pass and the door-gated ACCESS pass — see `adjacencyGraph.ts`
§2c) need NO special routing: every cross-floor edge has exactly one stair
endpoint by construction, so a plain line between two normally-positioned
nodes automatically reaches left into the lower floor's column (the stair's
bottom/same-floor neighbours) and right into the upper floor's column (its
`viaStair` neighbours). **This replaces the old "↑/↓ F‹n›" stub system
entirely** — `StairStub`/`stairStubs()`/`drawStubs()` are deleted, along with
the `DOOR_STAIR`/`STAIR` stub-only colour constants (a stair now just uses its
own `GraphNode.color`, like any other node).

**Force simulation vs. the column constraint.** Repulsion and spring forces
are computed identically for every node regardless of kind or column — the
column system only changes the FINAL "integrate velocity into position" step
in `step()`: a non-stair node's gravity target changes from the old whole-
canvas centre to its OWN column's centre-x (`columnCenterX(node.floor)`, so
floors don't all collapse toward one shared centre), then its x is clamped
into its column band; a stair node never accumulates or applies x-velocity at
all — its x is hard-set to `stairBoundaryX` every frame — so horizontal
repulsion FROM a stair still pushes its neighbours away (the stair acts as a
fixed anchor, using its real boundary position), but nothing ever moves the
stair horizontally. The x-clamp (or x-snap, for stairs) and the y-margin clamp
(`MARGIN_Y = 60`) run every frame regardless of pinned state or column-width
changes, so a resize or a floor being added/removed re-snaps every node into
its (possibly now-different) valid region immediately, with no drift period.

**Dragging (pin-on-drag).** `pointerdown` hit-tests (`hitTest`, latest-drawn-
first so overlapping circles resolve to the topmost) against the graph's
actual node circles; a hit adds the node's id to a `pinned: Set<string>` and
starts tracking `dragId`. `pointermove`/`pointerup` are bound on `window` (not
the canvas) so a drag survives the pointer leaving canvas bounds — both are
inert no-ops whenever `dragId` is null, which is always true while the diagram
isn't visible (a hidden canvas never receives the `pointerdown` that would set
it). A pinned node's position is set directly from the (clamped) pointer
location, bypassing velocity entirely, and its `vx`/`vy` are zeroed every frame
in `step()` so an unpin (double-click a single node, or "Re-layout" — clears
the whole `pinned` set) resumes from rest rather than flinging off with stale
accumulated force. Pinned nodes still fully participate in repulsion/spring
force GENERATION (as fixed anchors), which is what makes an unpinned
neighbour's spring visibly pull toward/relax around a node while it's being
dragged. Room/cluster drag is free within its column band; stair drag ignores
the pointer's x entirely (vertical-only, locked to the boundary) — same clamp
functions as the simulation, so a drag can never place a node somewhere the
sim itself wouldn't allow.

**Toggles + legend** (now a DOM panel, `#graph-legend`, bottom-right over the
canvas — was canvas-drawn text before; converted so the two checkboxes could
be real, accessible controls rather than fake canvas buttons). `showTouch`
(default OFF) and `showDepth` (default ON) are plain instance booleans flipped
by `<input type="checkbox">` `change` listeners wired in the constructor.
Touch-edge visibility: hidden unless `showTouch` OR the edge itself carries a
violation (a flagged touch edge — e.g. S6's shared-wet-wall note, or an S3/AC1
touch violation — must stay visible regardless of the toggle, since it's
carrying actionable information); a touch edge whose pair ALSO has an access
edge stays suppressed either way (the solid line already represents that pair)
unless the touch edge itself is flagged. This one rule (already present
pre-redesign for the access/touch dedup) now also covers what the old stub
toggle would have needed — a cross-floor touch-only edge is just a `viaDoor:
false` edge like any other, so it needs no separate handling. Depth badges
gate on `showDepth` alone (no interaction with severity — see below). "Re-layout"
(`#graph-relayout`, next to the Diagram/Top-View toggles, hidden outside
diagram mode) clears `pinned` — the sim's own forces do the resettling, no
position re-randomization needed. Legend still covers access-vs-touch swatches,
hard/soft/note tier dots, and the entry marker (all static, canvas-equivalent
info, just DOM now).

**Re-layout button visibility — the show/hide (verification-sweep fix, §6).**
`GraphView.show()` sets `relayoutBtn.style.display = "inline-block"` (NOT `""`).
The button's stylesheet default is `#graph-relayout { display: none }` (hidden
outside diagram mode), so clearing the inline style would fall back to that
`none` and the button would never appear — the exact inline-vs-stylesheet-
default pitfall already flagged for `#selection-readout` (§2h). An explicit
value overrides it. (Root cause of a long-standing "Re-layout button absent"
report: `show()` previously set `""`.)

**Depth-badge data — self-computed, no Check-Layout prerequisite (fix, §6).**
`GraphView.frame()` computes `this.depths = computeEntranceDepths(graph)` itself
each frame whenever `showDepth` is on — the diagram OWNS its depth metric now.
Previously depths only arrived via Check Layout's `graphView.setDepths(...)`
(now removed), so opening the diagram and toggling depth on showed NO badges
until you ALSO ran Check Layout — a silent hidden prerequisite (root cause of a
"depth badges render nothing with the toggle on" report; it was NOT a
node-id key mismatch — the namespaced ids always matched). The graph is already
recomputed every frame, so the extra BFS is negligible, and badges are now LIVE
as the layout changes. An empty entrance set → empty map → no badges (reads
correctly as "nothing to measure depth from yet").

**Depth badges — a chip, not a bare numeral.** The original design drew the
hop-count directly on the node's own edge in a small grey fill, which read as
near-invisible on light node colours (the cream bathroom, near-white walls)
and was half-clipped by the node's own circle. Replaced with a small solid
chip: fixed colours independent of the node's fill (`BADGE_BG = "#1e1e1e"`
charcoal, `BADGE_TEXT = "#ffffff"` white numeral, `BADGE_BORDER = "#f4f1ea"`
hairline light stroke), so legibility never depends on what's underneath.
Centred ON the node's rim at 45° (bottom-right): `bx = p.x + r*Math.SQRT1_2`,
`by = p.y + r*Math.SQRT1_2` — i.e. exactly the rim point in that direction, so
the chip (radius `clamp(r*0.32, 9, 13)`) overlaps the node by about half its
own area rather than floating free or sitting fully outside it. Drawn AFTER
the severity glow/border and the hover ring (below), so it's never buried
under either on a flagged/hovered node. `nodeRadius()`'s existing sqrt-of-
cell-count scaling (unchanged) already handled Small-vs-Large legibility by
size; only the badge's OWN rendering changed here.

**Report-card hover emphasis.** Hovering a violation card in the Layout Check
panel (`validationPanel.ts`) emphasizes that violation's target(s) in both the
diagram and the 3D view, layered on top of — never replacing — the normal
post-check tier highlighting; unhover reverts to exactly that normal state.
Orchestration lives in `main.ts` (`onHoverViolation`), matching the file's
existing "panel is pure DOM, main.ts wires highlighting" split:
`validationPanel.ts` only fires the callback on `mouseenter`/`mouseleave`,
gated to cards that actually have something to point at (`v.nodeIds.length >
0 || v.edge` — a dwelling-level card like G1 or a P-rule gets no `.hoverable`
class, no listeners, and no hover-affordance CSS, so it never implies an
interaction that would emphasize nothing).
- **Diagram side** (`GraphView.setHover(v)`): stores `hoverIds =
  new Set(v.nodeIds)` and `hoverEdge = v.edge ?? null`, purely additive draw-
  time state — never mutates `nodeHi`/`edgeHi`. In `draw()`, a hovered node
  gets an extra outlined ring (`HOVER_OUTLINE` black + `HOVER_RING` white,
  drawn at `r+9`, layered after the severity ring/entry marker) and a hovered
  edge gets the same outlined treatment as an overlay stroke on the identical
  path, drawn right after the edge's normal stroke in the SAME loop iteration
  — so it inherits whatever visibility that edge already had (a flagged touch
  edge is always visible regardless of the touch toggle, so its hover overlay
  is too). Cross-floor edges need no special handling here either: the
  overlay is just another `moveTo`/`lineTo` on the same two (already
  correctly positioned) node coordinates.
- **3D side** (`setHoverEmphasis`/`clearHoverEmphasis`, new in `highlight.ts`):
  resolves the SAME dwelling ids `applyRoomHighlights` already knows how to
  resolve — the resolution logic was factored out into
  `resolveNodeMaterials`/`resolveEntranceMaterials` (shared by both highlight
  and hover paths, so they can never disagree about what a given id points
  to) — and bumps ONLY `emissiveIntensity` (0.55 → `HOVER_EMPHASIS_INTENSITY
  = 1.0`) on materials that are already tinted (`mat.userData.hiPrev !==
  undefined`); it never touches `.emissive` (the colour), so it can't fight
  the tier colour or `hiPrev`'s bookkeeping. A small tracked list
  (`hoverMats`) is what `clearHoverEmphasis` walks to reset back to 0.55 —
  explicit reset rather than relying on a later `clearRoomHighlights`, so a
  stray hover-clear after the report's already been dismissed (whose
  `restore()` already reset the material) can't re-introduce a stale
  intensity. `main.ts` calls `clearHoverEmphasis()` from both `clearValidation()`
  and the top of `runCheck()`, so a hover can never survive past the report
  it belonged to.

**Labels + node size.** `shortLabel()` strips a trailing `— Variant` or
`(variant)` suffix (`"Bedroom — Large"` → `"Bedroom"`, `"Stair (dogleg)"` →
`"Stair"`) via one regex — no hardcoded room-type list, so it's automatically
correct for any current or future def whose `name` follows that convention,
and a no-suffix label (`"Kitchen"`, `"Circulation"` — cluster labels come from
`def.group`, which was already suffix-free) passes through unchanged.
`nodeRadius()` (sqrt-of-cell-count, clamped `[18,46]`) was ALREADY the
mechanism distinguishing Small/Large by size before this redesign — reused
as-is, not new.

**View state, not design state.** All of this feature's state (`positions`,
`pinned`, `showTouch`, `showDepth`, and the hover-emphasis pass's `hoverIds`/
`hoverEdge` + `highlight.ts`'s `hoverMats`) lives entirely inside `GraphView`
or `highlight.ts` module state, exactly like the pre-existing `positions`/
`nodeHi`/`edgeHi`/`depths` — `serializeProject()` (`projectIO.ts`) only ever
reads `Floor`/`FloorManager`, which neither of these ever writes to, so there
is no code path by which any of this could reach project JSON (confirmed:
zero references to position/pinned/diagram/graphView/hover-related terms
anywhere in `projectIO.ts`).

### 2k. North compass + orientation-aware windows (`orientation.ts`, dial, cutaway toggle)

A project-level **`northAngle`** (degrees, on `FloorManager`, default 0)
introduces a north direction. `core/orientation.ts` is the ONE place the
convention lives and everything else consumes it — no consumer re-derives a
bearing.

**The convention (precise, stated once):** the geographic **north vector is
world −Z rotated CLOCKWISE (viewed from above, looking down −Y) by
`northAngle`**. At 0, north = world −Z = grid "north" (the −z side); increasing
it swings north toward world +X (east), since east is 90° CW of north. A wall's
**compass bearing** = the CW-from-north angle of its outward normal, `[0,360)`
(0 N, 90 E, 180 S, 270 W). Implementation: `normalBearing(nx,nz,a) =
norm360(atan2(nx,−nz)·deg − a)` — `atan2(nx,−nz)` is the CW-from-world-−Z angle;
subtracting `a` re-references it to true north. `sideBearing(side,a)` wraps it
for a grid Side; `bearingSector` snaps to the 8-wind rose; `southDistance`
(distance to 180) is the seed-bias score; `isNorthLit`/`NORTH_SECTOR_HALF_WIDTH
= 45°` is OR1's test; `worldNorthDir(a) = (sin,−cos)` is the arrow's world
vector. (Rooms carry no absolute rotation — the mirror/rotation is baked into
cells and the room group is unrotated — so a grid Side IS a world side, which is
why one side→bearing map serves both the generator's runs and the 3D walls.)

**South-biased generation** (§2d): `computeWindows` gains `northAngle` and sorts
seed runs southernmost-first; everything else (2-edge min, growth, corner-wrap)
is unchanged. Pure function of (footprint, floorHeight, occupancy, entrances,
northAngle) — deterministic, derive-don't-store, reproduced on load/undo/rotate/
mirror/dial. **Assumption noted:** default room glazing targets only ever need 2
edges, so at default ratios a room simply glazes its single most-southern
qualifying run (wrapping/multi-band, hence a two-sector "S + E" mix, only occurs
when a face is too short — rare at default ratios, exercised via a forced ratio
in testing, §6).

**Orientation is derived into `GlazingStat`** (`sectors`, `northLit`) inside
`computeWindows` (it now has `northAngle`), stashed on `floor.windowStats`,
carried onto `node.glazing`. So **no new graph-node fields** — OR1 reads
`node.glazing.northLit`, the report's "Glazing orientation" line reads
`node.glazing.sectors` (`validationPanel.glazingCard`), both already
flowing through the existing `node.glazing` pipe.

**OR1** (soft, §8): habitable-or-kitchen room whose glazing is all north-facing.
Reads `glazing.northLit`, which is TRUE only when glazing EXISTS and every
windowed edge is within 45° of north — so a room with NO glazing can't trip OR1
(D1/W1 own that), no double-fire.

**Serialization** (`projectIO.ts`): `ProjectFile.northAngle?: number` —
ADDITIVE, tolerant (absent/garbage → 0, wrapped to `[0,360)` in `normalize`),
NO version bump. `serializeProject(floors, northAngle)`; `loadProject` restores
`this.northAngle` BEFORE the rebuild so windows re-derive against it. It is
DESIGN state (it moves windows), so it round-trips and is UNDOABLE — one
snapshot per dial gesture.

**Dial + arrow + toggle** (`main.ts` + `ui/compassDial.ts`, styled Bauhaus in
index.html/style.css):
- **Compass dial** (bottom-right control): a draggable SVG dial in a TOP-DOWN
  frame (screen-up = grid north), so the needle's CW-from-up screen angle IS
  `northAngle`. `onInput` fires live during a drag (updates only the live
  display angle — windows do NOT rebuild mid-drag); `onCommit` fires on release
  → `FloorManager.setNorthAngle` (re-derives windows) + `clearValidation` + one
  `commitHistory` (commit-on-release, per CLAUDE.md). `setAngle` re-syncs the
  dial after load/undo (`syncNorthUI` in main).
- **North arrow badge** (bottom-left, camera-aware, read-only): each frame,
  `main.updateNorthBadge` projects `worldNorthDir(displayNorthAngle)` through the
  camera and rotates the badge to true on-screen north — correct in BOTH axo and
  plan (the projection carries the view; plan is north-up so at north 0 it points
  straight up). Reads `displayNorthAngle` (the live drag angle), so it tracks a
  drag continuously while the windows wait for release. Hidden in diagram mode.
- **Cutaway toggle** ("Cutaway" button, default ON): flips
  `setCutawayEnabled(cutaway.ts)`. OFF renders every wall regardless of camera —
  the building reads as a solid exterior object so its facades/windows (incl.
  corner windows) are visible from outside. Pure session VIEW state — a plain
  `main.ts` boolean, NEVER serialized, untouched by undo/load, independent of
  plan view and per-floor visibility/dimming (the pass only flips
  `wallNormal`-tagged `.visible`).

**View state, not design state (the split here).** `northAngle` IS design state
(serialized, undoable) — it changes the derived windows. The dial's live drag
angle (`displayNorthAngle`), the cutaway on/off, and the badge rotation are pure
VIEW state (never serialized). This is the deliberate line: north the *value* is
design; the *widgets and camera-aware arrow* are view.

### 2l. Baseline furnishing — all room types (`props/rooms.ts`, `props/data/*.json`)

The Kitchen prop pipeline (§2 props row, §3 voxel format) is now extended to
every furnished room type — same machinery, no new abstractions: each layout is
a list of fixture `Placement`s fed to `buildPropsMesh` (merged `InstancedMesh`,
per-voxel wall-clip, room-local frame, mirror + rotation for free). Builders in
`rooms.ts`, registered in `index.ts` `PROP_BUILDERS`:

- **Bathroom** (`bathroom_small` 3×3 / `bathroom_large` 4×4 — separate types,
  separate layouts): small = `toilet` + `basin` + `shower`, one per wall, centre
  clear; large adds `bathtub` on the south wall. Props: `toilet`, `basin` (mirror
  block folded in), `shower`, `bathtub`.
- **Bedroom** (`bedroom_small` 5×4 / `bedroom_large` 6×5, both rect): `bed_single`/
  `bed_double` head against a wall, `nightstand`(s) beside the head, `wardrobe`
  mid-height on the east wall.
- **Living** (7×5 rect): `sofa` on the south long wall, `sideboard` (+ thin dark
  TV slab) on the north wall, `coffee_table` between, `shelving` on the east.
- **Recreation** (5×5 rect): central `games_table`, two `lounge_chair`s toward
  the south corners, `shelving` reused on the north wall.
- **Kitchen** (4×4 rect, re-authored in batch ①): `counter_run` +
  `overhead_cabinet` tile the NORTH wall (4 cells = two clean 2-cell units) with
  the `stove` mid-counter, `sink` on the east wall, `fridge` on the west. The
  north wall is chosen DELIBERATELY: the fixed one-band kitchen window is
  south-biased, so counters/overheads never cover the glazing. Batch ① also
  fixed a latent `tileRun` bug this exposed: the odd-cell REMAINDER clip kept
  the authored left half unconditionally, which is correct only for south/west
  facings — a north/east remainder rendered one cell past the run's end
  (through the wall). The kept half is now facing-dependent (place.ts).

**14 new props** authored as `data/*.json` in the SAME format as the kitchen's
(box-composed 5 cm voxels) so any single prop is swappable with no code change;
`voxelProp.ts` now globs `data/*.json` so a dropped-in JSON registers itself.
Kitchen files/layout are BYTE-UNCHANGED.

**Simplifications (ponytail):** shower glass panels use a solid glass-tint colour
(`#9fb8c8`), NOT the translucent glazing material — the prop system is one opaque
`InstancedMesh`; a translucent prop layer is a future add. Big props (`bed_double`
~17k, `wardrobe` ~11.5k voxels) are solid boxes, heavier than a shell but still
one draw call each (the "merged geometry per instance" requirement); fine for
re-authorable baselines.

**Known limitation (recorded, not solved — §7):** props are static baselines
placed before doors; one may sit in front of a later-placed door. Door-aware
placement is future-gated.

**Verification (Track A):** the SCREENSHOT TOOL WAS DOWN this session (timed out
on every attempt, incl. the empty app after a full server restart), so the
required VISUAL confirmation — silhouettes read, colours within palette, cutaway
interiors — was NOT done and needs a human eyeball (manual steps in the session
report). What WAS verified objectively (no visual claim): a standalone port of
`place.ts`'s exact `emit`+wall-clip math confirmed EVERY prop voxel lands in a
FOOTPRINT cell for all 6 furnished types, un-mirrored AND mirrored (0 out-of-
footprint) — so nothing pokes through an exterior wall or into an L-notch;
rotations are covered by the rigid-rotation argument (moduleMesh rotates the
props group and `rotatedCells` by the same angle). Props build with zero console
errors; kitchen untouched; `tsc`/build clean.

---

### 2m. Elastic rooms — derived expansion (`core/expansion.ts`)

**The class split (decided):** rooms are FIXED (bathroom S/L, kitchen,
circulation, outdoor, stair — what is placed is what exists; the serviced/
structural spaces) or ELASTIC (living, bedroom S/L, recreation — the placed
rectangle is a SEED, a minimum claim; the effective footprint DERIVES from it,
growing to absorb enclosed empty space between placed rooms). Class is a
function of TYPE — `isElastic(def)` in modules.ts, the `ctx.is.*` idiom —
never stored per instance.

**The algorithm** (`computeExpansion(floor) → Map<instanceId, Cell[]>`, pure,
strictly per-floor):
1. Hard cells = ALL grid occupancy (seeds, fixed rooms, stairs, furniture) +
   stairwell-hole cells. Furniture blocks growth but is no space.
2. Outside mask = orthogonal flood fill from the grid border through empty
   cells (the voxelFaces outside-mask idiom). A GAP cell = empty ∧ not
   outside. Empty space touching the outside world stays empty — the flat's
   outer silhouette is wherever the user's rooms ended.
3. Per elastic room, a multi-source BFS INTO the gap (sources: gap cells
   orthogonally adjacent to the room, distance 1; growth only through gap
   cells). Each gap cell is claimed by the NEAREST room; ties break by
   ascending numeric instance id ("m3" < "m12"); gap cells enumerate
   row-major and claimed cells append after seed cells in that order — same
   layout ⇒ BYTE-IDENTICAL result, incl. across save→load (verified).
   A gap with no adjacent elastic room stays empty.
Result: every non-furniture instance id → effective ABSOLUTE cells (fixed =
seed pass-through). Stored transiently on `Floor.effectiveCells` (+ a
cell→owner index behind `Floor.effectiveOwnerAt`) by
`FloorManager.recomputeExpansion()` — in `syncStairsAndHoles` AFTER holes,
BEFORE `pruneStaleDoors` and the shell rebuild, and in `refreshWalls`. Never
serialized; save/load/undo see seeds only (snapshot purity verified).

**The cutover — everything downstream reads EFFECTIVE footprints:**
`buildSpaceTargets` (⇒ doors, door ghost validity, graph access edges,
windows' occupied set, `hasExteriorEdge`, bridge-export envelope),
`buildFloorNodes` room nodes (⇒ rules, depth, diagram, entrance hosting/E2
re-validation), `rebuildAllShells` (walls + SLAB rebuild on effective local
cells via `rebuildRoomWalls`'s `cellsOverride`; windows computed on effective
cells so a grown room's glazing target grows with its area — W1 reads the
effective area), `doorWallSets` (door cuts resolve via `effectiveOwnerAt`),
`EntranceController` (claimed cells are inside; grown boundaries host
entrances), the unit exporter's per-room window re-run, and the selection
readout (effective bbox, "(seed w×d)" noted when grown). Selection/hover/
picking follow automatically — the room MESH is the effective shape. Props
build inside the SEED rectangle only (v1 — furniture does not spread).
A door authored on an expanded boundary auto-removes (existing stale-door
prune, same mutation/snapshot) when a re-flow moves the boundary — accepted
v1 behaviour, verified.

**Two-tier occupancy (the interaction contract):** placement collision reads
the RAW GRID ONLY — hard cells (fixed rooms, elastic SEEDS, furniture, stair
holes) block exactly as before; CLAIMED cells are soft: they are simply not
in the grid map, so placing/moving/duplicating/importing OVER them is valid
through every path by construction (ghost tints valid, drop succeeds), and
the expansion recedes on the next derive pass. "What space is here" lookups
use `effectiveOwnerAt`; "can I put a seed here" stays `Grid.canPlace`.

**Visual legibility:** claimed cells render as part of their room (same
colour, same shell — walls AND floor slab rebuild on the effective shape).
The "Seeds" toggle (view-controls, beside Cutaway; pure view state, never
serialized) outlines each elastic room's transformed seed rectangle with a
thin dark line (`Floor.seedOutlines`, rebuilt with the wall pass).

**Parked decisions (v1 — recorded, deliberately NOT implemented pending a
design review of real results):** shape constraints and growth limits (free
shape, no cap); "leftover gap becomes circulation" (an unclaimable gap stays
empty); furniture spreading into claimed cells; door-aware prop placement.

### 2n. Visual batch — structure x-ray, railings, dissolved connector walls

Four VISUAL-ONLY features (A1–A4). No rule, graph, door, entrance, export or
serialization behaviour changed — proven, not assumed: the rules report,
depths, graph nodes/edges, window stats, door validity, the bridge-export file
and the project JSON are **byte-identical** before and after the batch on the
same fixture (3997 B both, captured by running the same script against the
pre-batch tree via `git stash`).

**A1 — "Structure" toggle** (`#structure-toggle`, beside Cutaway/Seeds; view
state, never serialized). **Reworked in run 0013 — see §2p for what it does
now.** The original A1 was an ELASTIC X-RAY: it hid the wall and glazing meshes
of instances passing `isElastic`, which is Living Room, Bedroom (both sizes)
and Recreation Room, and touched nothing else. Circulation and Outdoor walls
kept standing, because cluster walls are built once per merged component into
`floor.clusterGroup` and were never in that loop; every stripped room kept its
own colour; and the Kitchen, which is neither elastic nor special-cased, was
stripped like a bedroom. That is recorded here rather than deleted because the
mechanism it introduced survives unchanged: hidden meshes carry
`userData.structureHidden`, `cutaway.ts` honours it in BOTH branches (hidden is
hidden, the cutaway simply has less to hide), `applyStructureView()` re-runs at
the end of every `rebuildAllShells` so a rebuild while toggled cannot resurrect
a wall, and clicking a hidden room's slab still selects it.

**A2 — Outdoor railings.** An Outdoor cluster's EXTERIOR edges (nothing
occupies the neighbour cell) build at `RAILING_H` = `SILL_H` = 900 mm instead
of full height — same thickness, same material, same boundary pass. Rail
geometry merges into its own meshes carrying **no `wallNormal`**, and the
cutaway only ever flips `wallNormal`-tagged meshes, so railings are never
hidden: a balcony reads as a balcony from every angle while the full walls
behind it cut away normally. Circulation clusters get NO railings — a
free-standing corridor edge stays a solid full-height wall.

**A3/A4 — connector walls dissolve where they touch (ONE-SIDED).** A cluster
drops its own boundary segment where it faces something it should read as open
to; **the room ALWAYS keeps all of its own walls**. So the former doubled
back-to-back wall (room 0.1 + cluster 0.1) becomes the room's single wall face,
and the connector reads as borrowing it rather than adding its own.
- Outdoor dissolves against rooms and circulation.
- Circulation dissolves against rooms, stairs and outdoor; against open air it
  keeps a full wall.
- The stair side needs nothing — a stair renders stepped geometry and never had
  a shell wall.
Per-edge, not per-run: a run half against a room and half free dissolves only
the touching cells. Elastic rooms are matched on their EFFECTIVE footprint.

**Corner ownership, generalised** (`buildBoundaryWalls`, serves A2+A3+A4): the
TALLER of two perpendicular segments owns the corner square; the shorter is
trimmed. Equal heights reproduce the original convention exactly (N/S owns, E/W
trimmed), so ordinary walls are bit-identical. A dissolved edge has height 0 and
owns nothing, so its partner runs full length across the corner (no notch,
nothing to overlap ⇒ no z-fighting); a 900 mm rail meeting a full wall gives the
corner up (trimming the tall wall instead would leave an open notch above the
rail). Implemented via one `BoundaryWallOpts` arg (`skip`, `rails`,
`railHeight`).

Windows are unaffected by construction (connector-facing edges are interior, so
none is ever generated there). A door authored on a dissolved boundary stays
valid, its marker renders, and the door-cut logic tolerates the missing segment.

**Outdoor↔stair keeps a full wall on purpose.** A stair renders stepped
geometry and never had a shell wall, so there was never a doubled wall to
remove there — and a balcony against a stair core should read as walled, not
open. (Circulation↔stair DOES dissolve: that is a corridor meeting the stair it
serves.)

**WHAT A3/A4 ACTUALLY DID (corrected).** An earlier draft of this note claimed
the tool "shows an opening that the rules treat as sealed". That has been untrue
since `b55e7c4`: the dissolve is ONE-SIDED, rooms keep every wall, and all that
disappears is the connector's redundant second leaf — de-doubling, not opening.
Nothing looked open, so nothing was out of step with the rules.

**The semantics question is now CLOSED for room↔outdoor.** The semi-exterior
pass (§2o) makes that boundary a french window: real glazing (D1/D2/W1/OR1) and
real access (a doorless ACCESS edge). Room↔circulation is deliberately NOT
generalised — an interior boundary still needs an authored door.

### 2o. Semi-exterior edges — the balcony boundary is a french window

**The concept.** Where a room and an Outdoor cluster share a boundary, that
boundary is not a solid wall: it is glazed from the floor to the door head and
solid above, and **the glass IS the door** — you walk through it onto the
balcony. Everything else follows from that one physical fact: the room has real
daylight there (D1/D2 satisfied, area counts toward W1, orientation feeds OR1)
and real access to the balcony (an ACCESS edge with no authored door). Owner:
`core/semiExterior.ts`; derived every rebuild, never stored.

An EDGE is what `exteriorEdges.ts` already means — one cell plus one of its four
sides, 0.6 m. A room edge is semi-exterior iff the cell across it belongs to a
QUALIFYING Outdoor cluster, so a run half against a balcony and half against a
bedroom is half french window, half solid wall.

**Qualification (A1).** A cluster confers nothing unless IT reaches the outside:
some cluster edge must face a cell that is empty and border-reachable (or out of
bounds). A courtyard sealed inside the flat has no sky. The flood fill is the
one in `expansion.ts` (`borderReachableEmpty`, extracted and shared — never a
second implementation), fed the RULES' notion of occupancy (`buildSpaceTargets`
keys: rooms + clusters + stairs + hole projections). Furniture is deliberately
transparent — a 0.6 m cube parked at a balcony edge takes away no sky.
*Finding:* the "item-1 fix" the W1 comment refers to only adds stair-hole
projections to that occupied set; it does NOT do border-reachability, so there
was no existing mechanism to reuse — hence the extraction.

**BATHROOMS ARE EXCLUDED (follow-up).** A bathroom keeps a solid wall against
outdoor space — privacy. The exclusion is one `continue` at the TOP of
`computeSemiExterior`'s rooms loop, via the def-level type predicate
`isBathroom` (modules.ts, sharing `BATHROOM_TYPES` with rules.ts's
`ctx.is.bathroom` so the two views can't drift). Placing it at the source is
what makes every consequence fall out in the right direction, with no second
special case anywhere: no glass, no daylight credit, no doorless access; a
balcony whose ONLY contact is a bathroom is unreachable, so OD1 fires; and
because the door-authoring block reads `plan.boundary` — built inside that same
loop, after the exclusion — a NEW bathroom↔terrace door is AUTHORABLE again
(there is no french window there to make it redundant), while an old file's door
survives untouched via `isDoorValid`. Kitchens deliberately KEEP theirs: D2
wants the ventilation.

**Geometry (A2).** On a semi-exterior edge the room's wall builds as glass from
0 to `DOOR_OPENING_H` (2100 mm, the constant — not a literal) and solid above,
via a third `WindowVariant`, `"french"`. It is the door opening's inverse: the
glazed height is fixed and the panel above grows on taller floors. The Outdoor
side still builds nothing (§2n's one-sided rule is unchanged).

**Band selection.** Semi-exterior edges group into maximal contiguous straight
runs (a run that turns a corner is two runs — corner-wrap is PARKED). For a run
of `n` cells the glazed width is `w = max(2, min(round(0.75n), n − 2))`, and
`w > n` (only n = 1) means no window at all:

| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | ≥8 |
|---|---|---|---|---|---|---|---|---|----|
| w | — | 2 | 2 | 2 | 3 | 4 | 5 | 6 | round(0.75n) |

So the one-cell returns cap the band below 75% for runs of 4–7 cells; the 75%
target only governs from 8 cells (4.8 m) up. Rounding is ROUND-HALF-UP
(`Math.round`) — n = 2 and n = 6 depend on it; do not "tidy" it to a floor. The
2-cell minimum is 1.2 m — the SIA 500 accessible width this codebase already
uses and exactly the door preset's 1200 mm — so **the smallest french window is
precisely one door wide**; that is the justification, not a coincidence. The
band is centred (`Math.floor((n − w) / 2)` solid cells lead, walking the run
ascending cx then cz), so an odd remainder puts the extra solid cell at the far
end. Verified identical in all 4 rotations × mirrored.

**Exterior status (A3).** `GraphNode.hasExteriorEdge` — D1's and D2's hinge, and
W1's gate — is now `hasTrueExteriorEdge || hasSemiExteriorEdge`, the two halves
kept separate on the node because the bridge export classifies only true
exterior edges and a future daylight-discount rule will want the distinction.
ONLY GLAZED cells count: a 1-cell contact confers nothing, so a room touching a
balcony at one cell and nothing else still fails D1 — 0.6 m holds no window.
French edges are placed by construction BEFORE the band generator, which can
never double-band them (their neighbour cell is occupied, so `exteriorEdges`
never offered them) and whose target is reduced by the french area first, so W1
scores the room's real glazing. Entrances stay blocked on these edges (E2 agrees
by construction — the balcony cell is occupied).

**Access (A4).** A room and a qualifying cluster sharing a glazed run get an
ACCESS edge (`viaDoor: true, viaFrench: true`) with no authored door. No glass ⇒
no access. Room↔circulation is unchanged (authored door required). **Outdoor
clusters are LEAVES for routing**: reachable, never a through-route between two
interior rooms — enforced in `reachableFrom` and `accessDepths` (seeds still
expand, so an entrance on a terrace can't isolate the dwelling). Verified: a
fixture's interior depths, escape depths, circulation fraction and G1 are
byte-identical pre/post pass. Doors already authored on a room↔outdoor boundary
stay valid and keep rendering; NEW ones are blocked with a hint
(`isDoorAuthorable`, distinct from the untouched `isDoorValid`).

**OD1 (A5, HARD).** An Outdoor cluster not reachable from an entrance. With A4
that means it touches no room along a glazeable run, or only rooms that are
themselves unreachable. O1 (soft) is now gated to the no-entrance case so the
two never double-flag the same node.

**S1 counts AUTHORED doors only (follow-up).** `RuleContext` gained
`doorDegree` — the same adjacency as `degree` minus the `viaFrench` links — and
**S1 is the only rule that reads it**. A continuous balcony band glazed to three
rooms is a normal typology and stays quiet; three real doors onto one balcony
still flags. Everyone else keeps `degree`, where a french window IS a connection
— that is the point of O1's gate comment: a balcony with only a french window is
connected, not orphaned.

**Export/wall-pass agreement (follow-up).** `unitExport` re-runs `computeWindows`
to classify `glazed` edges, and must pass the room's french set for the same
reason the wall pass does: french glass counts against the daylight target, so
the band added on top is smaller for a room opening onto a balcony. Without it
the export listed a band that was never built — on the control fixture, two
`glazed` edges that are really `blank`. Fixed; the export is now a re-run of the
identical inputs, not a parallel derivation.

**`cellKinds` (A6).** The bridge export gains an OPTIONAL array parallel to
`storeys[].cells` (`"room" | "outdoor" | "circulation" | "stair"`), so the
building can show a balcony as a recess. Absent ⇒ all `"room"` = today's
behaviour, so the format stays **version 1** (see docs/bridge-format.md).
Semi-exterior edges are interior to the unit and do NOT appear in the envelope;
a balcony's own outer edges still export as `open`.

**SEALED VOIDS ARE NOT EXTERIOR — behaviour change, 2026-07-25 (follow-up).**
An edge faces the exterior iff the cell across it is empty AND border-reachable,
or out of bounds. An edge facing a pocket the plan walls in on every side is
plain interior wall: no D1/D2 credit, no window onto a sightless shaft, no
entrance placeable there, and the pocket's edges are absent from the bridge
export's envelope entirely (not `"blank"` — there is nothing there).

*Routing:* ONE change at the shared utility. `exteriorEdges` took a third,
**required** `isOutside` parameter, so tsc enumerated every consumer and none can
keep the old semantics by omission — windows, D1/D2 + W1's gate (via
`hasTrueExteriorEdge`), entrance validity/E2, and the export envelope now agree
by construction. All four pass `Floor.isOutside`, which reads the plan
`computeSemiExterior` already produced, so the border flood fill still runs
exactly ONCE per floor per derive pass (expansion's is a second, separate fill
under a different emptiness predicate — hard occupancy incl. furniture and holes
— and cannot be shared). `EntranceController` refuses a non-outside cell up
front, and `clusterShells`' railing test now reads the same `Floor.isOutside`
(dropping its `?? !ownerId` fallback).

*Deliberate consequence:* an older layout with a fixed-room-sealed pocket newly
FAILS D1/D2 where it used to pass. Decided, not an accident.

*Which rooms this can actually reach:* every habitable room type is elastic, and
expansion absorbs any empty gap adjacent to an elastic seed — so a habitable room
can only face a surviving sealed void when the pocket is blocked from absorption,
i.e. it holds FURNITURE (hard for expansion, transparent for the exterior test).
The general case is a void sealed by fixed rooms/clusters, which D2 (kitchen) and
the window/entrance/export consumers see. Both are covered in the harness. If the
parked elastic growth LIMIT (§7) ever lands, plain D1 cases return.

**Parked (deliberately, not oversights):** corner-wrap for french bands; a
daylight discount for balcony depth; the Laubengang case (a balcony that
genuinely connects two rooms) — outdoor stays a routing leaf until then; and
whether a buried balcony should cost what buried glazing costs in the building
packer's fitness (see BRIDGE.md).

### 2p. Entrance leaf, the fixed-layer Structure view, and readable plans (run 0013)

Three visual changes and one dev-side capability, none of which touches a model,
a rule, the project JSON or the `dwelling-unit` export. Export byte-identity was
measured rather than assumed: `buildUnitExport` over
`testflats/flat-1-two-storey.json` serializes to 22933 characters both before
and after, with the same rolling hash 585028207, captured by running the same
snippet against the pre-change tree through `git stash`.

**The entrance marker is a door leaf** (`src/scene/entranceView.ts`). It used to
be a 0.44 x 1.30 x 0.16 slab with a single outline child. It is now a leaf
1.10 x 2.10 x 0.16, which is two cells minus a 0.1 inset at `DOOR_OPENING_H`,
carrying four children: the outline, a magenta threshold strip on the floor, and
two `ENTRY` label plates facing opposite ways. The height and the threshold come
from `doorView.ts` on purpose, so the front door reads in the same drawing
language as every interior door and at the same 1200 mm width, distinguished
only by its own magenta.

THE SECOND CELL IS DERIVED, NOT STORED. `Entrance` is still one cell plus one
side, which is what E2 checks and what the project file holds, so no saved
project became invalid. `entranceSpan(cell, side, canWiden)` picks the second
cell at draw time: it prefers the neighbour further along the wall's run, which
is east on a north- or south-facing wall and south on an east- or west-facing
one, matching the run direction `core/door.ts` already uses for a door's second
edge; failing that it tries the other side; failing both it stays one cell wide,
which is the old drawing and is always legal. `Floor.canWidenEntrance` is the
test, and it requires two things: the neighbour is the same space, or another
module of the same connector cluster, since a corridor is several instances
merged; and the neighbour's own edge on that side faces open sky by
`Floor.isOutside`. Without the first a leaf could straddle two rooms while the
graph roots reachability in one node, and without the second its far half would
sit in a party wall. Because the span is derived, `Floor.refreshEntranceMarkers`
runs inside `rebuildAllShells`, so a room placed beside an entrance narrows the
leaf on the next pass. `EntranceView` now remembers `selectedId` across a
rebuild, the way it already remembered `dimmed`. Measured on flat-1: the
entrance at `13,5,north` derives a two-cell span over cells 13 and 14 and sits
at world x 0.9, z −4.5.

**The Structure view is the FIXED LAYER, not an x-ray** (`floorManager.ts`,
`setStructureView`). Bathrooms, kitchens and stairs render exactly as built,
walls and furniture included; every other space, dry rooms and circulation and
outdoor alike, drops to a bare `STRUCTURE_PLATE` (0xc9c5bb) with no walls and no
furniture. The filter is FIXEDNESS (`isFixedLayer` = `category === "stair"` or
`isWet`) rather than elasticity, which is why the Kitchen now survives whole.
Cluster walls are stripped through `floor.clusterGroup` because that is where
they live; the cluster instances keep their floor tiles, so a corridor reads as
bare plate rather than vanishing. Furniture modules (`category === "module"`)
are left alone, being neither a space nor its contents. Mesh visibility is
enough here where it was not enough for the interface view, because this removes
a stripped space's walls WHOLE and never has to split one merged mesh into
facade and partition.

**Structure and Interface are MUTUALLY EXCLUSIVE**, enforced in the manager
(each setter turns the other off) and reflected by `syncViewToggles` in
`main.ts`, which re-reads `floors.structureViewOn` / `floors.interfaceViewOn`
rather than tracking the pair itself. The reason is mechanical before it is
conceptual: both express a stripped room through `material.userData.baseColor`,
so a shared slot with two owners means one view's exit clears the other's tint.
Conceptually the overlap also answers nothing, since one view asks what the
building fixes and the other asks what the unit contract binds.

**Plans compose lawfully.** TOP VIEW with the Interface view gives a plan of the
contract, TOP VIEW with the Structure view gives a plan of the fixed layer, and
nothing refuses. One asymmetry is by design and worth knowing: the interface
plan has NO door-swing arcs, because that view hides interior doors entirely
(`DoorView.setVisible`), and an interior door is exactly what it drops. The
entrance still reads in all three plans, through the new threshold strip; the
leaf and the labels are in the wall plane and go edge-on from directly above.
Switching the active floor while in plan mode requires `applyPlanVisibility()`
alongside `setActive`, since plan visibility is computed from the active index;
`main.ts:254` does this on the floor-tab path, and any other caller must too.

**Dev-only capture path.** `vite.config.ts` gains a `capture-sink` plugin under
`apply: "serve"`: POST a data URL to `/__capture?name=…` and it writes under
`captures/`. `main.ts`'s `import.meta.env.DEV` block, which already held the
`?project=` loader, now also exposes `window.__app` with the floors, camera,
scene, controls, renderer, the plan-mode entry points, and `capture(name)`,
which renders one frame and posts the canvas. The render and the read have to
share a turn because the context is created without `preserveDrawingBuffer`.
Both are dropped from a production build. This exists because four consecutive
runs deferred visual work for want of a way to check it: `?project=` made
fixtures scriptable, and this makes their RESULT scriptable, so a span width or
a toggle state is a number rather than a picture someone has to squint at.

### 2q. Orientation preference and the export glazing gap (run 0014)

**THE PREFERENCE.** A project may state one orientation it would like habitable
rooms to face and one it would rather they did not, both optional and
independent, because a brief usually gives one or the other and an absent half
has to mean "no opinion" rather than a default that quietly becomes a rule. The
type is `OrientationPreference` in `src/core/orientation.ts`, using the same
8-wind `CompassSector` the derived glazing already reports in, so a preference
and a room's actual glazing are compared in one vocabulary.

It is DESIGN state: serialized in the project file beside `northAngle`
(`projectIO.ts`, `normalizePreference` drops anything that is not one of the
eight sectors rather than defaulting it), restored in
`FloorManager.loadProject`, and carried through undo because history snapshots
are serialized projects. Unlike north it DERIVES NOTHING, so it is a plain field
with no setter and no rebuild; the sidebar callback stores it, drops the stale
report and commits history.

`OR2` (soft) is the only consumer. It reports a habitable room or kitchen whose
glazing faces ONLY the avoided sector. Only, not partly: a room glazed S + N
still gets its southern sun, so flagging it would report a miss nobody feels,
and a room with no glazing at all belongs to D1 and W1. `prefer` is stored and
shown but drives no rule, because "does not face the preferred way" is true of
most rooms in most layouts and would flood the report. OR2 overlaps OR1 exactly
when `avoid` is "N" and both lines then appear, which is intended: OR1 says the
room gets no direct sun at this latitude whoever designed it, OR2 says it breaks
a rule this project set itself.

The UI is a two-select panel in the LEFT SIDEBAR (`ui/palette.ts`,
`buildOrientationPanel`), not beside the compass dial. The dial is a viewport
overlay for a value that moves geometry and wants to sit next to the model it
turns; a preference moves nothing and belongs with the project's other settings.

Measured on `testflats/flat-1-two-storey.json`: with no preference the panel
reads `12 issues (1 hard, 11 soft)`, unchanged. With avoid set to N it reads
`14 issues (1 hard, 13 soft)`, the two added lines being OR2 on Living Room (F0)
and Bedroom — Small (F1), which are exactly the two rooms OR1 already names as
north-lit.

**THE EXPORT GLAZING GAP — A KNOWN DEFECT, NOT YET FIXED.** French-window edges
are BUILT but never EXPORTED. `unitExport.ts:311` enumerates the envelope with
`exteriorEdges(cells, occupied, floor.isOutside)`, the strict open-sky test,
which skips any edge whose neighbour cell is occupied (`exteriorEdges.ts:131`).
A balcony cell is occupied, so a room-to-balcony or corridor-to-balcony edge
never enters the edge list, and the `glazed` class that `glazedKeys` correctly
holds for it at `unitExport.ts:297` has nowhere to land. Run 0011 fixed the KEY
SET and left the ENUMERATION on the strict test, so f2af130's bug survived in its
other half.

Measured on `flat-1-two-storey.json`: storey 0 builds 0 french edges and exports
10 glazed of 64, which is consistent because floor 0 has no balcony; storey 1
builds 9 french edges and exports 2 glazed of 68, so the building packer is told
about 2 of the 11 glazed edges that exist. Measured on a minimal layout of one
living room directly against a balcony: 3 french edges built, 0 glazed exported
of 26 edges total.

It is left unfixed on purpose. The repair changes what the bridge file CONTAINS,
which the other repo consumes, so it is a deliberate decision rather than an
overnight edit. It is recorded as an `it.fails` case in
`src/core/unitExport.slow.test.ts`, which keeps the suite green and turns red the
moment someone repairs the export; the fix is then to delete the `.fails`.

### 2r. The drag-to-place gesture (run 0015, handoff Part 1)

Part 1 of the Claude Design handoff, implemented in the app's own environment:
plain TypeScript, the existing `GhostPreview` mesh, `src/style.css`. The
prototype's CSS-3D technique was deliberately not ported; what was taken is the
choreography and the values. Part 2, the chrome reorganisation, is untouched.

**THE COMMIT GATE, a bug fix that shipped first.** `dragDrop.onUp` used to call
`store.place` for whatever cell was under the pointer without re-asking whether
the module fitted, so a ghost showing red still placed. Nothing corrupt was ever
written, because `store.place` refuses an overlap on its own and returned null,
but the gesture lied about what a release would do. `onUp` now runs
`store.canPlaceInstance` for the release cell and bails when it is false
(`dragDrop.ts`). It re-asks rather than trusting the last move's answer, because
a release can land on a cell no move event reported: a click without motion
never fires `pointermove`, and the pointer can leave and re-enter the canvas
between the last move and the release. Measured on flat-1: a release over an
occupied cell leaves the store at 24 instances, and a release over a free one
takes it to 25.

**THE GHOST TWEENS BETWEEN CELLS.** It still snaps to whole cells; what changed
is that `update` now sets a target and `GhostPreview.tick(dt)` eases the group
toward it over `--dur-tap` (150 ms), called once per frame from `main.animate`.
Before this the position was assigned outright and a drag across the plate read
as a jitter of discrete jumps. The first cell of a gesture lands outright rather
than sliding in from wherever the last gesture ended.

**VALIDITY COLOURS.** Green was retired because it competed with the balcony
green. Valid is now the module's own colour pulled a tenth toward `--ink` at
0.55 opacity; invalid is `--accent` #d2232e at 0.45. The design specified 0.20
for the invalid fill, which is an alpha chosen over paper and disappears against
a lit 3D scene, so it is 0.45 here. The design also specified 2px edges, which
WebGL cannot draw: `LineBasicMaterial.linewidth` is ignored by every browser and
always renders 1px, so only the edge COLOUR carries the state.

KNOWN COLLISION, unresolved: the Living Room's own colour is #d32f2f, so its
valid ghost renders #c92d2d against an invalid #d2232e. Those are the same red.
Every other room type reads clearly; the living room, which is the most-placed
one, does not. See the run 0015 report's open questions.

**THE DROP SETTLE.** A committed module enters 0.55 world units above its
resting Y at opacity 0.2 and lands over `--dur-panel` (260 ms), driven by
`settleDrop` plus `tickGhostAnimations(dt)` in `scene/ghostPreview.ts`. The
settle list is module-level rather than a field on the ghost, because a settle
outlives the ghost that caused it: the ghost clears the instant the placement
commits and the module keeps falling for 260 ms. On arrival the materials are
restored to opaque and non-transparent exactly, so a settled module sorts
against the cutaway like its neighbours.

**GRID EMPHASIS.** The active floor's dots move from their resting #b0a99c
toward #141317 over `--dur-panel` while a placement is live and back on release
(`GridView.setEmphasis` / `tick`). It is a colour ramp rather than an opacity
ramp because the dots are opaque on purpose, and fading them in would
reintroduce the depth-sort artifacts `setDimmed` already avoids. Only the active
floor lights: emphasising the others would say a drop could land there.

**THE CHROME.** `ui/dragChrome.ts` owns the cursor chip and the validity label.
The chip is a miniature of the palette tile (20px swatch, name, `w×d`), tilted
-1.5deg with a 3px hard shadow, following the pointer for the WHOLE gesture
including over the canvas. The label sits at the viewport's top left and reads
`Living Room · 7×5 · CELL 0,0` when valid and `BLOCKED — OVERLAPS A PLACED ROOM`
when not, its background following the ghost's edge colour. It has a THIRD state
the design does not name: it is hidden while there is no cell at all, between
pressing a tile and reaching the canvas, because claiming an overlap there would
be false.

`dragDrop.ts` owns no DOM. It emits a `DragGestureState` on start, on every
move, on rotate and mirror, and once with null at the end; `main.ts` decides
what that looks like. The source tile is dimmed to 0.35 through an
`is-drag-source` class re-applied on every emitted state, so a sidebar re-render
mid-gesture repairs itself on the next pointer move.

**TOKENS.** `src/style.css` gained `--ink`, `--bg`, `--meta`, `--dur-tap`,
`--dur-panel`, `--dur-hero`, `--ease-out` and `--ease-spring`, additively.
`--accent` already existed and moved from #d32f2f to the system's #d2232e, which
is the one value in existing chrome this run changed. The full token swap is
Part 2.

Unchanged, and verified unchanged: `R` rotate, `M` mirror, Escape arbitration in
`main.ts`, `controls.enabled = false` while placing, the export, the rules, and
both canonical panels.

### 2s. Paper studio reskin (runs 0016 and 0017)

Part 2 of the Claude Design handoff, direction 1a, complete as of run 0017. It was
built on a branch called `reskin-1a` so it could be judged before it was adopted,
and Shrey merged that branch into `main` on 31 July and pushed it, so this section
now describes the only version of the app there is. The branch was deleted after
the merge; every commit it carried is in `main`'s history.

**TOKENS AND THE PALETTE.** `src/style.css` gains the design system by its own
names (`--bg --ink --panel --panel-ink --line-paper --line-dark --meta --plate
--plate2 --tint --accent --entry --violet --soft --note`, plus the three
durations and two easings) and REPOINTS the old Bauhaus names at the new values
rather than rewriting the roughly 140 declarations that read them. `--black` was
the dark panel fill and is now the paper ground; `--paper` was the light text on
dark and is now ink. New rules use the design names. Anyone adding a rule should
NOT reach for `--black` or `--paper` expecting their old meaning.

The scene background moved from 0xe4e0d6 to 0xe9e5dc in all six files that
carried it as a dim-toward-background constant (`sceneSetup`, `floor`,
`gridView`, `entranceView`, `doorView`, `holeView`). Those must stay in step with
`--canvas-bg` or dimmed floors fade toward a colour the viewport is not.

Room colours moved to the design values in `modules.ts`. This is what fixed the
ghost collision run 0015 measured: Living Room's valid ghost against the invalid
accent went from deltaE 5.4 to 14.7, past the ~10 at which two colours read as
different. It is still the closest pair; kitchen is 70.8, bedroom 95.6, outdoor
96.3.

**THE THREE FURNITURE MODULES ARE GONE.** Single, Domino and L-Triomino were
removed from `MODULE_DEFS`, `MODULE_LIST` was deleted with them, and the README
bullet went too. `Category` still includes `"module"` and the code paths that
branch on it remain, so re-adding a furniture preset needs only a def. No fixture
referenced them.

**TOP BAR.** 52px, in `index.html` above `#app`, which is now a flex column. The
segmented MODEL / PLAN / DIAGRAM control replaces the separate Diagram and Top
View buttons; each cell ENTERS its mode and `syncViewSegments()` in `main.ts`
reads the modes rather than tracking its own state. Check Layout, Frame View, the
Save / Open menu and the `?` sit on the right. The three controls that moved out
of the viewport had their old absolute-position rules replaced by a comment
naming where they went; a future edit must not reinstate `position: absolute` on
them.

**PALETTE.** PLACE / FLOORS / BRIEF, built by `ui/palette.ts`. PLACE has three
groups in two-column grids. The panel is resizable 248 to 480 (default 296)
through `#palette-resize`, a 6px handle on its right hairline; the width is
session state and is never saved. The scroller is `direction: rtl` with `ltr` on
its child, which puts the scrollbar on the left edge. `#sidebar` must stay
`overflow: hidden` or the scroller paints over the viewport.

Palette icons are footprint SILHOUETTES: cells fill with no gap so neighbours
merge, the outline is stroked once around the shape, and interior divisions
appear only above 3.5px per cell. The per-cell gapped rects that preceded this
were legible at 36px and turned to mesh at 20px.

**OVERLAYS.** Three clusters. Selection top-left, undo/redo bottom-left, and one
224px Display card bottom-right, collapsed by default with a summary of what is
on in its header (`syncDisplaySummary()`). The compass row is always visible,
collapsed or not, because north moves glazing and is design state rather than a
view toggle. Both circles live there: the dial is the north that is SET, the
badge is where north points ON SCREEN under the current camera.

The hint line that ran beside undo/redo was removed in run 0017. It was clipped
to an ellipsis at any usable window width, and everything it listed already sat
in the shortcuts panel behind the `?` button. Its one unique sentence became a
caption under the palette's PLACE heading (`palette.ts:63-69`), and the two
bindings the shortcuts panel had been missing, Click to select and Drag to move,
were added there (`index.html:74-75`). `#hint` no longer exists in the DOM or in
`style.css`, and `setDiagramVisible` no longer reaches for it.

**SCROLLBARS.** Themed globally in `style.css` (the `*` rule plus the
`::-webkit-scrollbar` block): paper track, hairline thumb, quiet grey on hover,
squared off, 10px. Every scroller inherits it — the palette, the layout-check
rail and its cards, the shortcuts panel.

**LAYOUT CHECK — THE BOTTOM SHEET (run 0017, stage 2e).** `#validation-panel`
keeps its id and stops being a 300px column pinned top-left. It is now a 256px
sheet spanning the viewport bottom, rendered by `ui/validationPanel.ts`:

- The header (`buildHeader`) holds the title, a 340px block with a proportional
  8px severity bar over the tier counts, one metrics line, and the close control.
  The metrics line carries what used to be three sections at the bottom of a long
  vertical scroll: circulation share with its per-floor rider, depth max/mean, and
  the privacy gradient.
- The bar's fourth segment counts ROOMS THAT APPEAR IN NO VIOLATION
  (`clearRooms`), not the violation total subtracted from the room count. flat-1
  carries 17 violations across 13 rooms, so the subtraction would floor at zero
  exactly where the reference length matters.
- The rail (`buildRail`) is one 300px card per violation, hard then soft then
  note, each with a 3px top border in its severity colour, followed by the two
  informational cards (glazing orientation, depth from entrance) the old panel
  ended with. Repeated rules keep one card each and carry an ordinal on the chip
  (`OR1 (1/2)`), because hover emphasis targets ONE violation's rooms and a merged
  card would have nothing single to point at.
- `ACTION_BY_RULE` (`validationPanel.ts:46`) is a display-only suggested move per
  rule id, covering 35 of the 42 rules (run 0029 added P4's); the seven notes have
  no entry and render
  no action line. It is deliberately NOT in `RULES` — `validate()`'s returned data
  is unchanged and `rules.test.ts` never sees this file.
- `bindWheelToScroll` calls `preventDefault` only while the rail can still move
  in the direction the wheel asks for, so a trackpad falls through to the page at
  either end instead of being trapped.
- Opening runs one `vs-rise` keyframe over `--dur-panel`. Re-running Check Layout
  replaces the sheet's children, never the container, so it does not run again.
- `main.ts` toggles `sheet-open` on `#viewport`; while open `#bottom-left`,
  `#view-controls` and `#graph-legend` move to `bottom: 272px` and
  `#selection-readout` to `312px`. Check Layout both opens and closes the sheet.
  ESCAPE WAS NOT GIVEN A FOURTH MEANING — it already arbitrates drag-abort,
  selection-clear and plan-view exit.

**COPY (run 0017, stage 2f).** The tier words the user reads are `Must fix`,
`Worth a look` and `Note`. The `Severity` union is still `hard | soft | note` and
nothing downstream of `validate()` changed; `SEVERITY_LABEL`
(`validationPanel.ts:35`) is the only place the internal names become English,
which is why `rules.test.ts` stayed green untouched. The same three words were
applied to the diagram legend (`index.html:57-58`), the unit-export confirm
(`main.ts:780`), the README rule table and legend, and the tier chips, index
headings and tier-defining passages of `docs/rules-list.html`,
`docs/rules-list.md` and `docs/rules-reference.html`.

`Circulation` reads as `Hall` IN THE PALETTE ONLY, via `paletteName()`
(`palette.ts:256`). `def.name` is not just a caption: `adjacencyGraph.ts:170` and
`:202` copy it into every graph node's `label` and `unitExport.ts:213` copies it
into the exported unit's `roomTypes`, which is a bridge-format payload another
repository reads. Renaming the preset would change a file format. The report and
the diagram therefore still say Circulation while the palette says Hall.

**DOCS DRIFT, MEASURED.** `docs/rules-list.html` and `docs/rules-list.md`
document 37 of the 42 rules; FAC1, OR2, P4, ST3 and WET1 have no entry, and E1 is
filed as a note where `rules.ts` has it hard. Run 0017 corrected the totals it was
already rewriting (35/36 → 41, and the tier index 11/19/7 → 14/21/6) but left the
per-rule entries alone, because filling them is a docs regeneration rather than a
copy pass.

## 3. Key data structures / formats (written out)

### Cell (`grid.ts`)
```ts
interface Cell { cx: number; cz: number }   // integer grid coords
const CELL_SIZE = 0.6;                       // metres per cell
// gridToWorld: world centre of a cell; grid is centred on world origin.
```

### Room / module / stair definition (`modules.ts`)
```ts
type ModuleType = string;                       // id; rooms/furniture/stairs share one type-space
type Category = "module" | "room" | "stair";

// (ConnectionEdge scaffolding removed — superseded by authored doors, §2i.)

interface ModuleDef {
  type: ModuleType;
  name: string;
  description: string;
  category: Category;
  group?: string;          // UI grouping label, e.g. "Circulation"
  color: number;           // hex int (also used as room-type colour everywhere)
  cells: Cell[];           // footprint relative to origin (0,0) at rotation 0
  height: number;          // in cells: furniture = 1, rooms = ROOM_HEIGHT (4), stair = 1 (nominal — see §2a)
  cluster?: string;        // "circulation" | "outdoor" for connector merging
}
// ROOM_HEIGHT = 4 cells = 2.4 m — the def's OWN nominal height, used as the
// fallback when no floor height is supplied. Built walls actually reach the
// floor's true floor-to-floor height (see §2b), which is >= this.
```
Registry: `MODULE_DEFS`; lists `MODULE_LIST` (furniture), `ROOM_LIST`,
`STAIR_LIST` (currently one entry: the dogleg). Transform (§2g):
`rotateCell((x,z)) -> (-z,x)` (90° CW); `mirrorCell((x,z)) -> (-x,z)`;
`transformCell(c, rot, mirrored)` = **mirror first, then rotate**;
`occupiedCells(def, origin, rotation, mirrored)` = absolute cells.

### Placed instance (`store.ts`)
```ts
interface ModuleInstance {
  id; def: ModuleDef; origin: Cell; rotation: number;
  mirrored: boolean;      // left/right flip, applied BEFORE rotation (§2g)
  group: THREE.Group;
}
// ModuleStore.onChange?: () => void  — fires on place/move/rotate/mirror/remove/reconcile.
// ModuleStore.extraPlacementCheck?: (def, cells) => boolean — set by FloorManager
//   for the stair "plate must be clear on the floor above" rule.
// ModuleStore.mirror(id) — in-place flip about the origin cell, collision-checked.
```

### Entrance (`entrance.ts`, `exteriorEdges.ts`)
```ts
type Side = "north" | "south" | "east" | "west";
interface BoundaryEdge { cx: number; cz: number; side: Side }
function exteriorEdges(cells: Cell[], occupied: Set<string>): BoundaryEdge[];
function edgeKey(cx, cz, side): string;  parseEdgeKey(key): BoundaryEdge;

interface Entrance { id: string; cell: Cell; side: Side }  // floor 0 only
```

### Door (`door.ts`) — authored interior access, see §2i
```ts
interface Door { id: string; cell: Cell; side: Side }  // ANY floor; id = anchor edgeKey
const DOOR_SPAN = 2;            // consecutive edges (fixed at 2 for v1)
const DOOR_OPENING_H = 2.1;     // FIXED opening height; header above grows on taller floors
const BELOW_PREFIX = "^";       // space token: a stair on the floor below (hole projection)
function doorEdges(door): [BoundaryEdge, BoundaryEdge];  // the 2 edges (run +x for N/S, +z for E/W)
function resolveDoorSpaces(door, targetAt): { a; b } | null;   // the one validity+connectivity check
function buildSpaceTargets(floor, floorBelow?): Map<cellKey, token>;  // cell → space token
function doorWallCuts(doors, ownerAt, resolveOwner): { rooms: Map<id,Set<localKey>>; clusters: Set<absKey> };
```

### Windows (`windows.ts`) — derived, see §2d/§2k
```ts
type WindowVariant = "framed" | "full-height";
interface GlazingStat {
  targetRatio: number; achievedRatio: number; belowTarget: boolean; // W1
  sectors: CompassSector[];  // distinct glazing sectors, south-first (report line); [] if no glazing
  northLit: boolean;         // has glazing AND all of it within 45° of north (OR1)
}
interface WindowPlan extends GlazingStat {
  edges: Map<string, WindowVariant>;  // ABSOLUTE windowed edge keys → variant
  variant: WindowVariant | null;
}
function computeWindows(cells, roomTypeId, floorHeight, occupied, entranceEdgeKeys, northAngle=0): WindowPlan;
const WINDOW_CONFIG: Record<roomTypeId, { targetRatio; variant; fixedEdges? }>;
// SILL_H = 0.9, LINTEL_H = 0.9, MIN_WINDOW_EDGES = 2 (all absolute metres/edges).
```

### North / orientation (`orientation.ts`) — see §2k
```ts
const COMPASS_SECTORS = ["N","NE","E","SE","S","SW","W","NW"]; type CompassSector = …;
const NORTH_SECTOR_HALF_WIDTH = 45; // OR1's north arc half-width (degrees)
// Convention: north = world −Z rotated CLOCKWISE (viewed from above) by northAngle.
function normalBearing(nx, nz, northAngle): number;   // outward normal → compass bearing [0,360)
function sideBearing(side, northAngle): number;        // grid Side → bearing
function bearingSector(bearing): CompassSector;        // nearest 8-wind sector
function southDistance(bearing): number;               // [0,180], seed south-bias score
function isNorthLit(bearing): boolean;                 // within NORTH_SECTOR_HALF_WIDTH of north
function sortSectorsBySouth(sectors): CompassSector[]; // most-southern first (report order)
function worldNorthDir(northAngle): { x; z };          // world XZ unit vector of north (arrow)
```

### Whole-dwelling adjacency graph (`adjacencyGraph.ts`)
```ts
interface GraphNode {
  id: string;             // dwelling-unique: `${floor}/${rawId}`
  rawId: string;          // room/stair instance id, or `cluster:<key>:<min-cell>`
  floor: number;
  roomTypeId: string;     // def.type, cluster key ("circulation"/"outdoor"), or "stair"
  label: string;
  color: number;
  kind: "room" | "cluster" | "stair";
  cells: Cell[];          // footprint (absolute, on its floor)
  isEntry?: boolean;      // true when a NON-BLOCKED entrance attaches here
  hasExteriorEdge: boolean;
  glazing?: GlazingStat;  // rooms only, from floor.windowStats (§2d) — W1 consumes it
}
interface GraphEdge {
  a: string; b: string;
  viaDoor: boolean;       // false = physical TOUCH edge; true = authored-door ACCESS edge (§2c/§2i)
  viaStair?: boolean;     // a cross-floor link made by a stair, vs. a same-floor wall touch
}
interface EntranceStatus {
  id: string;              // `${floor}/${entrance.id}`
  floor: number;
  hostId: string | null;
  blocked: boolean;        // re-derived every graph build, see §2c
}
interface DwellingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];      // both TOUCH (viaDoor:false) and ACCESS (viaDoor:true) edges
  entryIds: string[];      // non-blocked entrance host node ids
  entrances: EntranceStatus[];
  floorCount: number;
  doorCount: number;       // total authored doors (drives the DR1 cutover note)
}
```

### Layout rules (`rules.ts`)
```ts
type Severity = "hard" | "soft" | "note";
interface Violation {
  ruleId: string; severity: Severity; description: string;
  nodeIds: string[];             // highlighted in diagram + 3D
  edge?: [string, string];       // edge-based rules
  entranceIds?: string[];        // entrance-marker highlight
  layout?: boolean;              // dwelling-level, not tied to particular nodes
}
interface Rule {
  id: string; severity: Severity; description: string;
  check: (graph: DwellingGraph, ctx: RuleContext) => Violation[];
}
function validate(graph: DwellingGraph): Violation[];
function accessDepths(graph, seeds): Map<string, number>;  // 0-1 BFS w/ stair-hop weighting, seed-parameterized
function computeEntranceDepths(graph): Map<string, number>; // = accessDepths(graph, entryIds); standalone metric, §8
const DEEP_ROOM_THRESHOLD_HOPS = 5;   // DP1: deep-from-entrance ceiling
const ESCAPE_DEPTH_MAX = 4;           // F1: far-from-exit ceiling (entrance+stair seeds)
```
`RuleContext` (built once per `validate()` call, `buildContext()`): node/edge
lookups, `degree()`, `is.{circulation,outdoor,bathroom,bedroom,kitchen,living,
recreation,room,stair,roomOrStair,public,habitable}` type predicates,
`entryIds`, `hasEntrance`, `reachableFrom(seeds, blocked?)` (multi-source BFS,
the reachability primitive every H*/G*/ST* rule uses). **`adj`/`viaStairAdj`/
`degree`/`reachableFrom` traverse ONLY ACCESS (door) edges** (`viaDoor:true`) —
reachability + connectivity are door-based; the proximity rules read TOUCH edges
straight off `graph.edges` via `edgeViolations` (which skips `viaDoor` edges).

### Project file (`projectIO.ts`)
```ts
interface InstanceData { type: string; cx: number; cz: number; rotation: number; mirrored?: boolean }
interface EntranceData { cx: number; cz: number; side: Side }
interface DoorData { cx: number; cz: number; side: Side }   // additive; same shape as EntranceData
interface FloorData { cols; rows; instances: InstanceData[]; entrances: EntranceData[]; doors: DoorData[] }
interface ProjectFile {
  format: string; version: number; floors: FloorData[];
  northAngle?: number;  // ADDITIVE (v1): absent → 0 via normalize; project-level design state (§2k)
}
```
`PROJECT_FORMAT = "flat-configurator-project"`, `APP_PROJECT_VERSION = 1`.
Tolerant/versioned load (`parseProject`); NOT serialized: camera state, active
floor, per-floor visibility, cutaway on/off, dial widget state (all view state —
see §5/§2k) — a load always starts all floors visible at the default axo extent
with cutaway ON. `mirrored` (§2g) and `northAngle` (§2k) are both **additive** v1
fields: absent → `false` / `0` via `normalize`, so pre-feature files load
unchanged — no version bump, no migration step. (`northAngle` IS design state,
unlike the view-state exclusions above — it moves the derived windows, so it
serializes and is undoable.)

**Preset-footprint drift (batch ①):** files reference room types by NAME, so a
save made under the old L-presets loads with the CURRENT rectangular footprints
— which can collide where the old L-notches let rooms interlock, or run out of
bounds. `FloorManager.loadProject` returns `{ skipped }` (instances the normal
`store.place` path refused); the import UI surfaces it as a cause-neutral warn
toast ("N room(s) could not be placed.") — tolerant drop, never silent, never
auto-repositioned. Undo/redo snapshots are same-session and can never skip.

### Voxel prop JSON format (`voxelProp.ts`, `data/*.json`)
```jsonc
{
  "format": "voxel-prop",
  "version": 1,
  "name": "counter_run",        // reliable id (counter_run, overhead_cabinet, stove, sink, fridge)
  "size": [width, height, depth],
  "voxels": [ { "x": -12, "y": 0, "z": -5, "color": "#6e4a2a" }, ... ]
}
```
- Integers in **5 cm units**; **12 voxels = one 0.6 m cell** (`VOXELS_PER_CELL = 12`, `VOXEL_SIZE = 0.05`).
- Integer = voxel **min corner** (occupies `[c, c+1]`).
- **x, z centred on 0**; **y floor-anchored** (y=0 ground, up positive). High-y is baked in (overhead cabinet y≈30–41).
- Parsed to `VoxelProp { name, size, voxels:[{x,y,z,color:number}], maxZ }`; library `PROP_LIBRARY: Record<name, VoxelProp>`.

---

## 4. Conventions & decisions

**Dev-only project loader (`?project=`, run 0010).** `src/main.ts` reads a `?project=`
query parameter behind `if (import.meta.env.DEV)`, fetches the named file (a bare name
resolves against `/testflats/`) and hands it to `readAndImport`, the SAME function the
Import button calls, so parsing, the confirm, error handling and history are identical
and only file acquisition differs. Vite replaces `import.meta.env.DEV` with `false` in a
production build and tree-shakes the block; verified by grepping the built bundle for
`project=`, which returns 0.

It exists because run 0009 established that NO injection route can feed the Import
button from a script, which cost that run three tasks. The reason turned out to be
`importProjectText`'s unconditional `window.confirm`. That confirm now only fires when
there is something to lose: `isEmptyProject()` (one floor, no instances, no doors, no
entrances) skips it. That is a change to the shared path, not a loader bypass, so the
button behaves the same way when importing into a freshly opened app.

**Violation label disambiguation (run 0010).** `src/ui/validationPanel.ts` has one
`makeLabeller(graph)` used by all three places that render a node name. A label keeps its
plain form when unique, gains `(F<n>)` when the dwelling is multi-floor, and gains the
footprint's anchor cell ONLY when that still collides: `Bathroom — Small (F0, 8,14)`.
Two rooms of the same type on one floor previously rendered identically, so a report
could name two different rooms with the same string.

**Testing.** `vitest` is a devDependency. THREE files and TWO suites as of run 0014.

`npm test` runs `vitest run` over everything except `*.slow.test.ts`, which
`vite.config.ts`'s `test.exclude` hides from it: 33 cases in about 2 s. It holds
`src/core/exteriorEdges.test.ts` (five cases over `isFacadeEdge`),
`src/core/unitExport.test.ts` (three pure cases over the export glazing
invariant) and `src/core/rules.test.ts` (25 cases, a firing and a silent fixture
for each of E1, E2, H1, C1, OD1, A1, N1, DP1, WET1, FAC1 and ST3). The rules pack
builds `DwellingGraph` objects BY HAND, which is what makes it fast: `validate`
consumes plain data, so rule logic is testable without three.js. Read its header
for what that does not prove, which is that the app ever builds such a graph.

`npm run test:slow` runs `vitest run --config vitest.slow.config.ts` over
`*.slow.test.ts` only: 4 passing and 1 expected-fail in about 5.5 s. It holds
`src/core/unitExport.slow.test.ts`, which drives a real `FloorManager` through a
stubbed `FloorDeps` and calls the real `buildUnitExport`. The split exists
because that import graph pulls in the whole render layer, measured at 11.94 s
against 1.65 s for the pure tests, and the fast suite is the one people run on
every change. The split is written in exactly two places: the `exclude` line in
`vite.config.ts` and the `include` line in `vitest.slow.config.ts`.

NOTE, from run 0014: `scene/entranceView.ts`'s `entryLabel()` returns null where
there is no DOM, so `Floor.addEntrance` works headlessly and the marker simply
builds without its label. Before that guard, run 0013's canvas-texture label made
placing an entrance throw `ReferenceError: document is not defined` outside a
browser, which blocked the slow test entirely.

`src/core/unitExport.test.ts` (run 0013, three cases) is about the export glazing
invariant, which is that the glazed edge set a unit EXPORTS equals the set the wall
pass BUILDS. It broke once at f2af130, when corridors gained french windows and
`unitExport.ts` still carried a rooms-only filter. Read its header before trusting it:
it does NOT call `buildUnitExport`, so it cannot fail on a regression there. That was
tried and measured rather than assumed. The import graph loads and a layout places
fine; the run stops at `floorManager.ts:764`, where `recomputeStack` reads
`this.deps.groundPlane` before `attach()` has been called, and stubbing `FloorDeps` is
about a dozen lines. The reason it was refused is the import cost: 11.94 s for the
probe against 1.65 s for the pure tests, so the whole render layer would enter a suite
about edge keys for a tenfold slowdown. What the file does pin is that a corridor
beside a balcony glazes at all, that its band is disjoint from the room's, and that a
rooms-only filter drops exactly three named edges on that layout, which turns f2af130's
cost into a number.

`src/core/exteriorEdges.test.ts` covers `isFacadeEdge` with five cases (open sky, open
adjacent balcony, sealed empty pocket, sealed courtyard, circulation onto a balcony).
It exercises the REAL
derivations — `borderReachableEmpty` for the open-sky half and the real
`connectedComponents` plus the `reachesSky` gate for the outdoor half — rather than
stubs, because both defects this function ever had were failures to defer to those
derivations and a stub would have agreed with the broken code. A whole `Floor` is not
constructed: `src/core/floor.ts` imports `../scene/*`, so building one drags the render
layer into a test about a geometric predicate. Both defects were confirmed caught by
reverting each in turn and watching exactly the corresponding case fail.

NOTE for anyone updating `_cowork/CONTEXT.md`: its claim that `src/core/` imports no
three.js is wrong. `src/core/grid.ts:1` is `import * as THREE from "three"`, and
`floor.ts` additionally imports from `../scene/`.

- **0.6 m structural cell = 12 voxels @ 5 cm.** Structural grid uses `CELL_SIZE = 0.6`; authored props use `VOXEL_SIZE = 0.05`, so `VOXELS_PER_CELL = 12`.
- **One shared occupancy map per floor** for rooms, furniture modules, AND stairs — collision is checked uniformly. Owned by `Grid`; mutated only via `ModuleStore`. A stair's footprint additionally reserves a matching hole (`Grid.holeCells`) on the floor directly above.
- **One central footprint transform: MIRROR FIRST, THEN ROTATE** (§2g). `transformCell`/`rotatedCells`/`occupiedCells` in `modules.ts` are the only place a `(rotation, mirrored)` pose becomes cells. Mirror-then-rotate ≠ rotate-then-mirror, so no consumer may reimplement it. Everything downstream (exterior edges, windows, clusters, holes, graph, props, stair geometry) derives from the transformed cells.
- **Mirroring NEVER uses negative scale** (§2g). `scale.x = -1` inverts triangle winding and normals (the stair-wedge bug class, §2a). Mirror the DATA and rebuild the geometry: mirrored cells for walls, negated voxel x for props, negated lane centres for the stair. Verified scene-wide: no negative scale, no non-positive `matrixWorld` determinant. Stairs remain the only scale-stretched element — and only in **y** (rise).
- **Clusters: full rebuild from occupancy.** Circulation/Outdoor cluster shells (and the adjacency graph) are recomputed from scratch on every change (`store.onChange`), not incrementally. Same-type only, orthogonal (4-neighbour) adjacency; corner-only contact does not connect (`connectedComponents` in `core/cluster.ts` is the single definition, shared by clusters and the graph).
- **Reachability is DOOR-based; adjacency has two edge kinds** (§2c/§2i). The graph emits TOUCH edges (`viaDoor:false`, physical shared-wall adjacency) AND ACCESS edges (`viaDoor:true`, an authored door). All reachability/connectivity rules (H1/H2/H3/H6/G1/ST1/ST2/C1/C2/DP1, entrance-rooted) traverse ONLY access edges — physical touch without a door is not a connection. Only the proximity rules (H4/S3/S4/S5) read touch edges. Stair links (bottom + top) are door-gated too. This was a deliberate CUTOVER: old/doorless layouts flag red until doored (DR1 note explains it).
- **Windows: derived, not stored** (§2d). Regenerated from room type + exterior edges + project north on every wall rebuild (they ride the wall pass), on EXTERIOR edges only. Nothing about the windows is serialized — export/import reproduces identical windows (from the stored `northAngle` + placement). Seed runs are picked SOUTHERNMOST-first under `northAngle` (§2k); panel/glazing heights are absolute (fixed on taller floors), which is why walls must be true-height geometry (§2b). Where an entrance coincides with a windowed edge the door wins (that edge is skipped).
- **North lives in ONE place** (§2k) — `orientation.ts` defines the convention (north = world −Z rotated CW-from-above by `northAngle`) and the single normal→bearing map; the generator's south-bias, OR1, the report's orientation line, and the on-screen north arrow ALL consume it, never re-deriving a bearing. `northAngle` is project-level DESIGN state (serialized, undoable — it moves windows); the dial widget/cutaway-toggle/badge are VIEW state (never serialized).
- **Doors: authored, STORED — the inverse of windows** (§2i). User-placed on interior edges, serialized (additive per-floor list), and NEVER derived. They ride the same wall-rebuild pass (cutting a fixed 2100 mm opening in BOTH adjacent wall segments), but a door's opening is FIXED and its header GROWS on taller floors (inverse of a window, whose panels are fixed and gap grows). Stale doors auto-remove inside the stranding mutation's undo snapshot; doors do not travel with rooms.
- **`connectionEdges` scaffolding removed** (§2i) — superseded by authored doors. Do not reintroduce a per-def access-metadata field; author a door instead.
- **The adjacency graph spans the whole dwelling** (all floors), not just the active one — cross-floor reachability is carried by `viaStair` edges (§2c). Entrances are floor-0-only and re-validated every build (never cached/stale).
- **Graph view recomputes per-frame while open** (cheap at this scale) → live updates; node positions persist by id across recomputes.
- **Rule validation is on-demand and advisory** (never blocks placement) — click "Check Layout" to run `validate()`; results surface in the text panel, the bubble diagram, and 3D shell tinting simultaneously. Any layout change drops the (now possibly stale) report (`floors.onLayoutChange`).
- **Wall height is real, true-height geometry; stair height is a runtime rescale** — deliberately different, see §2a/§2b. Walls are rebuilt (`rebuildRoomWalls()`/`rebuildClusterShells()`) directly at `floorHeight(floor)` on every layout change, so `scale.y === 1` always. Stairs stay built at `REFERENCE_STAIR_RISE` and rescaled via `group.scale.y` (`updateStairScales()`) — a taller floor genuinely means taller risers, so scaling is the correct model there, not a workaround.
- **Floor visibility is pure VIEW state, not design state** — never serialized (mirrors the pre-existing exclusion of camera state). Independent of the active-floor dim concept: dimming still draws a floor (colour-faded); hiding skips it entirely (`group.visible = false`). The active floor CAN be hidden (not force-switched) since interaction is scoped to the active floor's store regardless of what's drawn.
- **Undo/redo is snapshot-based, not command-based** (§2e) — this works precisely BECAUSE design state is tiny/serializable and derived state rebuilds from it (the same reasons cluster shells / windows are derived). A snapshot is a serialized project; a restore is the import rebuild path. VIEW state (camera, active floor, visibility, plan mode, selection) is deliberately outside history and preserved across restores. A commit is a no-op when the serialized state didn't change, so failed/degenerate actions cost nothing.
- **Prop seating:** prop voxels that fall inside a wall strip are clipped (`insideWall` in `place.ts`), so furniture sits flush against wall inner faces, never through walls.
- **Inactive floors:** rendered dimmed via opaque colour-fade toward the background (NOT alpha transparency — avoids depth-sort "slicing" artifacts) and are non-interactive (picker only ever raycasts the ACTIVE floor's store). Multi-colour voxel props are flagged `noDim` (not faded).
- **Multi-select is a Set, scoped to the active floor, entrances excluded** (§2h). Group move/delete are ONE undo action each (`moveMany`/`removeMany`, single `onChange`/commit). Group RE-POSE (rotate/mirror a whole selection) is out of scope for v1 — R/M require exactly one selected instance and no-op (with a hint) otherwise.
- **Escape has exactly one handler** (§2h, main.ts) — `dragDrop`/`entranceController`/`selection` expose public `cancelPlacement()`/`cancel()`/`deselect()` but do NOT listen for Escape themselves. Priority: active gesture (ghost placement, including Shift+D's duplicate ghost, or entrance-placement mode) → selection → plan mode. Never add a second Escape listener elsewhere — route through this arbitrator instead, or the priority ordering silently breaks (see §2h's note on why reactive post-hoc checks race).
- **Distinguish OS-level browser combos (Ctrl/Cmd+N/T/W) from page-interceptable ones (Ctrl/Cmd+D).** The former are handled by the browser BEFORE the keydown reaches page JS — `preventDefault()` is powerless and a synthetic-`dispatchEvent` test falsely passes (it bypasses native chrome). NEVER bind those. **Ctrl/Cmd+D (bookmark) is DIFFERENT** — its keydown DOES reach the page and `preventDefault()` DOES suppress the bookmark in Chrome/Firefox/Edge, so it's a legitimate binding (duplicate uses it — §2h — with Shift+D as a fallback). Still verify any modified-key binding on a REAL keypress: note that some browser-automation key tools can't emit modifiers at all, so a green automation run proves the HANDLER but not the physical browser default (§6).
- **Toggling element visibility via inline styles must use a class, not `style.display = ""`** — clearing an inline style falls back to the stylesheet's rule (which may itself be `display: none`), not to "visible" (caught during verification on `#selection-readout`; `#drop-overlay`'s pre-existing `.active` class toggle was already doing this correctly — follow that pattern, not a raw `style.display` write).

---

## 5. View / navigation (zoom-to-extent, floor visibility, plan view)

Added this session; all three interlock (floor visibility feeds the extent
box; the extent box feeds both axo and plan framing; plan mode drives floor
visibility). See `main.ts`'s "Camera framing" / "Plan (top) view" / "Bubble-
diagram" sections for the concrete wiring — the three toggle points (Reset
View, Top View, Diagram) are all mutually aware of each other's state.

- **Zoom-to-extent.** `FloorManager.contentBox(): THREE.Box3` unions the
  world-space bounding box of every placed instance's group + each visible
  floor's non-empty `clusterGroup`, across floors where `f.visible` is true.
  Falls back to those floors' grid footprints if nothing is placed, and
  further to a small box at the origin if no floor is visible at all. Forces
  `scene.updateMatrixWorld(true)` first — `Box3.setFromObject` reads
  `matrixWorld` directly, which can be stale if read in the same synchronous
  tick as a floor reposition (matrixWorld otherwise only refreshes on the next
  render pass; discovered and fixed this session).
- **Framing.** `sceneSetup.ts`'s `frameBox(box, direction)` (`ViewDirection =
  "axo" | "top"`) replaced the old fixed-position `resetView()`. Projects the
  box's 8 corners onto the chosen view's right/up axes (handles the axo case,
  where the box is seen at an angle, not just face-on) to find the required
  frustum half-extents, sets `viewSize`/position/target with a 15% margin
  (`FRAME_MARGIN`), and always resets `camera.zoom` to 1. For `"top"`,
  `camera.up` is swapped to world `-Z` (north-up) instead of `(0,1,0)` —
  looking straight down with an up vector parallel to the look direction is a
  singularity for OrbitControls' spherical math.
- **Reset View** (`main.ts`'s `resetToExtent()`) always lands at the default
  axo extent framing — including from plan/diagram mode, which it exits first
  (`exitPlanMode()` already re-frames axo). One button, one destination.
- **Floor visibility.** `Floor.visible` / `Floor.setVisible()` (getter/setter
  over `group.visible`); `FloorManager.setFloorVisible(i, v)` /
  `isFloorVisible(i)`. An eye-icon toggle sits next to each floor tab in
  `palette.ts` (`FloorState.floors[i].visible`,
  `PaletteCallbacks.onToggleFloorVisibility`). Default visible; not
  serialized (§3).
- **Plan (top) view.** `main.ts` state: `planMode: boolean`,
  `prePlanVisibility: boolean[]` (snapshotted on entry). `enterPlanMode()`
  exits diagram mode first, snapshots current visibility, hides every floor
  ABOVE the active one (`applyPlanVisibility()`), sets
  `controls.enableRotate = false` (pan/zoom stay live — rotation is locked so
  the plan reading can't be orbited into an oblique half-plan view), and
  frames top-down. `exitPlanMode()` restores the snapshot, unlocks rotate, and
  re-frames axo. Switching the active floor while in plan mode re-derives the
  hidden set live (`onSwitchFloor` calls `applyPlanVisibility()`); manually
  toggling a floor's eye icon while in plan mode updates the snapshot too (so
  exiting doesn't discard it). Mutually exclusive with the bubble-diagram view
  in both directions (each entry point exits the other first).
- **Cutaway needed no changes for plan mode**: wall normals are always in the
  XZ plane, so their dot product with a straight-down view direction is
  always ~0 (never exceeds the hide threshold) — every wall stays visible,
  which already reads correctly as a plan (walls seen edge-on, floor slabs
  filling the middle).
- **Cutaway toggle** (§2k): a "Cutaway" view button (default ON) flips
  `setCutawayEnabled` — OFF renders every wall so the building reads as a solid
  exterior object (facades/windows visible from outside). Session VIEW state
  only (never serialized, untouched by undo/load); coexists with plan view and
  per-floor visibility/dimming (the pass only ever flips `wallNormal`-tagged
  `.visible`). Lives in the bottom-right `#view-controls` group with the compass
  dial; both hide in diagram mode.
- **Interface view toggle** (`#interface-toggle`, main.ts; `setInterfaceView`,
  floorManager.ts): shows only the BINDING level of a unit and reduces the rest
  to one open plate. Default OFF, session VIEW state, never serialized, no
  effect on the `dwelling-unit` export.
  - **Kept as-is:** wet rooms (`isWet` — `bathroom_small`, `bathroom_large`,
    `kitchen`), stairs, Outdoor clusters (balconies/terraces), entrance markers,
    and every wall segment sitting on the flat's OUTER boundary with its glazing.
  - **Stripped from every non-wet room:** interior partitions, furniture props,
    interior door markers and arcs, and the room's own colour.
  - **FACADE EDGES STAY, including toward balconies.** `isFacadeEdge()`
    (exteriorEdges.ts) is THE definition, and it decides nothing itself: it is
    the union of two DERIVED answers. An edge is facade when it faces open sky
    (`!occupied` AND `floor.isOutside`, both required) OR is in
    `floor.semiExterior.boundary` (a qualifying room↔outdoor boundary). A balcony
    sits outside the enclosure and its boundary carries the french-window
    glazing, so that wall is facade and stays. Circulation neighbours are
    interior and still dissolve. Both halves must come from the derived data: an
    earlier version tested `!occupied` alone and scanned for outdoor cells
    itself, which called a SEALED EMPTY POCKET and a SEALED COURTYARD facade —
    the two cases `isOutside` and `reachesSky` exist to reject. `occupied` is
    kept beside `isOutside` because `Floor.isOutside` falls back to `?? true`
    before the first derive pass. `boundary` excludes bathroom↔outdoor
    boundaries at source (privacy), so the predicate is really "glazable
    room↔outdoor boundary"; no current consumer reaches that case. Deliberately WIDER than `exteriorEdges` (open sky only), which
    windows, D1/D2, W1 and the export keep using. The FAC1 rule reads the same
    function via `GraphNode.hasFacadeEdge`, so the drawing and the check cannot
    disagree about where the enclosure runs.
  - **Two mechanisms, both filters.** Walls go through the shell rebuild:
    `partitionEdges()` returns the LOCAL edge keys that are NOT facade, and
    those are handed to `rebuildRoomWalls` as the existing
    `BoundaryWallOpts.skip` set (the same dissolve the Outdoor boundary uses),
    so no new geometry path exists. Mesh visibility cannot do this job: a room's
    walls are merged ONE MESH PER DIRECTION (moduleMesh.ts ~L451-498), so a
    single mesh holds both facade and partition segments. Furniture, colour and
    door markers are plain visibility/material state in `applyInterfaceView()`.
  - Colour goes through `material.userData.baseColor`, which `fade()` (floor.ts)
    already treats as authoritative, so the view composes with dimming and the
    cutaway instead of fighting them; `Floor.refreshColors()` re-runs that pass.
  - **`INTERFACE_TINT_BEDROOMS`** (floorManager.ts, exported const): when true,
    bedrooms keep a tinted plate marking position. Whether bedroom positions are
    part of the binding level is still open, so this is one line to flip.
  - Door markers hide via `DoorView.setVisible()`, which restores the arc state
    `setArcsVisible` last asked for, so the plan/3D arc toggle survives.

---

## 6. Current state — built/verified vs. not

**Built & verified across recent sessions (quantitatively, via temporary debug
hooks — screenshot tooling was unreliable in this dev environment, so
verification leaned on exact geometry/state dumps rather than visual
screenshots):**
- **Verification sweep — diagram Re-layout / depth badges / node sizing /
  Ctrl+D (Track C):** each item audited against the RUNNING app through the
  real UI (scene loaded via the real drag-drop IMPORT path — a genuine `drop`
  of a crafted `.json` → `parseProject`/`loadProject`, not a state hook — then
  all visual claims from real screenshots + real control clicks). Screenshot
  tooling was flaky (timed out ≥ ~1100px viewport; kept ≤ 800px) but usable.
  - **Re-layout button:** was ABSENT (root cause: `show()` set inline
    `display:""`, overridden by the stylesheet's `#graph-relayout{display:none}`
    → computed `none`; confirmed via `getComputedStyle`). FIXED (explicit
    `inline-block`, §2j). Verified: button now visible + labelled "Re-layout";
    dragging the Bedroom node pinned it (moved + stayed), clicking Re-layout
    unpinned it and the sim resettled it toward its neighbour — all in
    screenshots.
  - **Depth badges:** RENDER correctly (the chip design was fine) but ONLY
    after Check Layout — a silent data prerequisite (root cause: depths came
    solely from Check Layout's `setDepths`; NOT the suspected node-id key
    mismatch — ids matched). FIXED (diagram self-computes depths in `frame()`
    when `showDepth` is on, §2j). Verified: after importing a scene with an
    entrance + one door and opening the diagram WITHOUT Check Layout, the entry
    (Living) node showed a "0" chip and the doored Bedroom a "1" chip, from the
    default-on depth toggle alone (screenshot).
  - **Node sizing + labels:** already SHIPPED and working — labels read
    "Bathroom"/"Bedroom"/"Kitchen" (variant suffix stripped by `shortLabel`),
    radius scales by √(cell count) so the 36-cell Living node is visibly the
    largest (screenshot). No change needed.
  - **Ctrl/Cmd+D duplicate:** was NOT wired (only Shift+D; Ctrl+D returned
    early with no `preventDefault` → browser bookmark, no clone). FIXED (§2h) —
    Ctrl/Cmd+D + Shift+D both route to `startDuplicate`, `preventDefault`
    called. Verified: handler's `preventDefault` fires on a Ctrl+D keydown
    (dispatchEvent returned cancelled); the duplicate ghost followed the cursor
    unpressed (screenshots), a click placed the clone (bedroom_small, matching
    source, auto-selected), one Undo reverted it. AUTOMATION LIMITATION: this
    env's `key` tool can't emit modified keydowns (Ctrl/Shift arrive `false`),
    so the physical bookmark-suppression is a manual-check item — the flow was
    triggered by a faithful synthetic `keydown{ctrlKey:true}` and completed with
    real mouse + real Undo button.
  - `tsc`/build clean; the temporary import-`confirm` stub + keydown probe were
    page-runtime only (cleared on reload; nothing added to source).
- **North compass + orientation-aware windows + cutaway toggle (§2k, §8):**
  verified with REAL browser interaction (screenshot tooling worked reliably
  this session) plus exact state dumps, and a standalone Node port of the
  south-bias + orientation math for exhaustive coverage.
  - **South bias**: an isolated bedroom's window always lands on the face
    pointing due south — grid-south at north 0, grid-west at north 90,
    grid-north at north 180, grid-east at north 270 (the band jumps to the
    OPPOSITE face on a 180° flip); a REAL dial-drag to ~130° landed it on
    grid-west (the sunniest face then), confirmed on screen. `sectors`/
    `northLit` track it (always "S"/false for a south-lit room).
  - **Dial (real drag + synthetic)**: dragging the needle updated
    `displayNorthAngle` + the badge LIVE while `floors.northAngle` stayed put
    (windows did NOT rebuild mid-drag); on RELEASE `floors.northAngle` took the
    value, windows re-derived, and exactly ONE undo snapshot was pushed. One
    Ctrl+Z reverted the whole gesture — north 180→0, glass north→south, dial
    re-synced to "North 0°", the room preserved (undo goes through
    serialize→JSON→parse→loadProject, which also PROVES the northAngle JSON
    round-trip).
  - **North badge**: camera-aware — `rotate(0…)` (straight up) in plan at north
    0, `rotate(90…)` (east/right) at north 90; hides in diagram mode with the
    dial (both `display:none`), returns in 3D/plan.
  - **OR1**: a bedroom walled on S/E/W (exterior only on grid-north) glazes
    north → `northLit=true` → OR1 fires ("lit only from the north"); opening its
    south face (removing the south flanker) moves glazing to south → `northLit`
    false → OR1 gone. A bathroom (no glazing) never appears — no double-fire.
  - **Orientation report line**: "Bedroom — Small: glazing N/S" per room, bathroom
    excluded; a forced-ratio living room's wrapped U-band correctly read
    "Living Room: glazing S + E + W" (a corner-wrapped band carries all its legs'
    sectors). All 8 orientations agreed on edge-count/achieved/contiguity in the
    standalone sweep.
  - **Serialization**: load with `northAngle:137`→137, `400`→40 (wrapped),
    MISSING→0 (old file, no complaint), garbage string→0.
  - **Cutaway toggle**: OFF renders the solid building with its south window
    visible from outside (confirmed on screen); ON restores dollhouse hiding.
    Plain `main.ts` boolean, never in `serializeProject` — not serialized.
  - `tsc`/build clean; the temporary `__dbg` hook removed (grep-confirmed).
- **Corner windows + per-floor N1 rider (§2d, §8) — L/U-shaped window wrapping,
  glass-to-glass corners, per-floor circulation flag:** verified with real
  browser interaction throughout (screenshot/computer-tool interaction was
  reliable this session) plus exact numeric/pixel verification for the
  sub-millimetre geometry a screenshot alone can't resolve, and a standalone
  Node reimplementation of the algorithm (types stripped, ported line-for-line
  from the shipped `windows.ts`) for exhaustive coverage no single browser
  session could practically click through.
  - **Algorithm** (standalone; cross-checked against the real app's
    `computeWindows`/`windowStats` wherever they overlap): a forced-high-ratio
    Living Room (L-shape, 36 cells) wrapped a 7-edge south run into a U — 2
    edges onto the west run at the SW corner, 1 edge onto the east run at the
    SE corner, 10 total — `achievedRatio` matching the hand-computed value to
    6 decimal places in BOTH the standalone port and the real running app. All
    8 orientations (4 rotations × 2 mirror states) at the same forced ratio
    produced IDENTICAL edge counts/achieved ratios/band-contiguity in the
    standalone sweep; 2 spot-checked directly in the real app (rotation 0
    unmirrored, rotation 3 mirrored — the two whose 7×6 footprint happened to
    fit the test grid from the origin) matched that standalone result exactly.
    An entrance placed directly on a wrap-target edge — tested BOTH in the
    standalone port and, separately, through the real entrance/`FloorManager`
    wiring in the live app — blocked only that arm; the algorithm rerouted the
    shortfall to the still-open arm, with total edge count and `achievedRatio`
    unchanged (confirming W1's math doesn't care which specific edges got
    picked). An extreme ratio (5×, saturating the whole 26-edge perimeter)
    produced `belowTarget=true` once supply was genuinely exhausted, and
    confirmed by direct inspection that the L-room's own concave notch corner
    is structurally unreachable — neither flanking cell has an exterior edge
    on the face that points into the notch, so the same-cell wrap test simply
    has nothing to match there, at any ratio.
  - **Geometry**: real-browser bounding-box inspection (`geometry.
    computeBoundingBox()` on each merged wall/glass mesh) confirmed both
    wrapped corners of the forced-ratio Living Room close exactly as designed
    — the N/S pane's glazing unchanged at its full untrimmed width, the E/W
    pane's glazing extended to the true corner — matching hand-derived
    coordinates to 3 decimal places at both the SW corner and, on a second
    room (`bedroom_large`, framed variant), a NW corner too. Pixel-sampled the
    rendered WebGL canvas (via an explicit `renderer.render()` immediately
    before a canvas-to-2D-context `drawImage` readback — a canvas without
    `preserveDrawingBuffer` reads back blank otherwise) across the full
    visible window height at 5 different Y positions: continuous glass-family
    colour throughout, zero background/gap pixels, a visibly DARKER band
    exactly at the seam — the expected small deliberate overlap of two
    30%-opacity panes, not a defect.
  - **Framed variant / mitred lintel**: a forced-ratio `bedroom_large` (a
    different L-shape/notch than the Living Room) wrapped at BOTH a SW and a
    NW corner simultaneously (the west run wrapped at both its own ends) —
    bounding boxes confirmed the glazing GAP (0.9–2.1, sill below + lintel
    above both present) extends to the true corner at each, and that the
    corner cell's id correctly carries both meeting legs. Sill and lintel
    themselves needed, and received, no wrap-specific code at all, per the
    glass-to-glass design note below — this is the case that design choice
    depends on.
  - **Cutaway**: read `child.visible` directly on the merged per-normal
    wall/glass meshes (not just screenshots) while orbiting — confirmed
    cutaway hides exactly the camera-facing leg's solid+glass while the other
    leg's geometry (never shrunk OR dependent on the first leg's presence, by
    the asymmetric design below) stays fully intact with no gap, verified in
    both directions (west-hidden/south-shown and south-hidden/west-shown).
  - **N1 rider**: a real two-floor dwelling (Floor 0: stair + 6 circulation
    singles + bedroom + bathroom, 47 cells, 18 circulation/stair; Floor 1:
    living + kitchen, 52 cells, 0 circulation), driven through the ACTUAL
    Check Layout button and rendered report, reproduced exactly the scenario
    the rider targets: Floor 0 alone (38%) correctly flagged ("Floor 0 is
    circulation-heavy (38% of interior area)") while the whole-dwelling figure
    (18%, diluted by Floor 1's 0%) correctly stayed silent — a circulation-
    heavy storey no longer hides behind efficient ones. A follow-up scene with
    BOTH floors heavy (26% and 100%) fired all three — whole-dwelling (41%)
    and both per-floor flags — simultaneously, confirming "both can fire,
    different granularity." A single-floor dwelling at 26% (would flag if it
    were per-floor-eligible) showed ONLY the whole-dwelling flag and info
    line, no "Floor 0: …" line or per-floor violation at all — confirming the
    `floorCount > 1` suppression on both the rule and the report line. The
    report's per-floor line format ("Floor 0: 38% · Floor 1: 0%") matches the
    task's own example exactly.
  - `tsc`/build clean throughout; the temporary `(window as any).__dbg` hook
    (floors/camera/controls/scene/renderer, for scripted scene construction
    and precise camera framing — the same pattern prior sessions' debug hooks
    used) was removed before finishing; confirmed via `grep -rn "__dbg" src/`
    returning nothing.
- **Diagram polish (§2j) — depth-badge chip, bottom headers, report hover:**
  UNLIKE prior sessions, screenshot/computer-tool interaction worked reliably
  this time (real clicks, real hovers, real screenshots — the environment's
  earlier unreliability wasn't reproduced), so this was verified with actual
  browser interaction as the task required, with a few pixel-level reads
  (`ctx.getImageData`, THREE.js material properties) used to confirm exact
  detail a compressed screenshot couldn't resolve (see below). Test dwelling
  built via `store.place`/`addEntrance`/`addDoor` (bypassing the UI, same
  shortcut as before) — 2 floors, an entrance, a living/kitchen/bathroom on
  floor 0, a stair, a bedroom on floor 1 — then all verification (Check
  Layout, the diagram/3D toggle, hovering report cards, toggling checkboxes)
  through the real buttons/checkboxes/pointer.
  - **Depth badge**: initial pixel probes read the node's own dark border
    stroke (`#1a1a1a`) and mistook it for the badge (`#1e1e1e` — nearly the
    same near-black colour, not reliably distinguishable by fill-colour alone).
    Switched to scanning for the badge's WHITE numeral text and light border
    stroke specifically (colours nothing else nearby uses) and got a clean
    signal: 77 white pixels present with the depth toggle on, 0 with it off,
    on Kitchen (depth 1). Confirmed on 3 different node colours — Living Room
    (red), Kitchen (yellow), and the Bathroom once doored into reachability
    (cream, `#ede7da` — the exact low-contrast case the redesign targeted) —
    all three showed the badge's white text correctly.
  - **Column headers**: confirmed visually via screenshot — "Floor 0" renders
    at the BOTTOM of its column in the active-floor accent colour.
  - **Hover emphasis**: hovering the AC1 card (stair↔upper-floor-bedroom, the
    cross-floor case) visibly put a white outlined ring on BOTH the stair and
    the bedroom nodes simultaneously, plus a white overlay on the connecting
    edge, all on top of their existing severity rings/colour — confirmed via
    screenshot. Unhover reverted cleanly (rings/overlay gone, plain severity
    rings remained). A same-floor edge card (S6, kitchen↔bathroom) hovered
    correctly too (`hoverIds`/`hoverEdge` matched exactly). Hovering the
    dwelling-level G1 card ("Whole dwelling", no nodeIds/edge) produced no
    diagram change and its DOM row correctly lacked the `.hoverable` class —
    confirmed by querying every report card's class list against its rule id.
    That run predates §2s, so the cards were `.vp-item` then and are `.vs-card`
    now.
    In the 3D view (report panel open over the 3D scene, not the diagram):
    hovering S6 read the actual THREE.js materials directly — both Kitchen's
    and Bathroom's `emissiveIntensity` were exactly `1.0`
    (`HOVER_EMPHASIS_INTENSITY`) while hovered and their emissive COLOUR was
    untouched (still their severity tint), then exactly `0.55`
    (`EMISSIVE_INTENSITY`, the normal tier intensity) after moving the mouse
    away — confirming the boost-and-revert never touches colour/`hiPrev` and
    can't desync from the normal tier highlight.
  - `tsc`/build clean; debug hook removed; confirmed no `__dbg` references
    remain in `src/`.
- **Bubble-diagram redesign (§2j) — all floors, draggable nodes, cleanup:**
  screenshot/computer-tool timed out again this session (same class of issue
  as prior sessions); verified entirely via a hand-built 2-floor test dwelling
  (placed directly through `store.place`/`floor.addEntrance`/`floor.addDoor`,
  bypassing the UI) plus direct `graphView.frame()` calls (since
  `requestAnimationFrame` did not appear to tick in this headless context —
  called `frame()` manually, which is all `animate()`'s diagram branch does
  per real tick anyway) and synthetic `PointerEvent`s dispatched at the
  canvas. Confirmed: two stairs on the same floor pair both land exactly on
  `stairBoundaryX` (same x, different y); a 3rd floor's stair correctly lands
  on the floor-1/2 boundary (different x, `colWidth` recomputed for 3
  columns); every room/cluster node's x stays within its own column's band
  after 60+ simulation steps. Dragging: a room dragged toward another column
  clamps at the column edge (never crosses); a stair dragged toward its own
  floor's interior stays locked to its boundary x while y moves freely;
  released nodes stay pinned (position frozen across 60 more steps) while
  their doored neighbours (same-floor AND cross-floor) visibly relax toward
  the new pinned position, confirming forces still propagate from a pinned
  node as a fixed anchor. Double-click unpinned exactly the clicked node
  (a separately-pinned node stayed pinned); Re-layout cleared the whole
  pinned set. Resizing the viewport to 328×500 (from 1008×720) re-clamped
  ALL 9 nodes across 3 floors back into valid bands/boundaries with zero
  errors. Touch-edge toggle: verified off-by-default; a flagged touch edge
  (an S6 shared-wet-wall note on an undoored kitchen/bathroom pair) rendered
  in BOTH toggle states, while an unflagged touch edge (living/bathroom,
  physically touching, no rule interested in it) rendered ONLY when the
  toggle was on — confirmed by replicating the exact `draw()` visibility
  decision against the live edge/severity data. Check Layout produced 8
  violations spanning both floors and hard/soft/note tiers (H1 orphaned
  rooms, note-tier S6, soft-tier access-edge flags); dragging a hard-flagged
  node preserved its highlight tier across the move and kept it within its
  column band. Confirmed by static analysis (and by construction — `GraphView`
  only ever reads `computeDwellingGraph()`, never writes to `Floor`/
  `FloorManager`) that no view-state here can reach `serializeProject()`'s
  output; `projectIO.ts` has zero references to any of it.
- Wall height (§2b): walls build directly at the true floor-to-floor height
  on every layout change, room shells AND cluster shells — no `scale.y`
  hack (an earlier version of the fix used a rescale pass; superseded this
  session by true-height geometry). Verified `scale.y === 1` on every wall
  mesh, zero gap to the plate above, concave corners unaffected, cutaway
  unaffected, selection/dim tinting survives an in-place wall rebuild.
- Stair top-wedge fix (§2a): flight-1 winding corrected; verified via riser
  normal direction and a watertightness raycast sweep.
- Zoom-to-extent, Reset View, floor visibility, plan/top view (§5): verified
  content-box framing changes with placed content and floor visibility,
  plan-mode auto-hide/restore across floor switches, mutual exclusivity with
  diagram mode, and that visibility never survives a save/load round-trip.
- Rule-driven windows (§2d, W1): verified per-type generation (living
  full-height, bedroom framed, kitchen fixed 2-edge, bathroom none); the
  2-edge minimum (computed-1 rounds to 2, no single-edge windows); bands
  centred on the longest run, no corner wrap; move/rotate regenerates windows
  on the new exterior edges; cutaway hides panels + glass together with their
  face; entrance-coincident edge skipped (door wins); W1 fires on
  insufficient supply (and independently of D1); export/import reproduces
  identical windows; selection tints panels (shared material) while glass
  stays separate, glass dims with its floor.
- Mirroring, all placeables (§2g): verified all 8 orientations (4 rotations × 2
  mirror states) of every L-room are distinct and place correctly, with grid
  occupancy, ghost validity, walls, and glazing all agreeing with
  `occupiedCells(..., mirrored)`; mirror-then-rotate ≠ rotate-then-mirror for
  every L-room (order is load-bearing); `buildBoundaryWalls` is exactly
  reflection-equivariant (mirrored wall vertex set = x-reflection of the
  unmirrored one, same counts/normals → concave corners mirror cleanly);
  collision follows the mirror (mirrored footprint blocked, mirrored notch free
  and placeable, unmirrored-only cells freed); Kitchen props are the exact
  x-reflection at the same 19,195 voxels (wall-clip resolves the reflected
  walls); the mirrored dogleg's (position, outward-normal) pairs are the exact
  reflection of the unmirrored one (516 verts, 0 mismatches, `FrontSide`), riser
  normals (0,0,−1)/(0,0,+1) per flight, handedness flipped, stairwell hole above
  matches; **scene-wide: no negative scale, no non-positive `matrixWorld`
  determinant, no bad instance matrices**; mirrored projects round-trip
  byte-identical (and rebuild identical derived state), old files without the
  field load all-unmirrored; `M` mirrors the palette ghost (re-tinting validity),
  the move ghost, and a selected instance (exactly one undo snapshot, symmetric
  undo/redo); a collision-blocked mirror changes nothing and records no snapshot;
  `M` ignored while typing; selection highlight survives the mirror rebuild;
  the adjacency graph reads the mirrored footprint (and provably not the
  unmirrored one); move/rotate preserve the flip.
- Undo/redo + entrance deletion (§2e/§2f): verified a 15+ mixed-action
  sequence undoes to the empty baseline and redoes to the exact original final
  (incl. derived walls/glass/clusters and floor/stair reconstruction);
  undo/redo are symmetric; a new action after undo clears redo; camera, active
  floor, and per-floor visibility are untouched by undo; a real drag commits
  exactly once (no per-frame snapshots; an invalid drop commits nothing); a
  collision-blocked rotate correctly records nothing; entrance select (real
  projected click → highlight) + Delete removes it and is undoable; deleting
  the last entrance empties `entryIds` and restores the E1 gate with no stale
  report; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + buttons all track stack state.
- Multi-select / group ops / UI polish (§2h): verified shift-click assembling a
  mixed selection (room + room + stair + connector), including toggle-off/
  toggle-back-on and plain-click collapsing a multi-selection to one; group
  move of two adjacent rooms preserves the rigid offset AND lets one member's
  target land on the other's currently-occupied cells (self-exclusion) while
  the whole group ghost tints as one valid/invalid unit; one Ctrl+Z reverts
  the WHOLE group move, one Ctrl+Shift+Z redoes it; an invalid group drop
  restores every member's position/visibility with zero snapshots added;
  group delete of 3 mixed instances is one snapshot, one undo restores all 3;
  R/M correctly no-op (with a toast hint) on a 2-instance selection with zero
  state change and zero snapshots, then work normally again once collapsed to
  a single selection; the Escape priority chain (gesture → entrance mode →
  selection → plan mode) checked exhaustively — each state consumes Escape
  alone, never cascading into the next; hover applies a distinct
  lower-intensity tint that never overwrites a selection glow and correctly
  follows the cursor between instances, clearing on `pointerleave`; the
  shortcuts panel opens/closes and lists every shortcut; the selection
  readout is correct for 0 (hidden text, fails safe — this exact class of
  bug, an inline `style.display=""` falling back to a stylesheet
  `display:none`, was caught and fixed here), 1 (type · floor · CURRENT
  rotated bounding box, e.g. a 7×6 room reads "6×7" at 90°), and N
  (`"{n} selected"`) selections, plus a selected entrance
  ("Entrance · Floor 0"); plain left-drag on empty ground still orbits the
  camera unobstructed (`controls.enabled` never drops for it) — confirming
  marquee-select was correctly NOT wired in on top of that gesture.
- **Shift+D duplicate bug fix** (§2h): manual testing found duplicate silently
  did nothing on a multi-selection (e.g. several circulation blocks) — the
  first implementation routed ONLY through `dragDrop.startPlacementFrom`
  (single-instance), so 2+ selected just fell through with zero feedback;
  automated testing hadn't caught it because it happened to only exercise the
  single-selection path. Rebuilt on `GroupGhostPreview`/`store.placeMany` (see
  above) and reverified end-to-end: 3 mixed circulation pieces (2×
  `circulation_single` + 1× `circulation_double`) duplicate together,
  preserving their exact relative arrangement at the drop point; the ghost
  tracks the cursor on plain `pointermove` with **zero mouse buttons held**
  (confirmed: no `pointerdown` fired before the tracking move) and commits on
  a plain click; one undo removes all 3 duplicates, one redo restores them;
  Escape cancels the whole ghost with zero instances created and zero
  snapshots; R/M correctly no-op (with a hint) while duplicating 2+, and
  still rotate/mirror correctly while duplicating exactly 1 (verified the
  final placed instance's `rotation`/`mirrored` match the ghost's rotated/
  mirrored pose exactly, not just the ghost's transient state).

- **Interior doors + door-based reachability (§2i):** verified (via state/geometry
  dumps — screenshot tooling stayed unreliable in this env) that two adjacent
  rooms produce a TOUCH edge with no door and gain an ACCESS edge only when
  doored; an entrance-rooted room reaches green through a door while a touching-
  but-undoored neighbour flags H1, and the DR1 note appears on a doorless
  dwelling; the opening is cut in BOTH wall segments (room↔room, and the cluster
  side of a room↔cluster boundary — min-Y 2.1 at doored cells, full-height
  elsewhere); the opening stays fixed at 2100 mm while the header grows on a
  forced 4.0 m floor (window inversion, distinct from windows); a stair with
  doors at BOTH ends carries an upper room to green (bottom + top `viaStair`
  access edges), and removing the top door orphans the upper room (H1) and flags
  ST1; a corridor's C1/C2 degree counts DOOR connections (undoored → C1 orphaned,
  one door → C2); H4 fires on touch regardless of doors; 2-edge minimum + exterior
  rejection enforced by `resolveDoorSpaces`; a rotated+mirrored room hosts doors
  (absolute edge-bound); moving a room away auto-removes its door in the same
  snapshot and one undo restores move + door; markers render violet on the slab
  (plan-readable, pickable) and deleting a door re-closes exactly its own opening;
  round-trip with doors is faithful and an old doorless file loads doorless.
- **Doors — adversarial review + interaction fixes (§2i):** a multi-agent review
  caught 5 confirmed INTERACTION-layer defects the API-level tests missed (they
  exercise the store/graph, not real pointer events): (1) a boundary could hold
  two doors placed from opposite sides, and (2) two collinear doors could merge
  into an 1800 mm opening — both now rejected by `doorOverlaps` (physical-edge
  dedup; verified opposite-side + collinear + disjoint cases via `addDoor`); (3)
  door markers were unselectable because module picking ran first — fixed by
  picking markers before modules (verified: door selected with a module under the
  cursor); (4) `SelectionController` acted during door/entrance placement, grabbing
  the room under a door click — fixed with an `isToolActive` guard (verified: no
  module selected while the tool is armed); (5) two placement modes could be armed
  at once so one release drove both — fixed with `cancelPlacementModes` (verified
  it disarms door + entrance). The pointer-flow fixes were verified by stubbing the
  private pick sources, since this headless preview's canvas has zero size and
  can't raycast real screen coordinates.
- **`connectionEdges` retired (§2i):** removed from `modules.ts` (one-line
  historical note kept); `tsc`/build clean with it gone.
- **Rules batch ④ — accessibility width + escape distance (post-doors, §8):**
  verified via synthetic-graph dumps through `validate`/`accessDepths` (canvas is
  0×0, so real raycasting stays unavailable). **A1** (accessible width, 2×2
  morphological test per circulation cluster): a straight 1-wide 4-cell corridor
  flags all 4 cells; a 2×4 corridor passes (0 narrow); a **1-wide L flags all 5
  cells including the corner** (neighboured on two axes but never in a full 2×2
  square); a 2×3 hall with a 1-wide spur flags **only the 2 spur cells**. **F1**
  (far from exit, seeds = entrances + stairs, `ESCAPE_DEPTH_MAX = 4`): on a
  r0(entry)…r6 chain with no stair, r5/r6 (entrance-depth 5/6) flag; doring a
  stair near the deep end drops their exit-distance to 0 and clears F1 (stairs ARE
  seeds); a room **6 hops from the entrance but 2 from a stair stays silent**
  (the spec's divergence case); F1 is gated off with no entrance; no crash with no
  circulation or no stairs. `accessDepths` factored out of `computeEntranceDepths`
  (identical entrance-depth behaviour preserved). Rule count 33 → 35.
- **Rules-additions batch ③ (post-doors, §8):** verified via state dumps —
  **N1** circulation fraction reads 4.3% on a normal layout (unchanged when an
  outdoor balcony is added — excluded both sides) and 64% on a corridor-palace,
  firing the soft flag past 25% (percentages sanity-checked: 2/47, 16/25); **PG1**
  fires on an inverted layout (public mean depth 2 > bedroom 1) and stays silent
  on the standard genotype (public 0 ≤ bedroom 2); **MB1** flags a sleeping floor
  with no bathroom, clears when one is added, and stays silent (no double-fire)
  when P1 already owns a bathroom-less flat; **DR2** notes a bedroom at 3 doors
  (silent at 2); **C1 is now soft** (amber, matching O1). Both report info-lines
  render ("Circulation: 5% of interior area", "Public mean depth 2.0 · Bedroom
  mean depth 1.0"). Rule count 29 → 33.
- **Rules-recalibration batch ② (post-doors, §8):** verified via state dumps —
  (1) **H4 is now ACCESS-based** (a DOOR between bathroom↔kitchen fires H4/hard);
  a shared WALL with no door fires the new **S6** (note, efficient services) —
  both directions confirmed, and the two never co-fire on one boundary. (2) **DP1
  stair-hop weighting**: room→stair→room now costs ONE hop (verified stair depth 1,
  upper room depth 1, was 2). (3) **S4 removed** (two touching bedrooms no longer
  flagged); new **AC1** (soft) fires on a bedroom↔stair touch (SIA 181). (5)
  **H3 en-suite exemption**: two en-suites + no guest bath → 2× **S7** (note) + G1
  (soft), ZERO H3; adding a guest bathroom doored to circulation clears G1 and
  leaves S7 only on the en-suites. Rule count 27 → 29. (4) Tier taxonomy added to
  `rules.ts`; consistency-pass finding (C1-vs-O1 tier mismatch) recorded in §8.
- **Rules-correctness batch ① (post-doors, §8):** verified via state dumps —
  (1) **edge classification**: a floor-above room whose only open side faces the
  stairwell hole now has `hasExteriorEdge=false` (was true), D1 flags it, no glass
  generates onto the void, and W1 does NOT double-fire (gated on `hasExteriorEdge`);
  same-floor stair-facing edges were already correct; an entrance can no longer be
  placed on a stair cell and a stair-facing entrance flags E2. Both the window and
  graph occupied sets now source from `buildSpaceTargets`. (2) **blocked-seed**: a
  studio flat with the entrance ON the bedroom fires only G2 (soft) — H3 no longer
  detonates every room (seed exempt from blocking). (3/4) **S1/O1**: an undoored
  outdoor cluster flags O1 (unreachable), clears at 1 door, and flags S1 at >2
  doors — both on access degree, distinct. (5) **S5**: fires only on a DOORED
  kitchen↔living pair, not a sealed touching wall.

**Also built (from earlier sessions, still current):**
- Grid, occupancy, placement, rotate, **mirror**, move, delete; grid resize with reconcile.
- All room presets render as clean hollow shells; concave corners z-fight-free.
- Dynamic cutaway hides camera-facing walls reactively (rooms + clusters).
- Multi-floor stacking, floor tabs, add/delete, per-floor grid size,
  dim/non-interactive inactive floors.
- Circulation & Outdoor merged cluster shells (outer walls only; same-type
  only; split on deletion).
- Kitchen voxel props (counter_run, overhead_cabinet, stove, sink, fridge).
- **Stairs**: 180° dogleg, footprint 2×6, cuts/restores a matching stairwell
  hole in the floor above, auto-creates a floor above when placed on the
  topmost floor, blocked if the floor above has no clear plate.
- **Entrances**: ground-floor door markers bound to an exterior edge,
  re-validated every graph build, root reachability. Selectable + deletable
  (§2f): click to select, Delete to remove; place + delete are undoable.
- **Undo / redo** (§2e): snapshot-based (cap 20), Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y + bottom-left buttons; covers place/move/rotate/delete, entrance
  add/delete, floor add/delete, grid resize, import; view state excluded.
- **Whole-dwelling adjacency graph** (all floors; TOUCH + door ACCESS edges) +
  toggleable bubble-diagram view (§2j: all floors as columns, stairs straddling
  their boundary, draggable/pinnable nodes, entry rings, depth badges,
  highlight overlays; ACCESS edges solid vs TOUCH-only dashed, toggleable).
- **Interior doors** (§2i): authored, serialized, door-based reachability;
  2-edge openings cut in both wall segments; plan-view markers; auto-removal.
- **Layout rules engine**: 36 rules (see §8), advisory/on-demand, surfaced in
  a text report, the diagram, and 3D shell/marker tinting.
- **Rule-driven windows** (§2d): derived sill/lintel panels + glazing on
  exterior edges, per-type ratio targets, W1 shortfall rule.
- **Save / load**: whole-project JSON export/import, drag-and-drop, tolerant/
  versioned parsing.
- **Multi-select & group ops** (§2h): Shift-click multi-select (active floor
  only, entrances excluded), group move (self-exclusion, one snapshot), group
  delete (one snapshot), R/M single-selection-only with a no-op hint,
  Shift+D duplicate of the WHOLE selection (any count — `store.placeMany`),
  hover cue, a single Escape-priority arbitrator, a shortcuts legend, and a
  selection readout.

**Not built:**
- Furniture for rooms other than Kitchen — all other rooms are empty shells
  (Kitchen + Bathroom/Bedroom/Living/Recreation are furnished, §2l; Circulation/
  Outdoor connectors stay empty shells — no `PROP_BUILDERS` entry.)
- 1-edge (narrow) doors — v1 doors are fixed at a 2-edge (1200 mm) span.
- Group re-pose (rotate/mirror a multi-selection) — still out of scope (§7).

**Known minor issue (deferred):** connector pieces are selected by clicking
their floor tile; their merged cluster walls live in a shared `clusterGroup`
and are not individually pickable — clicking a cluster wall doesn't select a
specific piece.

**Committed in this change** (interior doors §2i + rules batches ①/②/③ §8): new
`src/core/door.ts`, `src/scene/doorView.ts`, `src/interaction/doorController.ts`;
modified `PROJECT_STATE.md`, `src/core/floor.ts`, `src/core/floorManager.ts`,
`src/core/modules.ts`, `src/core/projectIO.ts`, `src/core/adjacencyGraph.ts`,
`src/core/rules.ts`, `src/scene/moduleMesh.ts`, `src/scene/clusterShells.ts`,
`src/interaction/picker.ts`, `src/interaction/selection.ts`,
`src/interaction/entranceController.ts`, `src/ui/palette.ts`,
`src/ui/graphView.ts`, `src/ui/validationPanel.ts`, `src/style.css`,
`src/main.ts`. Run `git status`/`git log` to confirm.
(The mirroring + multi-select/group-ops/UI-polish features are committed as
`30bf5dd`.) Run `git status` to confirm before assuming this list is current.

---

**Elastic-rooms batch ① — all room presets rectangularized (branch
`elastic-rooms`).** Living 7×6L(36) → 7×5(35), Kitchen 5×4L(16) → 4×4(16),
Bedroom-L 6×6L(30) → 6×5(30), Recreation 6×5L(26) → 5×5(25); everything else
was already rectangular. Rectangles are the SEEDS for the coming derived
"elastic room" expansion batch — no expansion behaviour exists yet. Absorbed
ripples: prop layouts re-authored per rect (kitchen counter deliberately on the
north wall, opposite the south-biased window; the `tileRun` remainder-facing
bug this exposed is fixed in place.ts); windows re-derive per area and were
verified sane per type; mirroring is shape-preserving on rects (machinery
untouched); old saves load tolerantly with a skipped-room toast (see §3). Rules
untouched (they reference type categories via `ctx.is.*`, never shapes).
Verified: 15/15 harness checks (footprints × 4 rot × mirror through the real
place path, occupancy + readout bbox, windows per type, interlocked-old-save
drop, bridge export on rect presets) + real-UI screenshots of all four
furnished types, a rotated+mirrored placement, the selection readout ("5×7" at
90°), and the toast path.

## 7. Future extension points (scaffolding already in place)

- **Door-based adjacency: DONE** (§2i) — authored doors drive `GraphEdge.viaDoor`
  ACCESS edges; the `ConnectionEdge` scaffolding it was reserved for is removed.
- **Door swing/handedness: DONE** (§2i swing) — `Door.swing` (hinge + into),
  privacy-based default, S-key cycle, plan-view arcs. Remaining door extensions:
  variable-width (1-edge / wider) doors — v1 is fixed at a 2-edge span; a 3D leaf
  (swing is a plan symbol only today, no swept 3D door panel); and **SIA 500
  swing-clearance checks** — validate the leaf's swept quarter-disc against fixed
  props / the opposite wall (needs door-aware prop placement first, see below).
  Doors are absolute edge-bound, so they inherit mirror/rotation for free.
- **Facade/window placement:** reuse `exteriorEdges()` (already the shared
  primitive for entrance placement, entrance validity, and D1/D2) to place
  windows/doors on a room's exterior edges.
- **Furnishing rooms: DONE for all room types** (§2l) — Kitchen + Bathroom/
  Bedroom/Living/Recreation have `PROP_BUILDERS` layouts; only Circulation/
  Outdoor connectors are unfurnished (empty shells, by design). Remaining prop
  work: (a) **door-aware prop placement** — props are static baselines and a
  fixture may sit in front of a later-placed door (or a window); placement
  ignores authored doors/windows today. (b) A **translucent prop material layer**
  so glass fixtures (shower panels) can reuse the real glazing material instead
  of a solid glass-tint colour. (c) SIA 500 swing-clearance checks against props
  (see Track B's future note). (d) Slimming the solid baseline props (hollow
  shells) if instance count matters.
- **Cluster-wall selection friction** (see §6) — make cluster walls map back
  to a piece if desired.
- **Space-syntax depth metric** (`computeEntranceDepths`) is deliberately
  decoupled from the violation list — kept as a standalone reusable function
  in case future analysis wants the raw per-room hop counts.
- **Group re-pose** (§2h): rotating/mirroring a multi-selection as a rigid unit
  about a common centre was explicitly scoped OUT for v1 (R/M require exactly
  one selected instance). `ModuleStore.moveMany` only ever touches `origin` by
  design (never `rotation`/`mirrored`), so this would need a new method, not
  an extension of the existing one.
- **Marquee (rubber-band) selection** (§2h): skipped because plain left-drag on
  empty ground is already the camera-orbit gesture; a Shift+drag-on-empty-
  ground variant (shift is currently unbound for drags, only for clicks) would
  sidestep the conflict and is the natural next step if marquee is wanted.

**Future-gated rule / analysis proposals** (surfaced during the batch-④ review;
recorded so they survive context loss — NO code exists for these yet):
- **Orientation-dependent daylight: DONE** (§2k) — the north concept now exists
  (`orientation.ts` + project `northAngle`); OR1 flags north-only-lit rooms and
  the generator biases glazing south. Remaining orientation extensions: a fuller
  daylight-QUALITY model (per-sector solar-gain scoring, seasonal angles) beyond
  OR1's single north/not-north heuristic.
- **Full egress analysis** — F1 is honestly just topological hops; real fire
  egress wants a SECOND independent escape route per room and METRIC travel
  distance (~35 m class), not one BFS to the nearest exit.
- **SV1 — structural stacking** — flag upper-floor cells cantilevered beyond the
  floor below (no load path down); needs a cross-floor footprint-overlap check.

---

## 8. Layout rules — current table (`src/core/rules.ts`)

**39 rules as of this session.** Two were added for the INTERFACE level, and both
read CELL GEOMETRY rather than only the access graph, which departs from the other
37 on purpose: each asks where something sits in the plan, and neither question
survives being reduced to a node and its edges. Both read `GraphNode.cells` /
`GraphNode.hasFacadeEdge`, so nothing was added to `RuleContext`.

| ID | Severity | Rule |
|---|---|---|
| WET1 | 🟡 soft | Wet rooms (`WET_TYPES` — bathrooms + kitchen) form more than one connected group on a floor. 4-neighbour connectivity via the shared `connectedComponents` (cluster.ts); corner contact does not connect. One violation per floor, naming the group count and each group's min-cell. Scoped to ONE floor — whether wet cells stack across storeys is a separate question. Carries its reason: long installation runs, shafts that cannot bundle. |
| FAC1 | 🔴 hard | A habitable room (`ctx.is.habitable` — bedrooms, living, recreation) has no facade edge. Reads `GraphNode.hasFacadeEdge`, derived in adjacencyGraph.ts with the same `isFacadeEdge` the interface view uses. Kitchens are excluded on purpose (wet, and an interior kitchen is common practice); D2 covers them softly. Description ends with the citation `(PBG LS 700.1 § 302)`. |

`README.md`'s rule table is generated from `RULES` and now lists all 39; before this
session it listed 24 and included a phantom `S4`.

**ST3, the stair root-cause rule (run 0012).** Hard. A dwelling whose occupied floors
are not all reachable by stairs from the ENTRANCE floor fires ONE violation naming the
cut-off floors, instead of the report restating the same cause once per space on them.
`computeDisconnectedFloors` (rules.ts) builds floor-level adjacency from the ACCESS
graph's `viaStair` edges, which are already door-gated, floods from the floor(s) carrying
an entrance, and returns the occupied floors it never reaches. It returns empty for a
single-floor dwelling or one with no entrance, because E1 owns that case.

The gating follows E1's precedent exactly and adds no engine machinery: the fact lands on
`RuleContext.disconnectedFloors` and H1, C1 and OD1 each add one `.filter()` consulting
it, the same way the reachability family consults `hasEntrance`. A1 deliberately keeps
firing, because a corridor's width is true whether or not anyone can reach it.

Measured on `testflats/flat-1-two-storey.json` and its derived `flat-1-no-stair.json`:
the connected fixture is unchanged at `12 issues (1 hard, 11 soft)`, so ST3 is silent and
nothing was suppressed; the no-stair fixture reads `7 issues (1 hard, 6 soft)` with H1 and
C1 replaced by the single ST3 line. WET1's floor-0 line is byte-identical across both,
which is the invariant a stair should not affect.

**E1 is now HARD** (`rules.ts`, entrance prerequisite). It was `note`, meaning
"validation could not run"; under the interface reading of a unit the entrance is what
the flat offers the building, so its absence is a failure of the binding level. Base
description is now `No entrance defined — the entrance is the unit's interface to the
building.`; the all-entrances-blocked variant message is unchanged. E2 was already hard
and is untouched. The concern that a hard severity would fire during authoring does not
apply: rules evaluate only when Check Layout is pressed. Measured on an empty floor with
no entrance, the counts line reads `3 issues (3 hard)` (E1, P1, P2).


All rules are **advisory** (never block placement), run on-demand via
"Check Layout", and read the whole-dwelling graph (§2c/§3). This table must match
`RULES` in `rules.ts` exactly — if you add/remove/reword a rule, update this table
in the same change.

**Tier taxonomy** (the definitive meaning of each severity, at the top of
`rules.ts` — classify new rules by it): 🔴 **hard** = renders the dwelling
uninhabitable or violates near-universal code (expert failure modes, program
completeness, daylight physics, direct hygiene access); 🟡 **soft** = deviates
from empirical practice or comfort norms (House-GAN frequency data, SIA comfort/
acoustic practice); 🟢 **note** = characterization, not judgment (a recognised
typology — open-plan, en-suite, efficient services).

**Entrance validity**
| ID | Severity | Description |
|---|---|---|
| E1 | 🟢 note | Place an entrance to validate circulation/reachability. |
| E2 | 🔴 hard | Entrance is blocked — its edge no longer faces outside. |

**Doors (reachability prerequisite — the door-based cutover)**
| ID | Severity | Description |
|---|---|---|
| DR1 | 🟢 note | No doors placed — reachability requires doors. (Fires only when rooms exist but `doorCount === 0`; explains the H1 flood on a doorless dwelling, shown ALONGSIDE the real flags.) |
| DR2 | 🟢 note | Bedroom has ≥3 doors (access edges) — unusual for a private room (erodes furnishability/privacy). |

**Program completeness**
| ID | Severity | Description |
|---|---|---|
| P1 | 🔴 hard | A dwelling needs a bathroom. |
| P2 | 🔴 hard | A dwelling needs a kitchen. |
| P3 | 🟢 note | More than one kitchen — atypical, but not a problem. |
| P4 | 🔴 hard | A dwelling needs a bedroom — place one so the flat has somewhere to sleep. |
| MB1 | 🟡 soft | A floor has bedrooms but no bathroom (nighttime stair trip). GATED on P1 silent (a bathroom exists somewhere) — never double-fires with P1 on a bathroom-less flat. Per-floor. |

**Reachability** (entrance-rooted, whole dwelling, DOOR-BASED — traverses ACCESS/`viaDoor` edges only, across door-gated stairs; corridors NOT required). The blocked-BFS family (H2/H3/H6/G1) EXEMPTS the seed/root node from blocking — you enter *through* the host by definition, so an entrance ON a bedroom/bathroom/outdoor space doesn't detonate every room; G2 is the gentle signal for that typology.
| ID | Severity | Description |
|---|---|---|
| H1 | 🔴 hard | Orphaned room — no path of DOORS (including door-gated stairs) reaches an entrance. |
| H2 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bathroom (host bathroom exempt). |
| H3 | 🔴 hard | A room or stair reachable from an entrance only by passing through a bedroom (host bedroom exempt). BATHROOM targets are ALSO exempt — that's the en-suite typology → S7, not a failure; H3 still fires for other rooms + stairs. |
| H6 | 🔴 hard | A room or stair reachable from an entrance only by passing through an outdoor space (host exempt). |
| ST2 | 🔴 hard | Stair not reachable from any entrance (via doors). |
| ST3 | 🔴 hard | A floor is not reachable by stairs from the entrance floor. Fires ONCE for the whole dwelling; H1, C1 and OD1 stay quiet about spaces on that floor (`ctx.disconnectedFloors`), since they would all restate the same cause. A1 keeps firing, because a corridor's width is true whether or not anyone can reach it. |

*(H5 does not exist — ids are not contiguous; do not add one without a reason.)*

**Adjacency / privacy** (H4 reads the door ACCESS edge — hygiene is about access, not masonry; S3 reads PHYSICAL touch; S5/S6/S7 are typology NOTES; G1 door-based reachability; G2 entrance-host)
| ID | Severity | Description |
|---|---|---|
| H4 | 🔴 hard | Direct DOOR between a bathroom and a kitchen — food prep opening onto a toilet. (Was touch-based; a shared WALL is now the positive S6.) |
| S6 | 🟢 note | Shared wet wall between kitchen and bathroom (touch, no door) — efficient services / stacked plumbing. Excludes any H4-doored pair. |
| S3 | 🟡 soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (physical touch). |
| S5 | 🟢 note | Kitchen and living room connected by a DOOR — open-plan; noted, not a problem. (A sealed touching wall earns no note.) |
| S7 | 🟢 note | En-suite bathroom (accessed via bedroom) — the typology H3 exempts; acknowledged, not flagged. |
| G1 | 🟡 soft | No bathroom is reachable without passing through a bedroom (guest access). |
| G2 | 🟡 soft | Entrance opens directly into a private room (bedroom or bathroom). |
| AC1 | 🟡 soft | Bedroom shares a wall (touch) with a stair — stair noise against a sleeping room (SIA 181). Scoped to stairs only (bedroom↔public is S3). Replaces the old ungrounded S4 (two bedrooms touching). |

**Corridor justification** (circulation clusters; degree counts DOOR connections)
| ID | Severity | Description |
|---|---|---|
| C1 | 🟡 soft | Orphaned corridor — connects to nothing via doors (dead space). SOFT (was hard) — matches O1, the identical degree-0-cluster condition; dead space is a design flaw, not uninhabitability. |
| C2 | 🟡 soft | Under-used corridor — reached by only one door, so it doesn't circulate. |
| OD1 | 🔴 hard | Outdoor space is not reachable from the dwelling. |
| A1 | 🟡 soft | Circulation narrower than 1.2 m (below accessible width, SIA 500). Per circulation cluster: a cell is accessible-width iff it lies in ≥1 **2×2 block of cells fully inside the same cluster** (`narrowWidthCells`); a cluster with ≥1 narrow cell flags (message includes the narrow-cell count). A 1-wide corridor flags every cell (L-corners included — neighboured on two axes but never in a full 2×2 square); a 2-wide corridor passes; a wide hall with a 1-wide spur flags only the spur. Resolves the doors-are-1200mm-but-corridors-could-be-600mm contradiction. Circulation clusters only. |

**Stairs**
| ID | Severity | Description |
|---|---|---|
| ST1 | 🟡 soft | Stair has no DOOR connection on one or both floors it should link (top/bottom). |
| ST2 | 🔴 hard | (see Reachability above) |

**Daylight / ventilation / glazing / orientation** (D1/D2 reuse `GraphNode.hasExteriorEdge`, §2c; W1/OR1 reuse `GraphNode.glazing`, §2d/§2k)
| ID | Severity | Description |
|---|---|---|
| D1 | 🔴 hard | Habitable room (bedroom, living room, or recreation room) has no exterior wall. |
| D2 | 🟡 soft | Kitchen has no exterior wall. |
| W1 | 🟡 soft | Room's glazing is below its daylight target (too little glazing on the exterior walls it HAS). GATED on `hasExteriorEdge` — a room with no exterior wall is D1/D2's (avoids a double-flag on the same void-facing room). |
| OR1 | 🟡 soft | Habitable room or kitchen is lit ONLY from the north (every windowed edge within `NORTH_SECTOR_HALF_WIDTH` = 45° of due north under the project north). Reads `glazing.northLit`, TRUE only when glazing EXISTS and is all-north — so a NO-glazing room can't fire it (D1/W1 own that; no double-fire). Heuristic (solar-access practice at this latitude), not code. §2k. |
| OR2 | 🟡 soft | Room's glazing faces ONLY the orientation the project asks to avoid (`OrientationPreference.avoid`, core/orientation.ts). Preference rather than law, so no citation. Silent when no preference is set, and silent on a room with mixed glazing, which still gets its other sun. |

**Room-count / connectivity balance** (S1/S2 count ACCESS/door degree — a *connected* hub; House-GAN anchors were proximity-based, so approximate under door semantics)
| ID | Severity | Description |
|---|---|---|
| S1 | 🟡 soft | Outdoor/balcony over-connected (>2 doors) — usually a leaf space. |
| S2 | 🟡 soft | Living room under-connected (≤1 door) — typically a social hub. |
| O1 | 🟡 soft | Outdoor space is unreachable — no door connects it to the dwelling (the outdoor analogue of C1; distinct from S1's over-connection). |

**Space-syntax depth + efficiency metrics** (informational lines in the report; `computeEntranceDepths` / `computeCirculationFraction` / `computeCirculationFractionByFloor` / `publicVsBedroomDepth` in rules.ts, §3)
| ID | Severity | Description |
|---|---|---|
| DP1 | 🟡 soft | Room is unusually deep in the layout (≥`DEEP_ROOM_THRESHOLD_HOPS` = 5 hops from the entrance). |
| N1 | 🟡 soft | Circulation-heavy layout — circulation fraction > `CIRCULATION_FRACTION_MAX` = 0.25, checked WHOLE-DWELLING and, independently, PER FLOOR on a multi-floor dwelling (different granularity — a floor can trip its own flag while diluted under the whole-dwelling average, or vice versa; both may fire together). Fraction = (circulation-cluster + stair-footprint cells) ÷ all occupied cells, OUTDOOR excluded from BOTH sides. Per-floor is SUPPRESSED on a single-floor dwelling (would duplicate the whole-dwelling figure). The %(s) are ALSO surfaced as always-on report lines ("Circulation: N% of interior area", plus "Floor 0: N% · Floor 1: N%" once there's more than one floor). |
| PG1 | 🟡 soft | Inverted privacy gradient — mean depth of PUBLIC rooms (Living/Recreation) exceeds mean depth of BEDROOMS (bedrooms shallower than social rooms). Silent if either set is empty; gated on an entrance. Both means are surfaced as a report line ("Public mean depth X · Bedroom mean depth Y"). Hillier & Hanson genotype. |

**Egress — travel distance to an exit**
| ID | Severity | Description |
|---|---|---|
| F1 | 🟡 soft | Room is far from any exit (> `ESCAPE_DEPTH_MAX` = 4 hops from the nearest entrance OR stair). Multi-source 0-1 BFS over ACCESS edges (`accessDepths`), seeded at every entrance host AND every stair (a stair is vertical egress), reusing the shared stair-hop weighting; gated on an entrance. HONESTLY SIMPLIFIED — a topological hop count, NOT metric distance; full egress (second escape routes, ~35 m travel distance) is future-gated (§7). OVERLAPS DP1 deliberately: same numeric ceiling, different seed sets (F1 = entrances+stairs/egress; DP1 = entrances only/livability) — they correlate on single-floor dwellings and diverge on multi-floor (an upper room is deep from the entrance yet near its stair), which is F1's value. |

**Depth STAIR-HOP weighting** (`accessDepths`, which `computeEntranceDepths` now
wraps by seeding at the entrance set — F1 wraps it seeding at entrances + stairs):
a stair is a graph NODE, so a naïve BFS makes a floor transition room→stair→room
cost TWO hops and drifts upper rooms toward the DP1/F1 thresholds by merely
existing. A floor transition should cost ONE hop, so ENTERING a stair costs 1 and
LEAVING one costs 0 — a 0-1 BFS over a deque (0-cost relaxations to the front).
`DEEP_ROOM_THRESHOLD_HOPS = 5` / `ESCAPE_DEPTH_MAX = 4` are UNCHANGED; this
restores their single-floor meaning across floors. Verified: room→stair→room = +1
hop (was +2); depth badges / the report's depth section shift on multi-floor
layouts, intended.

Recreation Room is classified as **public/social** (`ctx.is.public`, same
category as Living Room) for the privacy rules, and as **habitable**
(`ctx.is.habitable`, same category as Bedroom + Living Room) for D1.

**Consistency-pass finding — RESOLVED (batch ③):** C1 (orphaned corridor) was
🔴 hard while O1 (unreachable outdoor) is 🟡 soft, though both flag the identical
degree-0-cluster condition. **C1 is now 🟡 soft** — dead space is a design flaw,
not uninhabitability — so the two are consistent.

**Report info-lines** (`validationPanel.ts`, computed from the graph like the
depth summary, always shown when available): "Circulation: N% of interior area"
(N1's metric, `.vp-metric`), immediately followed by a per-floor breakdown line
("Floor 0: N% · Floor 1: N%", `computeCirculationFractionByFloor` — see §2d's
N1 rider) once the dwelling has more than one floor; a "Glazing orientation"
section listing each windowed room's compass sectors ("Living Room: glazing S +
E", `appendOrientation`, from `node.glazing.sectors` under the project north —
OR1 reads the same data, §2k); and "Public mean depth X · Bedroom mean depth Y"
(PG1's metric, in the depth section). All surface the raw figure whether or not
the corresponding soft rule fires.

---

## 9. The flat → building bridge (`dwelling-unit` v1 export)

**Format source of truth: `docs/bridge-format.md`.** The consumer is the
chair's separate `bottom-up-design` repo (building-scale packer; local copy at
`..\modelstadtt\bottom-up-design-main`, branch `bridge-flat-import`), which
gained its first import + entrance-constrained corridor routing + a
burial-of-authored-intent fitness term. The JSON file is the ENTIRE interface
— neither codebase imports the other.

**The design decision (overrides the merge analysis's proposal #1 direction):**
the bridge runs **flat → building**. The inhabitant designs the dwelling in
Re_Configure FIRST; the building packer aggregates authored dwellings. This is
the thesis philosophy — the building aggregates bottom-up intent, it does not
hand down envelopes. Consequences: Re_Configure is the EXPORT side (a second
format beside the project file — the project format is untouched); the
building never mutates a flat's interior (a placed unit is inviolable); edge
classifications flow upward as requirements (glazed/open want facade, the
entrance needs corridor, blank is party-wall material); and
advisory-not-blocking holds at both scales (the packer scores against burying
authored intent — it never forbids it — and reports the conflict).

**Export path** (`src/core/unitExport.ts`, driven since run 0019 by the ONE
save dialog — `#save-dialog` in index.html, `runSave` in main.ts, §11. The
`buildUnitExport` contract below is unchanged by that; only its trigger moved,
from a dedicated "Export unit" menu item to a checkbox):
- Envelope per storey = the `buildSpaceTargets(floor, floorBelow)` key set —
  the same single source of truth doors/windows use (rooms + clusters +
  stairs + stair-hole projections), so the void over a stair is part of the
  unit's volume.
- Edge classes (priority entrance > glazed > open > blank): `entrance` = a
  NON-blocked authored entrance (re-validated via the graph's
  `EntranceStatus.blocked`, never the raw list); `glazed` = `computeWindows`
  re-run with EXACTLY the wall-pass inputs; `open` = exterior edge of an
  Outdoor cluster; else `blank`.
- Normalization: ONE translation per unit (min corner over the UNION of all
  storeys), cells and edges alike — storeys keep mutual registration (stair
  position); verified with a 2-storey flat whose storey-1 normalized min is
  [5,0], not [0,0].
- Name + colour are EXPORT-TIME dialog inputs (deterministic default colour by
  name hash), NOT project-file fields. `sourceProject` embeds a byte-identical
  normal save; `northAngle` is carried top-level (informational).
- HARD gates (toast + refuse): ≥1 non-blocked entrance on floor 0 (points at
  E2); every storey edge-connected + non-empty (trailing empty floors
  trimmed). Hard RULE violations only produce a confirm — advisory stance,
  export proceeds on OK.
- Export is READ-ONLY: verified no store change (serialize before/after
  identical) and no history snapshot (one undo after export drains the stack).
- `FloorManager.floorHeightOf(floor)` is the public accessor added so the
  exporter can carry per-storey heights (3.0 m at defaults).

**Units as made — `cellRooms` + `roomTypes` (additive, still v1).** The export
carries the flat's ROOM MAP, so the building can show a dwelling as its author
configured it rather than as a monochrome token:
- `storeys[].cellRooms` — index-parallel to `cells` exactly like `cellKinds`:
  the **module type id** owning each cell (`"living"`, `"bathroom_large"`,
  `"circulation_single"`, `"outdoor_double"`, `"stair"`). The FINE layer;
  `cellKinds` stays the coarse one (four classes, enough to carve a balcony).
  Elastic rooms label their GROWN cells with the owner's type — the effective
  occupancy is what exists, and the seed/claimed distinction does not cross the
  bridge.
- `roomTypes` (top level) — `{id, name, color}` for every id used, sorted by
  id. The building reads colours from HERE and never keeps a copy of this
  catalog, so the two apps cannot disagree about what a colour means.
- The two layers are derived from ONE `effectiveOwnerAt` lookup per cell
  (`kindOf(def)` + `def.type`), so they agree by construction; the exporter
  then ASSERTS the agreement per cell and fails the export with a reason rather
  than shipping a contradictory file.
- Both OPTIONAL, both purely additive, `"version": 1` untouched: a v1 importer
  that ignores them produces byte-identical results (verified by the stash
  method — the export with the two fields stripped is byte-identical to the
  pre-change export on the same fixture).

**`openCeilings` (run 0021, still v1).** `storeys[i].openCeilings` is the list
of cells of storey i over which no floor is drawn between it and storey i+1,
in the same normalized space as `cells`. It answers the building app's own
question, which is per cell: does the floor above this cell exist. Chosen over
a room-level "this room is double height" property because a room-level flag
would make the consumer re-derive which cells a room covers and which storey it
sits on, which is exactly the relationship a bridge loses; the per-cell list
needs no inference and absorbs stairwells, which open a ceiling for a different
reason and are the same fact to a reader. Derived from
`FloorManager.voidCells`, translated by the same single unit normalization as
`cells` and `edges`, and EMPTY on the top storey because the roof is out of
scope. Optional and additive, so absent means every seam is floored, which is
what every pre-0021 file meant: version stays 1.

**Recorded v1 orientation limitation:** glazed edges were derived under the
flat's authored `northAngle` (south bias). The packer may rotate units through
the 4 quarter-turns (edge metadata rotates too; NEVER mirrored — a flat is
chiral), which changes the glazing's real-world bearing, and v1 does not score
orientation (future `SunPosition` upgrade). Any future click-through from a
placed unit back into this editor must COMPOSE the placement rotation into
`northAngle` so re-derived windows match the as-built unit (spec'd in
docs/bridge-format.md; not built).

---

## 10. The unit library (`public/units/` + `src/library/` + the dev save sink)

**Doc source of truth: `docs/library-format.md`** (folder layout, manifest
schema, module interface). Added in run 0018 after the 4 August guest review
froze layout-rule work and set a visual browser of saved units as the first
priority. The library entry IS the `dwelling-unit` export file unchanged — one
file serves both apps because it already embeds a full save in
`sourceProject` (§9); the format stays at v1 and `docs/bridge-format.md` is
untouched.

**Storage** — `public/units/`: one `<id>.json` (dwelling-unit) + one
`<id>.jpg` (canvas-captured preview) per unit, plus `index.json`, the manifest
(`{format: "unit-library", version: 1, units: [...]}`; per entry `id`, `name`,
`color`, `file`, `preview`, `storeys`, `areaM2`, `savedAt`). Under Vite's
`public/` root deliberately: served statically at `/units/…` in dev AND copied
verbatim into `dist/units/` by a production build, with zero build-config
change. `storeys`/`areaM2` are derived server-side from the posted unit file
(areaM2 = all-storey cell count × 0.36, rounded to 2 dp — a GROSS figure), so
the manifest cannot drift from the file it points at.

**Ids** (`src/library/ids.ts`, pinned by `ids.test.ts`): lowercase slug of the
display name (`[a-z0-9-]` runs), numeric suffix on collision — two saves under
one display name coexist as `<slug>` and `<slug>-2`; files are named by id;
nothing is ever overwritten (the old Unit_2 name-clash fix). Verified live
under a 6-save burst: six distinct suffixed pairs, zero overwrites.

**Save flow** — since run 0019 the library entry is one CHECKBOX of the single
save dialog (§11); `saveLibraryEntry` in main.ts renders one frame, reads
`canvas.toDataURL("image/jpeg", 0.9)`, and BYTE-CHECKS it (≥1000 bytes; a
hidden canvas "succeeds" with an empty image — same trap as `__app.capture`).
DEV: POST `{name, color, unit, preview, replace}` to `/__library/save` — the
`library-sink` plugin in vite.config.ts (`apply: "serve"`, beside the
capture-sink) assigns the id (manifest ids ∪ stray file basenames), writes the
pair, appends the manifest entry, re-byte-checks server-side. PROD: no sink,
so the same checkbox downloads `<slug>.json` + `<slug>.jpg` and its result line
says they belong in `units/` beside a hand-added manifest entry (slug without
suffix — only the dev server owns the manifest).

**Replace or new, and rename (run 0019).** With `replace: true` the sink
overwrites the entry matching the name IN PLACE (`findEntryIndex`, id match or
exact name match), keeping its id so the filenames it points at stay valid;
only payload, colour and `savedAt` move, and the reply carries
`replaced: true`. Without it the suffixed-id path runs and a second entry
appears, which is what happens when the author declines the prompt.
`POST /__library/rename` with `{id, name}` changes an entry's DISPLAY NAME
only, updating the manifest row AND the unit file's own `name` (the building
reads the latter), leaving the id and both filenames alone so the number the id
carries is not silently freed.

**Browser** — the "Units" top-bar button toggles a viewport-overlay panel of
cards (preview, name, colour chip, storey count, area; two actions since run
0019, "Open a copy" and "Rename"). Open fetches the entry's unit file and hands
it to main.ts, which extracts `sourceProject` and feeds `importProjectText` —
the NORMAL import path, replace-confirm included (`importProjectText` returns a
boolean: loaded or not, so a declined confirm leaves the panel open). The
opened design belongs to the user; saving it back under the same name offers to
REPLACE the entry (run 0019) rather than silently adding a second one.

**The reusable boundary** — `src/library/` is self-contained: plain TS + DOM,
no imports from app internals, styles injected under a `ulb-` prefix reading
the host's tokens with hardcoded Paper-studio fallbacks. `createUnitBrowser({
manifestUrl, onOpen(file, entry), onRename?(entry, newName), mount? }) → { el,
open, close, toggle, refresh, isOpen }` — `onRename` is OPTIONAL and the cards
are read-only without it, which is how a production build (no dev server, no
writable manifest) gets the same module. `manifest.ts` exports
`parseUnitLibraryIndex` (throwing validator, used by the browser AND the
manifest test); `ids.ts` and `naming.ts` as above. The bottom-up repo builds
its unit list against `docs/library-format.md`, lifting the module or just the
schema.

**The neighbours' flats (run 0023).** `createUnitBrowser` takes an optional
`session: { stateUrl(): string | null; flatUrl(id): string }` (`SessionSource`,
`src/library/unitBrowser.ts:42`). When given, the panel's body is two groups in
one scrolling column, **In this session FIRST** (the library's eight cards
would push it below the fold every time) and Library second
(`unitBrowser.ts:263-275`). The session group fetches `stateUrl()` (the store's
poll, `GET /api/session/{code}`, §12) when the panel opens and on its own
Refresh control, never in the background (`refreshSession`,
`unitBrowser.ts:455`); it says "No session set…" in one line when `stateUrl()`
is null, "Nobody has published to <code> yet." when the poll is empty, and
otherwise one `ulb-session-card` per flat (`sessionCard`, `:380`): label, a
`v<n>` tag, a `changed since last building` tag when `changed`, and a meta line
`<resident> · <floors> storey(s) · <areaCells×0.36> m²`. No preview image (the
store keeps none). "Open a copy" fetches `flatUrl(id)` and hands the text to
the SAME `onOpen(file, source)` the library cards use, with `source` now
`UnitManifestEntry | SessionFlat` (`SessionFlat` is declared in the module,
`:27`, so it stays liftable). main.ts wires `stateUrl`/`flatUrl` to
`/api/session/<code>` on the same origin from the session settings
(`main.ts:1328-1331`). Library cards, rename and the manifest are untouched.

**One axonometric for every flat, through one function (run 0024).**
`captureFlatPreview` (`main.ts:774`) is what both `saveLibraryEntry` and a
session publish call for their picture, replacing the old behaviour of
rendering whatever angle the live camera happened to be at. It borrows the
live scene for one frame: forces every floor VISIBLE and un-DIMMED
(`Floor.setDimmed(false)`, since a floor other than the active one normally
renders translucent — `FloorManager.applyDim`, `floorManager.ts:847` — which
without this showed as a ghostly double exposure over a two-storey flat's
ground floor the first time this was tried), cutaway and the Seeds/Structure/
Interface overlays off, the renderer's pixel ratio set to 1 and its canvas
resized to a fixed 800×600 so the picture is never stretched or cropped to
whatever the live window's aspect happens to be, frames the result with
`axoFrame` (`src/core/previewFrame.ts`) over `floors.contentBox()`, renders
one frame, and reads `canvas.toDataURL("image/jpeg", 0.9)`. Every piece of
state it touches — camera position/up/zoom/`viewSize`, `controls.target`,
per-floor visibility, the dim state, the renderer's pixel ratio and the
canvas's CSS size — is read before and restored exactly after, proven live
by mutating the camera to an arbitrary pose, capturing, and reading the
state back byte-identical to JSON. `axoFrame` restates (never imports)
`sceneSetup.ts`'s `ISO_ELEVATION`/`ISO_AZIMUTH`/`FRAME_MARGIN`, so `src/core/`
stays free of the scene layer; `previewFrame.test.ts` pins its direction
(the closed form `(1/√3, 1/√3, 1/√3)`), centre and `viewSize` against a known
box, no THREE or DOM involved.

**Every committed library JPEG was re-rendered through it once**, via a
DEV-ONLY pair added for the job:
`window.__app.loadAndCapturePreview(sourceProject)` loads a project and
captures its preview in one call (no confirm,
no toast — a batch tool, not a user import), and `POST /__library/preview`
(`vite.config.ts`, beside `/__library/save`/`/__library/rename`) overwrites
an existing entry's JPEG in place by id, touching nothing else in its
manifest row. Run once over the seven committed entries
(`flat-2-single-storey`, `flat-3-terrace`, `unit-1` through `unit-5`); all
seven succeeded and `index.json` is unchanged beyond what was already
pending before the run.

**The session card shows it too (run 0024).** `SessionFlat` gained a
`preview: boolean` (`unitBrowser.ts:27`, mirroring the store's `FlatSummary`);
`SessionSource` gained `previewUrl(id)` (`:45`); `sessionCard` renders an
`<img class="ulb-preview">` — the SAME class a library card's image uses,
so the two read as one system — only when `flat.preview` is true, and adds
`ulb-no-preview` to the card otherwise so the CSS padding compensation
(`:170`) applies only to the cardless case. A flat published before this run
still shows no picture at all, which is honest: no preview was ever sent for
it.

**Whose flat is this (run 0025).** Every session card gained a second line
under the label, at the card's normal 12px/600 weight (not the smaller meta
size): the flat's `resident`, `sessionCard`. When it matches the name typed
into the save dialog, the card also gets a filled "Yours" badge
(`.ulb-tag.ulb-yours`) and a heavier border (`.ulb-mine`), and the group
sorts that resident's own flats first. Both the match test and the ordering
are pure, DOM-free functions — `isMine(resident, me)` and
`sortMineFirst(items, me)` (a stable sort; everything else keeps the poll's
order) — exported from `unitBrowser.ts` specifically so they can be pinned
without a DOM, which this project's vitest setup does not provide (no
jsdom/happy-dom dependency, and `createUnitBrowser` calls
`document.createElement` the moment it runs). `SessionSource` gained
`residentName()` returning the save dialog's current name, trimmed, or `""`.
`unitBrowser.test.ts` (6 cases as of run 0025, 7 as of run 0026 — one more
for the case-insensitive match) is the ONLY test file for this module,
importing just these two functions and never touching `createUnitBrowser`.

**Ana is ana, and the group's words (run 0026).** `isMine`'s comparison is
now trimmed and case-insensitive (`isMine("Ana ", "ana")` is true), restating
`sameResident` (`src/session/store.ts`) rather than importing it — this
module stays self-contained on purpose (its own file header), so the two
copies are kept in step by hand, not by a shared import. The session group's
heading is "Your group" (was "In this session"); its two status lines say
"No group set…"/"…published to \<code\> yet" (were "No session…"/"…this
session…"). `.ulb-tag.ulb-yours` fills red (`var(--accent)`) instead of ink,
and `.ulb-session-card.ulb-mine`'s heavier border is red too — the brief's
rule that red marks "the resident's own" applies here as much as it does to
the resident's own flat in the building — and every card animates in
(`ulb-rise`, translateY+opacity, an 8-step stagger then a flat cap) rather
than appearing at once. `.ulb-card` itself moved to the brief's card look:
`var(--card, #f4f0e6)` fill, `border-top: 3px solid var(--ink)` and nothing
else (no side borders, no radius), a 1px hairline shadow underneath — the
same look `.card` gives the save column (§11). None of this touches the
manifest, the store, or a library card's own actions.

**Seeds** — `flat-2-single-storey` (69.84 m², pink) and `flat-3-terrace`
(60.48 m², blue), converted through the REAL path (loaded via `?project=`,
saved through the dialog action against the live canvas). The rule fixtures
`flat-1-two-storey`/`flat-1-no-stair` stay OUT of the library (they are the
Check-Layout baselines: 1+11 and 1+6 must-fix/worth-a-look respectively,
re-verified this run).

**Tests** — fast: `src/library/ids.test.ts` (slug + collision),
`src/library/manifest.test.ts` (schema validator + the COMMITTED manifest
through the same parser, cross-checked against the unit files — loaded via
`?raw`/JSON imports, no node types needed under `src/`). Slow:
`src/core/libraryRoundTrip.slow.test.ts` — each committed seed's
`sourceProject` through a real FloorManager (stubDeps, §9's harness) and
re-exported: storeys, edges, roomTypes, northAngle AND sourceProject reproduce
exactly. Suite counts as of run 0018: fast 47 passed (was 33), slow 6 passed +
the standing french-window `it.fails`. As of run 0024: fast 18 in
`naming.test.ts` (was 14), `ids.test.ts` and `manifest.test.ts` unchanged.
As of run 0025: `unitBrowser.test.ts` new at 6 (`isMine`/`sortMineFirst`
only — see "Whose flat is this" above); everything else in this section
unchanged. As of run 0026: `unitBrowser.test.ts` 7 (one more for the
case-insensitive match); the new `src/core/unitStats.ts` gets its own
`unitStats.test.ts` at 4 (see §11). As of run 0028:
`src/core/libraryClean.slow.test.ts` new at 10 (one per unit file plus one that
the glob found anything), which walks EVERY file in `public/units/` and asserts
zero must-fix through `computeDwellingGraph` + `validate`. It carries one named
quarantine, `unit-5.json`, which was already rotten; see §15.

**Delete (run 0029).** Every library card carries a Delete control beside Open
a copy and Rename, for anybody; the architect-only version is a later run. The
wording is a pure helper, `deleteConfirmText` in `unitBrowser.ts`, for the same
reason `takeoverConfirmText` is one (`window.confirm` returns false under
scripting without displaying). A second pure helper, `deleteRefusal`, refuses
the flat whose copy is open in the editor. That needed state the app did not
keep: the editor holds a copy and deliberately forgets which entry it came from
so a later save adds a new entry, so `main.ts` now records `openLibraryUnitId`,
set after a library open succeeds and cleared at the top of `importProjectText`,
the one function every project replacement goes through. A refusal uses
`notice()` rather than `status()`, because `status` replaces the whole grid and
the resident needs the cards in front of them. Persistence is the host's, as
with Rename: `POST /__library/delete` in vite.config.ts removes the row and both
files, dev-only beside the other three sinks.

**The library holds twenty-seven committed flats as of run 0029**, of which
twenty are designed by this project (`unit-8` through `unit-27`). Run 0028 drew
five and run 0029 drew fifteen more and redrew Flat 08.
`src/core/libraryClean.slow.test.ts` names those twenty as well as globbing the
folder, because a glob cannot tell a missing flat from one that was never there.

**The library held twelve committed flats as of run 0028.** The seven that
existed before, plus `unit-8` through `unit-12`, the first generated batch
(§15). The five were not dragged in the editor: `scripts/gen-flat.mjs` wrote
them from bubble diagrams and each was proved against the app's own rules before
it was copied into `public/units/`. Their previews were made the run-0024 way,
through `window.__app.loadAndCapturePreview` and `POST /__library/preview`, and
their manifest rows by the same arithmetic the dev sink uses, so nothing here
took a path the browser does not already take.

---

## 11. One save, three outputs (`#save-column` + `savePlan.ts` + `saveFiles.ts`)

Added in run 0019, from Shrey's own bottleneck: authoring a baseline unit cost
three separate trips through the menu (Export project, Export unit, Save to
library). One dialog now asks which of the three to write and writes them.

**The three outputs stay three separate things**, in the model and on disk. A
project file is the whole design and the ONLY thing that reopens for editing
(§3). A unit file is the contract with the building (§9, `docs/bridge-format.md`).
A library entry is a unit plus a preview plus a manifest row (§10,
`docs/library-format.md`). What collapsed is the doing, not the model.

**The fields** (run 0019; since run 0026 these live folded under the save
column's "More", `#more-body` in index.html — see the run-0026 paragraph
below for the column itself; nothing about the fields' own behaviour
changed, only their container):
- **Design number** — the only text input, `type="number"`, floored at 1 so a
  cleared field cannot write `Flat NaN`. A live line restates what it resolves
  to ("Writes Flat 4 and Unit 4"), so the two names are never a guess.
- **Colour** — as before, proposed by hashing the unit name (`defaultUnitColor`,
  so the same name always proposes the same colour) and left alone for the rest
  of the session once touched by hand.
- **Three checkboxes** — Project file / Unit file / Library entry, each with a
  one-line note saying what that output IS. All three default ON, matching the
  three trips they replace; the choice is REMEMBERED for the session (a plain
  module-level `saveSelection`, never serialized — this is how you save, not
  part of the design), so the second unit costs one click.
- **A result block**, one line per selected output, rendered in the save
  column's "Your group" card (run 0026; was rendered in the dialog itself,
  which stayed open on Save and closed on its own Close button — both gone
  now that the column is always visible, see below). Toasts were wrong here:
  a unit that failed its gate must not read as a project save that failed.

**The naming convention** (`src/library/naming.ts`, Shrey's, 10 August): a name
is a capitalised word, a space and a number. `Flat 4` for the project, `Unit 4`
for the unit and its library entry, ONE NUMBER PER DESIGN across both, ids
following as `flat-4` / `unit-4` through the existing `slugifyUnitName`. The
dialog opens on `nextFreeNumber`, the LOWEST positive integer no library entry
holds, so a run of units needs no typing and a gap left by a deletion is
offered again rather than stranded. The manifest is the only persistent record
the app can read back, so a design saved WITHOUT a library entry does not
consume its number — a real edge, and the honest one.

**Order matters, and it is the point.** `runSave` builds the unit ONCE (both
unit-derived outputs share it), raises the advisory hard-rule confirm at most
once and only when a unit is actually being written, then writes the project
file FIRST and independently. A hard gate failure (no usable entrance,
disconnected footprint) or a declined confirm costs ONLY the unit-derived
outputs; the project file still writes and its line still says so. Verified
live on an empty project: `Project file — flat-4.json downloaded, 1 floor(s),
240 bytes` beside two red lines carrying the gate's own reason.

**Byte identity.** `src/core/saveFiles.ts` holds the two serialization
expressions the retired paths used, carried over character for character:
`JSON.stringify(data, null, 2)` for the project and
`JSON.stringify(file, null, 2)` for the unit. Only the FILENAMES changed, and
deliberately: `flat-4.json` / `unit-4.json` instead of a timestamp, following
the ids. `src/core/saveFiles.test.ts` pins both against the same expressions
and against a committed unit file's own bytes.

**The session fields and the fourth output (run 0023).** Two text inputs at
the TOP of the dialog, `#save-resident` ("Your name") and `#save-session`
("Session code", `index.html:157-160`), remembered in `localStorage` under ONE
key `reconfigure.session` as `{"resident": "Ana", "code": "room-42"}`
(`src/session/session.ts:45-71`, `readSession`/`writeSession`), never in a
project file. A `?session=Room-42` in the URL wins over the stored code, is
lowercased and stored at once (`readSession`, not DEV-gated), and the name
survives. Codes are lowercased on every keystroke (`normalizeCode`), matching
the store. The top bar shows `#tb-session` ("No session", "Session room-42 ·
Ana"; `sessionLine`), muted until a code is set. A FOURTH checkbox, **Publish
to session** (`#save-what-publish`, `OutputKind "publish"`, label "Session"),
is disabled and unticked while either field is empty and its note says why
(`whyPublishDisabled`: "type your name above first" …); when both are filled
it comes back with the remembered choice (`syncSessionUI`, `main.ts:903`;
`readSaveSelection` reads a disabled box as off, `syncSaveDialog` keeps the
remembered value while it is disabled). `needsUnitBuild` counts publish, so a
publish-only save still builds the unit and still raises the ONE rule confirm;
a gate failure or a declined confirm marks publish failed/skipped like the
other unit-derived outputs (`unitGateResults`). In `runSave` publishing is
STEP 4, after the three files (`main.ts:1100-1119`): `publishUnit`
(`session.ts:104`) PUTs `unitFileText(unitFile)`, the unit download's exact
bytes, to `/api/session/<code>/flats/unit-<n>?resident=…&label=Unit+<n>` on
the same origin and returns `{ok, version, …}` or `{ok: false, status,
reason}`. It NEVER throws, so a failed publish is one red line ("not published
— 400 <the store's error>", or "not published — Failed to fetch" at status 0)
and the files already written stay written. The written line reads "Published
as Unit 6 to room-42, version 2" (run 0025 appends " — Open Units to see the
room."; see the UX-pass paragraph below). Since run 0025 the FIRST attempt
never sends `replace=1` itself, even when Replace is ticked: only a 409 with
Replace ticked raises `window.confirm(takeoverConfirmText(owner))`
(`main.ts`), and `decideTakeover` (`session.ts`) turns the answer into a
retry-with-replace, a "not published — you chose not to take over <owner>'s
flat" skipped line, or (anything else) the same reporting this section
already describes. The three download expressions are untouched
(`git diff main -- src/core/saveFiles.ts` is empty; the
`projectFileText`/`unitFileText`/`downloadAs` lines in `runSave` are the ones
on `main`, character for character). `savePlan.test.ts` walks all SIXTEEN
combinations; `session.test.ts` (28 as of run 0025) pins the key, `?session=`, the refusals
and `publishUnit` against a stubbed fetch. Under plain `vite` there is no
function, so publish answers "not published — 404 …"; `netlify dev` (port
8888, `.claude/netlify.cmd`, which clears `PORT` so Vite does not take 8888)
serves the app and the store on one origin.

**Numbers count the room too (run 0024).** `nextFreeNumber` (`src/library/
naming.ts:62`) now takes any number of lists, not one — a rest parameter, so
`nextFreeNumber(entries)` (the pre-0024 call) is unchanged and
`nextFreeNumber(entries, sessionFlats)` counts both. With a session set,
`openSaveDialog` also fetches `GET /api/session/{code}` (`readSessionFlat
Names`, one more request) and proposes the lowest number free in BOTH the
library manifest and the session's own published flats, because a design
number is also a flat's id in the session and every resident reading the
same manifest would otherwise be offered the identical number. The names
line grows one clause when it does: "Writes Flat 6 and Unit 6 — next free
in the library and room-42".

**A flat belongs to whoever published it, and Replace (run 0024).** The
store refuses a different resident's publish over an existing flat id with
409 unless the request carries `?replace=1` (`docs/store.md`, `store.ts:180`).
The dialog surfaces this as the Session result line — "not published — Ana
already owns Unit 6 in room-42; tick Replace to take it over"
(`publishUnit`'s `ownerResident` field, `session.ts:90-157`, set only on a
409) — and a fifth control in the fieldset, **Replace** (`#save-replace`,
`index.html:197-201`), off by default, sent as `&replace=1` when ticked and
reset to unticked after any successful publish (`main.ts:988`, `:1255`) so a
takeover is a deliberate act each time, never a standing default. The SAME
resident republishing their own flat never needs it, exactly as before this
rule existed.

**A UX pass, against `_cowork/ux-guidelines.md` (run 0025, small moves only).**
Three changes, each one or two lines: the two session fields FOLD into one
line once both are already set ("room-42 · Ana, change";
`save-session-summary`/`save-session-fields` in index.html,
`syncSessionFold`/`unfoldSessionFields` in main.ts, re-decided only on
dialog open via the existing `whyPublishDisabled` check, never mid-edit —
"reveal complexity gradually"), shown open the first time since there is
nothing yet to fold; the four (now five, with Replace) checkboxes are
grouped under FILES and SESSION sub-labels inside the same fieldset
("group related information," `.sw-group`); a successful publish's result
line gains one trailing clause, "— Open Units to see the room." ("end
flows memorably," "make completion feel closer"). One CSS bug surfaced
fixing the fold: `.save-session-fields`'s own `display: flex` tied the
default `[hidden]{display:none}` rule in specificity and won on cascade
order, so the fields stayed visible under `hidden`; fixed with an explicit
`[hidden]{display:none}` override at higher specificity. "One primary
button per screen" was already true of both the save dialog (Save vs.
Close) and the Units panel (one action per card, none competing at the
screen level) and needed no change. Guidelines judged NOT to need a move
here: "Make targets large" (buttons already meet a comfortable tap size),
"Follow familiar patterns" (a dialog with checkboxes and a primary button
is the familiar pattern), "Show visible progress" (the pending/written/
failed status classes on each result line already do this). Deferred to a
future run as larger than "one or two lines": an "advanced" fold for
residents in the BUILDING app's own panel (out of scope — this run touches
only the flat app) and ownership-aware defaults on Replace.

**The dialog becomes a column, always visible (run 0026, the brief).**
Read this next paragraph as run 0026's own state: run 0027 kept the panel
and its save but moved it onto step 02 alone, took the flat's own numbers
out of it, and retired the fold and the "Save" toggle described below. §14
is the current account; what follows is how it got there.
`_cowork/design/DESIGN-BRIEF-3sep.md` and its wireframe
(`_cowork/design/wireframe/FlatDraw.dc.html`) wanted the whole save UI
beside the editor, not behind a click. `#save-dialog` (a native `<dialog>`,
`showModal`/`close`) became `#save-column`, an `<aside>` positioned
absolutely over `#viewport`'s right edge (`top/right: 16px`, `bottom: 230px`
— clear of `#view-controls`, the Display/compass card, which is ALSO
`bottom: 16px; right: 16px` and was never moved). No resize or camera-aspect
code changed: the column sits on top of the 3D view exactly the way the
Units panel already does, rather than becoming a flex sibling of the
canvas. `openSaveDialog` keeps its name (it still means "this is stale,
freshen it") but no longer shows a modal; it runs once at startup and again
whenever "More" (below) opens. `#save-close` and the modal's `::backdrop`
are gone — there is nothing left to close.

Three cards, in the brief's order:
- **"Your flat"** (`#flat-card`): the unit's name, three numbers (area,
  storeys, glazing) and a check line. All four are LIVE, read through
  `refreshFlatCard` (`main.ts`) off `buildUnitExport(floors, "", "#000000")`
  — the SAME function a real save calls — so the card can never show a
  number a save would disagree with. `unitStats` (`src/core/unitStats.ts`,
  new; see §2's table and §10) turns a built unit's storeys into area/
  storeys/glazing; the check line reads `validate(computeDwellingGraph(…))`
  exactly as Check Layout does, showing a red "N must fix" chip (`.chip
  .chip-acc`) with the first violation's `description` and a "show me" link
  that calls the SAME `runCheck()` Check Layout's button does, or a green
  "checks pass" chip (`.chip .chip-ok`) at zero. A gate failure (no
  entrance yet, a disconnected floor) shows 0/0/0 and the gate's own reason
  — not an error, an unfinished flat. `refreshFlatCard` is called from
  `commitHistory` itself (`main.ts:140`, one line added) rather than
  `floors.onLayoutChange`: the latter is wired to the room STORE alone and
  never fires for an entrance or a door, where `commitHistory` is the one
  point CLAUDE.md's own convention already routes every mutating action
  through. The area number counts up: `animateCount` (`main.ts`) is a plain
  `requestAnimationFrame` tween tracking each element's currently-shown
  value in a `WeakMap`, so it retargets from wherever the number actually
  is rather than always from zero, and a second edit landing mid-tween
  retargets smoothly instead of restarting. The FIRST version tried the
  brief's own CSS technique (`@property --n`, a `.cnt` class carrying the
  animation, toggled off and on to restart it) and shipped that way; a
  user testing it live found the number restarting from zero on every
  edit, with a visible stutter on rapid ones. The cause: `--n`'s value
  lived ONLY while `.cnt` was applied, so removing that class to restart
  the animation reset `--n` to its registered `initial-value`, zero,
  before the class came back — the CSS never actually remembered a
  "last landed" value at all, which the closed-form keyframe
  (`@keyframes flat-count { to { --n: var(--to); } }`, no explicit `from`)
  had been assumed to provide. The plain JS tween replaced it entirely;
  see the run's own commit, `ui: fix the save column's live feedback`.
  Storeys and glazing are plain text, matching the wireframe (only its
  area number animates).
- **"Your group"** (`#group-card`): the same fold as run 0025
  (`save-session-summary`/`-fields`, `syncSessionFold`, unchanged), then the
  ONE red button, `.btn-send` (`#save-go`, relabeled from "Save"): "Send it
  to your group", an arrow that nudges (`@keyframes btn-nudge`, the
  wireframe's own timing). It is the SAME click handler as before —
  `runSave()` is untouched — so pressing it still writes every OUTPUT
  ticked under "More", publish included; the label is the brief's exact
  words, not a new action. `#save-results` sits under it, unchanged.
  `button.primary`'s OWN look (ink-filled) stays for the one place it is
  still used outside this card, the sidebar's Grid-size "Apply" — an editor
  TOOL, not "the one primary action on a screen" the brief means, so it
  keeps its old look and `.btn-send` is a new class rather than a
  `button.primary` restyle.
- **"More"** (`#more-card`, `.more-card`, a dashed rule instead of the solid
  card-top): folded shut by default (`#more-body[hidden]`, a "+"/"−" toggle,
  `setMoreOpen` in `main.ts`), holding exactly what the old dialog's body
  was — Design number, Colour, and the five checkboxes (Files: Project/
  Unit/Library; Group: Send to group/Replace) — relocated, not redesigned;
  `runSave`/`savePlan.ts`/`saveFiles.ts` never changed. Opening it re-runs
  `openSaveDialog()`, so the proposed number is never stale. The "Save…"
  menu item (`#menu-save`) now opens "More" instead of a dialog that no
  longer exists.

**Three more bugs, found the same way** (a user running the column live,
not by reading the CSS): the column had no minimum-width guard, and
`#save-column input[type="text"]` plus `.save-session-fields`'s two
side-by-side labels had no explicit width between them, so their combined
browser-default intrinsic size ran wider than the column's own 320px and
forced a horizontal scrollbar; both now take `width: 100%`/`flex: 1` with
`min-width: 0`, and `#save-column` itself gains `overflow-x: hidden` as a
backstop. The column also had no way to get out of a resident's way once
open; `#save-column-toggle`/`#save-column-body` (new) fold the three cards
behind one small "Save" tab docked at the column's own top-right corner,
mirroring `#display-header`'s existing header/body pattern — collapsing
does not resize the column's own box, so the empty space below the tab
stays click-through to the 3D view. Last, `#shortcuts-panel` (`z-index: 3`)
rendered UNDER the new column (`z-index: 20`) since both claim the same
right-edge corner; `#shortcuts-panel` is now `z-index: 21`, since opening
it is a deliberate, focused action that should win.

**Words, run 0026** (`_cowork/design/DESIGN-BRIEF-3sep.md`'s Words
section): "Session code" → "Group code"; "Publish to session" → "Send to
group"; its note, "…sent to your group for the building and your
neighbours" (was "…the session…"); the sw-group label "Session" → "Group";
a written publish's line, "Sent to \<code\> as \<label\>[, version N if it
moved] · open Units to see your group" (was "Published as \<label\> to
\<code\>, version N" plus run 0025's "— Open Units to see the room."); its
row LABEL, `outputLabel("publish")` (`src/core/savePlan.ts`), "Group" (was
"Session" — found live, not by the grep audit: the label never contains the
word "session" as a STRING to grep for, only as the `OutputKind` it stands
for). `session.ts`'s `whyPublishDisabled`/`sessionLine` say "group" too (see
§2's table). What did NOT change: every code identifier (`SessionSettings`,
`sessionLine`, `tbSession`, `SESSION_STORAGE_KEY`, every `/api/session/…`
path, `?session=`), the store's OWN error strings (`docs/store.md`'s
contract, untouched beyond `plot` — §12), and the save dialog's
`placeholder="room-42"` (kept as the store's own running example, matching
`docs/store.md` throughout, a judgement call rather than an oversight).

**What was retired** — the `Export project` and `Export unit` menu items and
the old dialog's `Save to library` action, all three subsumed. `Open project`
survives: it is the import, not a save. Three DEAD callbacks
(`onExport`/`onImport`/`onExportUnit`) were also removed from `PaletteDeps`
(`src/ui/palette.ts`) — declared but never used since the reskin moved those
controls to the top bar.

**Purity, and why** — the decision rules are in `src/core/savePlan.ts`
(`planOutputs`, `isEmptySelection`, `needsUnitBuild`, `needsRuleConfirm`,
`unitGateResults`, `outputLabel`) with no DOM, canvas or server, so
`savePlan.test.ts` walks all eight checkbox combinations exhaustively and pins
the survives-a-failed-unit rule directly. main.ts is thin wiring over it.
Suite counts as of run 0019: fast 84 passed in 8 files (was 47 in 5), slow 6
passed + the standing french-window `it.fails`.

---

## 12. The session store (`netlify/functions/session.mts` + `src/session/store.ts`)

**Contract source of truth: `docs/store.md`.** Added in run 0022. A small
shared HTTP store both apps can reach, so five residents in one room can
publish flats into one building without passing files by hand. The flat
configurator will publish to it (run 0023); the building configurator will
poll it (bottom-up 0042). Run 0022 built the store and proved it from the
shell; **run 0023 connected the app**: the save dialog publishes to it (§11)
and the unit browser lists what a session holds (§10).

**Where it runs.** One Netlify Function (v2 style, `export default (req:
Request) => Response`, `export const config = { path: "/api/session/*" }`)
at `netlify/functions/session.mts` (11 lines): it names the Blobs store
(`getStore({ name: "sessions", consistency: "strong" })`) and hands the
request to `handleSession` in `src/session/store.ts` (311 lines), which is the
whole handler. `tsconfig.json` `include` gained `"netlify"` so `tsc` checks the
entry. `@netlify/blobs` 11.0.3 is the one new dependency; `@netlify/functions`
was NOT added (the entry needs no types from it). There is still no
`netlify.toml`: Netlify finds `netlify/functions/` by default and `netlify dev`
detects Vite on its own.

**The `KV` seam** (`store.ts:35-51`): `get(key)`, `getWithMetadata(key) →
{data, etag?}`, `set(key, text, {onlyIfMatch?|onlyIfNew?}) → {modified}`, and
since run 0035 `delete(key)`, which a withdrawn flat needs: an emptied body
would still be a body, and `/export` reads every one of them.
A Netlify `Store` satisfies it structurally (method-parameter bivariance),
so the entry passes the store straight in and `store.test.ts` passes a
`MemoryKV` over a `Map`. This is the one seam that lets the routes be tested
without Netlify.

**Routes** (`ROUTE` regex, `store.ts:84`; codes lowercased, `CODE`
`/^[a-z0-9_-]{1,32}$/`, flat ids `ID` `/^[a-z0-9_-]{1,64}$/i`):

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/session/{code}` | `sessionView`: `{code, flats: FlatSummary[], residents: (Resident & {name})[], building}` — lists on the wire, maps in storage, never a flat body. Unknown code → empty session, 200. |
| `GET` | `…/flats/{id}` | the stored text, byte for byte, `content-type: application/json`; 404 if absent. |
| `PUT` | `…/flats/{id}?resident=…&label=…` | body = the `dwelling-unit` JSON as Export writes it. `parseUnit` checks only `format`, `storeys[].cells` as `[int,int]`; `measure` derives `bbox [minX,minZ,maxX,maxZ]`, `floors`, `areaCells`, `preview` (carried across a republish). Existing id, same resident → version+1, `changed: true`, 200; existing id, DIFFERENT resident → 409 unless `?replace=1` (run 0024, `store.ts:180`, body `{error, resident: <owner>}`); new → version 1, 201. `label` falls back to the unit's `name`. |
| `GET`/`PUT` | `…/flats/{id}/preview` | Run 0024. GET returns the flat's JPEG (`content-type: image/jpeg`); PUT takes the JPEG as the raw body, 404 if the flat itself does not exist yet. Base64 under a key that is a SIBLING of the flat's own (`{code}/flats/{id}.preview`, not a child of it — see Storage layout). Sets `preview: true` on the flat's summary. |
| `PUT` | `…/residents/{name}` | `parseResidentPatch`: only keys present are merged (`counts` map of ints ≥0, `share` 0..1 or null, `ballot` string[], since run 0030 `shareM2`/`extraM2` whole ints ≥0 or null, since run 0031 `wishes` null or all three booleans); each present key replaced whole. Returns `{name, …record}`. |
| `POST` | `…/{code}` | run 0032. Starts the group: writes `startedAt` and answers `201` with its state, or `409` naming the code if `groupExists` was already true. No body, no owner. |
| `POST` | `…/messages` | run 0031. `{who, text}` appended with the store's own `at`; `who` 1-64 printable trimmed, `text` 1-500 stored verbatim and untrimmed. Capped at the last `MESSAGE_CAP` = 200, oldest dropped. Returns the stored message, `201`. |
| `GET`/`PUT` | `…/building` | PUT stores `{genome, summary, by, at: now}` and sets `changed = false` on every flat; GET returns it or `null`. |
| `GET` | `…/export` | Run 0023 (`store.ts:185-195`). The session state plus `bodies: {id: <flat text>}` (every flat blob, as a STRING so the bytes survive; `null` if a blob is missing) and `exportedAt`. The only call that reads every blob; for the end of a session, never for polling. |
| `OPTIONS` | anything | 204, `access-control-allow-origin: *`, methods `GET, PUT, OPTIONS`, headers `content-type`. Every other response carries the same CORS headers, errors included. |

Errors: `HttpError` → `{error}` JSON with 400/404/405/409; anything else 500.

**Storage layout** (Netlify Blobs store `sessions`): `{code}/index` is one
JSON document (`SessionIndex = {flats: Record<id, FlatSummary>, residents:
Record<name, Resident>, building: BuildingRun|null}`); `{code}/flats/{id}` is
the published file's text; `{code}/flats/{id}.preview` (run 0024) is the
base64 JPEG. The preview key is a SIBLING of the flat's key, never a child
of it (`{code}/flats/{id}/preview` would be): Netlify Blobs' local sandbox
maps a key onto a real filesystem path, and `{id}` is already a FILE there
(the flat's own body), so a key needing `{id}` to be a directory hung every
write, reproduced on a fully clean process tree and root-caused by reading
`.netlify/blobs-serve/entries/` directly (`routePreview`, `store.ts:265-296`).

Chosen against the polling call: the poll reads one
small blob (555 bytes for two fixtures, 655 with a run), a publish writes the
flat once and touches only a summary in the index, and a flat body is read
only by the one-flat call. `updateIndex` (`store.ts:223-233`) is a
read-modify-write under the blob's ETag (`onlyIfMatch`, `onlyIfNew` for a
first write), `INDEX_ATTEMPTS = 4`, then 409 — so two residents publishing at
once cannot clobber each other's summary. Store is global to the site
(`getStore`, not `getDeployStore`), so branch deploys and production share
sessions.

**Verbatim, by construction.** The flat's bytes go into their blob untouched
and come back untouched; the store parses them once to measure. The
byte-equality check in `scripts/store-roundtrip.mjs` compares the GET body
against the file that was sent with `Buffer.compare`.

**No auth.** Anyone with the code can read and overwrite everything in the
session. Written down as the limit in `docs/store.md`.

**The building carries its plot, opaque (run 0026).** `BuildingRun` gained
`plot?: Record<string, unknown>`, exactly like `genome`/`summary`: stored on
`PUT …/building` if present (`isRecord` checked — a non-object `plot` is
`400` — but never read inside), returned unread on `GET …/building`, on the
session state as `building.plot`, and on `GET …/export`. Absent when the
building app that wrote a run predates the field, which is the ordinary
case for every run before this one. `docs/store.md` documents it with the
one example the building app is expected to send,
`{"modulesX": 11, "modulesY": 11, "floors": 7}`.

**Ana is ana (run 0026).** `sameResident(a, b)` — trimmed,
case-insensitive — is the store's ownership check now
(`store.ts`: `!sameResident(existing.resident, resident)` replaces
`existing.resident !== resident`), so a republish by "ben" over a flat
recorded as "Ben" is accepted as the same owner, not refused. The name AS
TYPED is still what gets stored and shown; only the comparison folds case.
`src/library/unitBrowser.ts`'s `isMine` restates the identical rule inline
rather than importing it (see §10) — that module is self-contained on
purpose, so `store.ts` stays its one canonical home and the two are kept in
step by hand. Framed by the `design-automation` skill's Production Rules
(IF-THEN) pattern (its §2.1): one rule, "IF two names match trimmed and
case-insensitively THEN treat them as the same resident", applied at the
one real decision point the store owns and restated at the one place a
second module needs the same answer.

**Proof.** `scripts/store-roundtrip.mjs <base-url>` (plain Node, no deps):
fresh session per run, publishes `public/units/flat-2-single-storey.json`
(37484 bytes) as Ana and `public/units/flat-3-terrace.json` (33388 bytes) as
**A group is started on purpose (run 0032).** Before it, a `GET` on an unused
code conjured a group, so one typo started an empty group of one while the
resident believed they had joined the twenty, and nothing could tell the two
apart afterwards. `POST /api/session/{code}` now starts one and `GET` carries
`exists`.

`groupExists(index)` is THE ONE RULE: `startedAt` present, OR at least one flat,
OR at least one resident. The second and third clauses are what make this need no
migration, since every group live in the store was created by the old behaviour
and carries no `startedAt`. The taken-check runs INSIDE the `updateIndex` mutate,
because `updateIndex` re-runs it on a lost ETag race, so two people starting the
same code at once cannot both be told they won.

`exists` was added BESIDE every field the poll already returned and in place of
none, which `store.test.ts` pins by asserting the poll's whole key set. A `GET` on
an unstarted code still answers `200` rather than `404`, because the building app
polls a code before anybody has published to it.

**The three wishes and the group's messages (run 0031).** `Resident` gains
`wishes`, either null or `{corner, terrace, quiet}` all boolean. A PARTIAL object
is a 400 rather than a merge, because a wish that is absent and one that is false
are the same thing to whoever reads them and letting them differ would invent a
third state; `WISH_KEYS` names the three once so the check, the message and
`docs/store.md` agree. Separately, `POST …/messages` appends
`{who, text, at}` to an append-only list capped at 200, oldest dropped. It is the
store's first POST, so `CORS` gained the method. `text` is stored verbatim and
never interpreted, and is NOT trimmed before its length check the way `who` is.

**`sessionView` names its OWN keys one by one.** Run 0030's `shareM2` needed no
line there because it rides in on the resident spread; run 0031's `messages` is
top-level and did need one, reading `index.messages ?? []` so a group that has
said nothing reads as an empty list rather than a missing key and an index
written before the run stays readable. Check which kind of field you are adding.

**The two square-metre answers (run 0030).** `Resident` carries `shareM2` and
`extraM2`, both `number | null`: how many square metres of shared space this
resident thinks each person should pay for, and how many they offered to pay for
beyond that share after the vote settled. Whole numbers, zero or more, or null
when never answered, with **no upper bound in the store** because the slider's
range belongs to the building app and a limit here would move in two
repositories at once. Before this the store dropped both keys silently, which
run 0056 of the building app measured against the live store, and the effect
there was a median taken over one answer. The old `share`, a fraction 0..1,
STAYS accepted and is marked in the type as the pre-0056 reading of the same
question, because records already written carry it; the store reads a record
back as it found it and does not backfill, which
`store.test.ts`'s ETag-race case now asserts. `sessionView`
(`src/session/store.ts:365`) spreads each record whole, so both keys reach the
poll and `/export` with no further change.

Ben, republishes flat-2 (version 2), sets counts/share/ballot (Ben in two
partial bodies), reads the state and checks the summaries (194 / 168 cells,
bbox `0,0,15,14` / `0,0,14,12`), reads both flats back byte-identical, writes
a run WITH A PLOT (run 0026) and checks `changed` cleared and the plot comes
back byte-identical on both the building call and the session state, reads
the export and checks both bodies byte-identical and the summaries equal to
the state (run 0023), preflight 204. 28 checks (26 through run 0025, 2 more
for the plot); exit 1 on any failure. Passed against `npx netlify dev --port 8888`
(Blobs sandbox mode) in runs 0022 and 0023. **The site password was lifted on
2 September 2026**; the deployed round trip passed 26/26 against
`run-0023--reconfigure-flat.netlify.app` and the production base is
`https://reconfigure-flat.netlify.app/api/session/`. Run 0022 had found the
gate answering 401 to every path and to OPTIONS preflights; if it comes back,
the store is unreachable from the app and from the other origin alike.

**Tests.** `src/session/store.test.ts` — 18 cases (9 through run 0023; run
0024 added 4 for the ownership refusal and `?replace=1`, 1 for a new flat's
`preview` defaulting false, and 4 for the preview GET/PUT round trip),
fast suite (no three.js):
routing/CORS, empty session, rejections, create-vs-replace with bytes kept and
no `storeys` in the poll, resident partial merge + validation, building write
clears `changed` and the next publish sets it again, and a `RacingKV` whose
first ETag write loses so the retry is exercised. Suite counts as of run 0022:
**fast 134 passed in 11 files** (was 126 in 10), slow unchanged. As of run 0023:
**fast 153 passed in 12 files** (`store.test.ts` 9, `session.test.ts` 15,
`savePlan.test.ts` 17), slow 26 passed + 1 expected fail. As of run 0024:
**fast 177 passed in 13 files** (`store.test.ts` 18, `session.test.ts` 21 —
6 new, for `ownerResident` on a 409, `?replace=1`, and `publishPreview` — plus
the new `previewFrame.test.ts` at 5; `savePlan.test.ts` 17 and `manifest.test.ts`/
`ids.test.ts` unchanged), slow 26 passed + 1 expected fail, `tsc`/`npm run build`
clean, both fixture baselines still 12 and 7. As of run 0025: **fast 190
passed in 14 files** (`session.test.ts` 21 to 28: 1 for `takeoverConfirmText`,
6 for `decideTakeover`; the new `unitBrowser.test.ts` at 6; `store.test.ts`
untouched at 18, since this run made no change to `src/session/store.ts`),
slow 26 passed + 1 expected fail, `tsc`/`npm run build` clean, both fixture
baselines still 12 and 7. As of run 0026: **fast 198 passed in 15 files**
(`store.test.ts` 18 to 21 — 1 for `sameResident`'s own cases, 1 for a
case-different republish, 1 for the plot round trip and its rejection
cases together; `unitBrowser.test.ts` 6 to 7; the new `unitStats.test.ts`
at 4; `session.test.ts` (28), `savePlan.test.ts` (17) and every other file
unchanged in count, though two of `session.test.ts`'s cases and one
assertion in `savePlan.test.ts`'s `outputLabel` test now pin "Group"/"group"
wording where they pinned "Session"/"session" before), slow 26 passed + 1
expected fail, `tsc`/`npm run build` clean, both
fixture baselines still 12 and 7, `scripts/store-roundtrip.mjs` 28 checks
(26 through run 0025) against `netlify dev`. As of run 0027: **fast 223
passed in 17 files** (the new `flatState.test.ts` at 17 and
`journey.test.ts` at 6, plus 2 in `session.test.ts` for a landing join
writing exactly what the send panel reads back; no other file changed
count), slow 26 passed + 1 expected fail, `tsc`/`npm run build` clean,
both fixture baselines still 12 and 7, and the store contract untouched:
run 0027 changed no file under `src/session/` beyond that test.

---

## 13. The brief's skin (`src/style.css` tokens + fonts, run 0026)

**Source of truth:** `_cowork/design/DESIGN-BRIEF-3sep.md`, written 3
September from a wireframe Shrey approved that day
(`_cowork/design/wireframe/`, seven `.dc.html` screens; this app is
`FlatDraw.dc.html`). Both `Re_Configure` apps get this look; they stay two
apps. **Constraint honoured:** the editor's own colour (the 3D scene's
`scene.background`, `sceneSetup.ts`, `--canvas-bg`) is untouched — the brief
says so explicitly, and nothing in this run reads or writes it. Everything
else the resident sees reads the tokens below.

**Tokens, repointed at the brief's exact values** (`:root`, `style.css`):
`--bg` #ece6d8 (paper ground; was #ece8e0), `--ink` #161616 (was #141317),
`--accent` #d6341c red (was #d2232e), `--meta` #6b665c muted ink (was
#6d6a62); new: `--blue` #1d4fa3, `--yellow` #f2b41c, `--dim` #a39c8d, `--card`
#f4f0e6 (a card's own fill, a touch lighter than the ground). The repointed
Bauhaus aliases (`--black`, `--paper`, `--text`, `--text-dim`, …, the run
0016/17 reskin's own device for touching ~140 old declarations at once
without rewriting them) move with their new-name counterparts, so old chrome
inherits the brief's palette for free; `--line`/`--line-paper` (hairline
grey) are UNCHANGED — the brief names four colours, not five, and a neutral
hairline was never one of them. `--yellow` and `--blue` are declared for
this app's own future use (shared-space/annotation colour, matching the
building app) — nothing in the flat app's chrome uses either yet, since it
has no shared spaces or annotations to mark; declaring them now keeps both
apps' tokens in step rather than adding them piecemeal per run.

**Type, one Google Fonts link** (`index.html`, not a dependency): Big
Shoulders Display 700/800/900, Jost 400-700, JetBrains Mono 400/500 — the
brief's own weights. `--font-display`/`--font-body`/`--font-mono` tokens;
`body`'s base font is `--font-body` (was the old Helvetica Neue stack), so
every rule already reading `font-family: inherit` picked it up for free.
Button-like controls read `--font-display` instead — a global `button {
font-family: var(--font-body); }` safety net plus ONE grouped override
(`.floor-tab, #view-toggle, …, #display-body button { font-family:
var(--font-display); }`, placed last in the file so it wins over each
individual rule's own `inherit` without editing a dozen of them by hand).
Headings (`.panel-title`, `.vp-title`) and the top-bar brand read
`--font-display` too; the group code (`.tb-session`) reads `--font-mono`,
matching the brief's treatment of a code like "review-0023".

**The paper's grain**: the brief's exact SVG `feTurbulence` filter, one
`--grain` token, applied as a second `background-image` layer (alongside
the solid `background-color`) on `#topbar` and `#sidebar` ONLY — the two
large flat panels that ARE the ground. Cards (below) sit on top of it
solid, matching the wireframe (`.root:before` grains the ground; `.card`
never does). Nowhere else reads it: the 3D viewport is covered edge to edge
by the canvas regardless, so grain behind it would never render.

**A card, the brief's way** (`.card`, `style.css`, new utility class):
`var(--card)` fill, `border-top: 3px solid var(--ink)` and NOTHING else — no
side borders, no radius, one `box-shadow: 0 1px 0 var(--line-paper)`
hairline underneath. Used by the save column (§11, three cards) and restated
(not imported) by the units panel's own injected stylesheet (§10,
`unitBrowser.ts`, self-contained on purpose).

**A chip, the brief's way** (`.chip`/`.chip-ok`/`.chip-acc`, new): an
outlined pill (`border-radius: 999px`), ink by default, green when a check
passes (`--note`), red when it does not (`--accent`) — the save column's
check line (§11) is the one place this app uses it; `.ulb-tag` (units
panel) already existed and gained `border-radius: 999px` to match, plus
`.ulb-tag.ulb-yours` moved from an ink fill to `var(--accent)` — the brief's
rule that red marks "the resident's own" (§10).

**A button, the brief's way**: `button.primary`'s look (ink-filled, used
by the sidebar's Grid-size "Apply") is UNCHANGED beyond its font — that
control is an editor TOOL, not "the one primary action on a screen" the
brief means. `.btn-send` (new class, the save column's "Send it to your
group", §11) is the brief's red block with the nudging arrow
(`@keyframes btn-nudge`, the wireframe's own timing), scoped to that one
button rather than to `button.primary` generally, precisely so the Grid-size
Apply button (found live, mid-verification, wearing an unwanted red pill)
never had to change.

**The top bar**: brand `(Re)<b>Configure</b> / Flat` (only "Configure"
reads red, matching the wireframe's own markup), a 3px ink rule under the
bar (was 1px `--line-paper`), and a new `.tb-steps` widget — "01 Draw"
always current (a breathing red disc, `@keyframes tb-breathe`), "02 Send"
always plain — ADDED alongside the existing view-mode segments, Units,
Check Layout, Frame View and Save/Open, none of which the brief's own
(necessarily bare) wireframe bar shows because it has nothing else to
communicate. Those controls are unchanged; only their font and colours
follow the tokens above.

**Verified live** (`netlify dev`, the Browser pane, this run): fonts load
and render (Big Shoulders Display on headings/buttons, Jost on body text,
confirmed via `getComputedStyle`), the grain shows on the top bar and
sidebar, `.chip-ok`/`.chip-acc` render at the right colour and pill radius,
`#save-column` sits clear of `#view-controls` at 1440×900, and the "Yours"
chip renders red in the Units panel. A second live pass, prompted by a
user actually using the column rather than only reading its source, found
and fixed four more problems: horizontal overflow (untitled inputs wider
than the column), no way to minimize it, the shortcuts panel rendering
under it, and the area number's count-up restarting from zero on every
edit — see the "Three more bugs" and the count-up paragraphs above (§11)
for each. Not checked: a narrow/mobile viewport
(this app has never targeted one; §5's plan/model toggle is its concession
to a small screen, not this run's business) and an actual dark-mode
preference (`prefers-color-scheme`) — this app has always been one fixed
theme, paper-and-ink, and the brief does not ask for a second one.

---

## 14. The landing, the two steps and the empty state (run 0027)

**Source of truth:** `_cowork/design/DESIGN-BRIEF-3sep.md`'s "The screens"
section, and the four wireframe screens it was written from
(`_cowork/design/wireframe/Landing.dc.html`, `FlatEmpty.dc.html`,
`FlatDraw.dc.html`, `FlatSend.dc.html`). Shrey ran run 0026's build and
found two things: the app dropped a first-time resident onto an empty grid
with an error about a missing entrance before they had done anything, and
saving was claimed by three controls at once. Two rules answer both. **One
thing, one place**: nothing that saves or sends appears twice. **One panel
at a time**: the two steps already named in the bar became real screens, so
the palette and the send panel are never on screen together.

**Two rules, one place each** (`src/core/flatState.ts`, pure, 79 lines,
`flatState.test.ts` 17 cases). `flatPhase(placedRooms, unitBuilds)` returns
`empty` before anything is placed, `unready` once something is placed but
`buildUnitExport` still refuses it, and `ready` when the build succeeds.
Everything the chrome asks follows from that one value: `canSend` gates BOTH
step 02's tab and the Send button, so they cannot disagree; `showsDropHint`
puts the ghost tile on the grid; `checksRun` decides whether the layout
rules are worth running at all. `showsLanding(search)` is the second rule
and the only thing that decides whether the landing appears. Framed by
`design-automation`'s §2.1 production rules: one IF-THEN over one state
value, read in four places, changed in one.

**The landing** (`#landing` in index.html, wired in main.ts). It covers the
editor rather than replacing it, so the three.js scene is already warm when
a door is picked and no router or second entry point exists. Four doors:
*Start a flat* hides it; *Join a group* swaps the doors for two fields that
normalise the code, refuse through the SAME `whyPublishDisabled` the send
panel uses, and write through the SAME `writeSession`, so joining here and
typing there leave state that cannot be told apart (pinned in
`session.test.ts`); *Open a file* is the existing picker; *Go to your
group* links to `BUILDING_APP_URL` (one constant, `main.ts`) carrying
`?session=<code>`. It hands over the KEY, not the flat: the store is the
shared thing both apps read, which is the database-mediated exchange
`interoperability`'s own decision matrix (§3.1, §3.7) points at for two
tools that already share one. A resident returns to the landing through
Open → **Start over**, which destroys nothing; the landing's primary door
then reads "Back to your flat" while there is something to come back to.

**Two steps** (`body[data-step]`, `setStep`/`syncStepTabs` in main.ts). The
bar's two tabs switch the screen under them and are clickable both ways.
Step 01 has the palette, the drawing filling everything else, and the
flat's three numbers plus the check chip as a strip inside the bar, live as
the resident draws. Step 02 has no palette: the flat is framed whole
(`resetToExtent`, the same framing Frame does), its figures sit under it
with a fourth, the room count, and the send panel is at the right. Step 02
is shut while `canSend` is false and carries `aria-disabled` rather than
`disabled`, because a disabled button fires no click and the resident
pressing a locked step is exactly the one who needs to hear why (found
live). A flat that LOSES its way in while step 02 is up drops back to step
01 rather than stranding a resident on a screen whose one button cannot
work. Nothing moves in the DOM between steps, so the scene is never rebuilt
and the canvas only resizes.

**The empty state** (FlatEmpty.dc.html). With nothing placed the three
numbers read `—`, the name reads "Untitled", the check chip drops its pill
and reads "Drag a room onto the grid to start. Nothing is checked until you
do." as plain muted text, Send is asleep, and one dashed red outline on the
grid reads "Drop a room here" (`#drop-hint`, an SVG polygon whose
four points are the ACTIVE floor's grid corners projected through the camera
every frame in `syncDropHint`, so it is the plate's own size and follows every
orbit; `pointer-events: none` so a drag lands through it). A
figure is now shown ONLY when the unit builds: run 0026 showed `0 m²` for a
flat with rooms but no way in, which reads as a measurement rather than as
the absence of one, so that case reads dashes too and the chip beside it
says which case it is. `unitStats` over one build stays the only source any
number has.

**Where every moved control went.** `Save / Open` → `Open`, holding
`Open project` and `Start over` and no save path at all. `Check Layout` →
the check chip, in the bar in step 01 and under the drawing in step 02,
which opens the same `runCheck()` report; the report still closes from its
own ✕. `Frame View` → `#view-controls`, beside Cutaway, Seeds, Structure
and Interface, so cutaway, the layers, framing and the compass are one
cluster in one corner. The save column's `SAVE` toggle → a chevron that
collapses the panel. `Model / Plan / Diagram`, `Units` and `?` stayed. No
control was deleted, and a search of the live DOM for "save" returns one
hit, the palette's orientation note ("Saved with the project, never in the
unit export"), which describes where a setting is stored.

**Retired:** run 0025's fold over the two group fields. On step 02 they ARE
the screen, next to the button that uses them (FlatSend.dc.html), so both
stay open and `syncSessionFold`/`unfoldSessionFields` are gone.

**One command, and a clear word when the store is not there (run 0033).**
`npm run dev` is now `netlify dev` on **8888**, which serves the app and the
store together; `npm run dev:vite` is the old plain Vite on 5173.
`netlify-cli` is pinned at 27.5.0 in `devDependencies` and `netlify.toml` pins
the command, the port, `publish` and `functions`, so the address does not move.
Nothing the CLI brings reaches the bundle: the JS grew 859 bytes and the CSS 211
across this whole run, all of it this run's own source.

`classifyStoreFailure` (`src/session/session.ts`) is THE ONE RULE for "is the
store reachable". A thrown fetch, an `ok` response whose body will not parse,
and a 404 carrying HTML are all `absent`; anything else is the store answering
and keeps its own message. On plain Vite the group panel used to print
`Unexpected token '<'`, which is an exception shown to a person. `checkGroup`
replaced `groupIsStarted`, which collapsed a missing store into a missing group.
The unit browser takes the sentence as an option rather than knowing it, since
it is handed a URL and nothing about what serves it.

**Four doors, and joining means joining (run 0032).** The landing's doors are
Start a flat, Start a group, Join a group, Open a file. Start a group calls
`inventCode` (`src/session/session.ts`), which makes a code from a 58-word list
and two digits so it can be said across a table, starts it in the store, and
shows it at 44px in the mono face. A code the store refuses is one somebody else
took, so it tries again rather than reporting a collision the resident did not
cause. Join a group now calls `groupIsStarted` and refuses an unstarted code with
`noSuchGroupText`, which names the code the resident typed. Both sentences are
pure functions for the reason every other sentence in that file is.

**A first visit starts empty (run 0031).** The landing used to fill its code and
name from `localStorage` every time, so a person who had never used the app could
not tell a field holding their own name from one holding somebody else's.
`landingRecall` in `src/session/session.ts` is now THE ONLY place that decides
it: it returns what to put in each field and one sentence about having done so.
Nothing known gives two empty fields and no sentence; anything known fills what
it recognised and says which, so the app is picking up rather than guessing. Pure,
so `session.test.ts` pins the sentence rather than a screen reading it, the same
reason `takeoverConfirmText` and `deleteConfirmText` are pure. The sentence has
its own element, `#landing-join-recall`, in the meta grey rather than the accent
red, because it is information and not a warning.

**Verified live** against `netlify dev`, at 1440×900, in the Browser pane:
the landing's own computed values (title Big Shoulders Display 78px, ink
`rgb(22,22,22)`; the primary door red `rgb(214,52,28)`; the discs yellow
`rgb(242,180,28)` and blue `rgb(29,79,163)`; the ground `rgb(236,230,216)`);
a join writing `{"resident":"Ana","code":"room-42"}` under
`reconfigure.session` and refusing `room 42` with the store's own wording
before writing anything; the empty state's dashes, hint and ghost tile; a
placed room with no entrance leaving step 02 shut and answering with the
reason when pressed; `?project=flat-2-single-storey.json` skipping the
landing and reading 70 m² / 1 / 3.6 m with "All checks pass"; step 02
framing the flat, hiding the palette and the bar strip, and reading
"Unit 6 · 70 m² · 1 · 3.6 m · 7 rooms"; and a real send answering
"Sent to run0027 as Unit 6 · open Units to see your group" with the store's
poll showing the flat at version 1 with its preview.

**One way forward, and the landing arrives in order (run 0034).**

Step 01 now ends with a button rather than with a number in the bar.
`#forward` sits at the bottom centre of the viewport, which is the one free
edge: `#bottom-left` holds undo and redo, `#view-controls` holds Display, and
the palette is outside the viewport, so nothing a resident needs is covered.
It reads "Send it to your group", saying where it goes rather than "next".
While the flat is not ready it carries `aria-disabled="true"`, takes the
`--dim` fill through `.btn-send[aria-disabled="true"]`, and shows `NO_WAY_IN`
in `#forward-why` above it; ready, it is `--accent` red and the sentence
element is empty and so `display: none` through `#forward-why:empty`.
`style.css` hides `#forward` in step 02 and `#save-column` in step 01, so
exactly one `.btn-send` is on screen at a time. `syncStepTabs` in `main.ts`
makes ONE `canSend(phase)` call and hands the same `open` to both the bar's
step 02 and this button; `chromeWiring.test.ts` pins that shape, since this
project has no jsdom and the wiring cannot be driven and asked.

Step 02's one red button has two moments. Before a send it is the send
button. After a successful publish `hasSent` flips, `sendButtonLabel(true)`
relabels `#save-go-label` to "Go to your group", and the click opens
`groupUrl()`, which is now the one place the building-app link is built and
is read by the landing's own "Go to your group" as well. Any edit clears
`hasSent` in `refreshFlatFigures`, because a changed flat has not been sent.

The journey strip keeps all six dots and drops run 0027's done/ahead.
`journeyTones(currentId, thisApp)` gives `now` for the dot a resident is on,
`here` for the dots this app owns and `elsewhere` for the other app's, so the
flat app shows the first two in ink and the last four dim and the building
app shows the mirror image from the same function. The current dot and its
label are `--accent`; `here` is `--ink`; `elsewhere` needs no rule, since
`--dim` is what `.journey-dot` and `.journey-label` already are.

The landing arrives in a fixed order, all in CSS. Nothing for 1000 ms; then
both discs grow out of their own corners over 600 ms (`transform-origin: top
left` for the yellow, `bottom right` for the blue); then the headline line by
line at 1600, 1750 and 1900 ms; the paragraph at 2200; the four doors at
2500, 2600, 2700 and 2800 with the aside line at 2900; the journey strip at
3200. Every arrival lasts 300 ms. The headline is three `<span>`s rather than
three `<br>`s, because a `<br>` is not an element a delay can sit on.

It is honest if it never runs: every keyframe has a `from` and no `to`, so
the resting state is the finished state and an engine that ignores the
animation leaves the landing whole rather than blank.
`prefers-reduced-motion: reduce` turns the whole sequence off. Nothing takes
a pointer event or leaves its own place, so a door clicked at 1200 ms is the
door that answers. Coming back from the join or the new-group form re-shows
`#landing-doors`, and a `display` change restarts a CSS animation, so
`showLandingDoors` in `main.ts` marks that path `.no-arrive` and the stagger
plays once per visit.

**Verified live (run 0034)** against `netlify dev` on 8888 at 1440×900 in the
Browser pane. Step 01 empty: `#forward-go` `aria-disabled="true"`,
`background-color: rgb(163, 156, 141)`, `#forward-why` reading "Place an
entrance on an outside edge first, so the flat has a way in.", and
`#step-send` carrying the same `aria-disabled="true"`. The same flat loaded
with a way in: both read `aria-disabled="false"` and the button is
`rgb(214, 52, 28)` with the sentence gone. In both, the only visible
`.btn-send` is `forward-go`. Pressing it moves to step 02, where the only
visible `.btn-send` is `save-go` reading "Send it". A real publish into
`run-0034` answered "Sent to run-0034 as Unit 29 · open Units to see your
group", the label became "Go to your group", and the click opened
`http://localhost:5182/?session=run-0034`. Deleting a room and returning to
step 02 put the label back to "Send it". The landing's computed delays read
1s/0.6s for the discs and 1.6/1.75/1.9/2.2/2.5/2.6/2.7/2.8/2.9/3.2s at 0.3s
each for the rest, and screenshots at about 1.2 s and 2.3 s show the discs
mid-growth with no headline, then the headline in with the paragraph still
fading and no doors yet.

---

## 15. The flat generator and the first library batch (`scripts/`, run 0028)

Added in run 0028, whose job was five library flats and whose real content was
the verification attached to them. Twenty flats are wanted in the end, one per
resident of a group the building app packs, and drawing them by hand costs days.
So the run built the thing that turns a bubble diagram into a `dwelling-unit`
file, and then proved each result against the app's own rules rather than
against the generator's own idea of correctness.

**Two files, split by what needs testing.** `scripts/flatLayout.ts` is pure
arithmetic with no three.js and no DOM, so `scripts/flatLayout.test.ts` pins it
in the FAST suite at 21 cases, every number in them counted on squared paper
first. `scripts/gen-flat.mjs` is the runner that boots the render layer and the
rules. Neither is in `tsconfig.json`'s `include`, which is `["src", "netlify"]`,
so `tsc` does not see them; that matches how `scripts/store-roundtrip.mjs` has
always been treated.

**No runner dependency.** The app's core is TypeScript with extensionless
imports, which Node cannot resolve on its own, and run 0028 was forbidden a new
dependency. The runner boots the project's own Vite in middleware mode
(`createServer({ server: { middlewareMode: true } })`) and pulls the modules
through `ssrLoadModule`, the same transform the dev server and vitest use. Copy
this for any future script that needs `src/`.

**The input is a bubble diagram plus a layout hint.** Rooms, the graph edges that
must become doors, one entrance, a target area band, and rows of slots. A slot is
one module, a `stack` of slots in one column, a `fill` patch of circulation or
outdoor cells, or a `void`. Rows stack southwards from an origin; slots butt left
to right inside a row. Rows may differ in width, which is how an L-shaped flat is
described.

**Two invariants keep the output from looking generated.** Every slot in a row
must fill the row's depth, so no notches; a shortfall is an error naming the row
and the slot. And a growth `void` must be enclosed on all four sides, checked
with the app's own `borderReachableEmpty` (`src/core/expansion.ts`), because a
void that reaches the grid border is never absorbed and the flat quietly comes
out small. A void marked `stairwell: true` is exempt: that one is the open well
over the stair below, which the app cuts and refuses to grow into, and it sits
wherever the stair sits including on the flat's edge.

**Doors are DERIVED, not authored.** `deriveDoors` finds every anchor at which a
two-edge door would bind the named pair, takes the longest straight run and puts
the door in its middle. That is the same test `resolveDoorSpaces`
(`src/core/door.ts`) applies at load time, run early enough to be an error
message. It matters because `floorManager.ts:1006` PRUNES a door that does not
bind two live spaces, so a hand-written door that misses disappears in silence
and surfaces much later as an unreachable room. The runner also counts doors
written against doors the app kept and fails on any difference.

**Walls, windows and stair holes are never written.** They are derived, as
everywhere else here. The generator writes placements, one entrance and doors.

**The verification is the point.** Each generated project goes through
`parseProject`, then a real `FloorManager` with the same stubs the slow suite
uses, then `computeDwellingGraph` and `validate`, the two functions Check Layout
runs. The runner exits non-zero on any must-fix finding, any refused placement,
any pruned door, or an area outside the target band. It writes to `build/units/`,
gitignored as of this run; a flat enters `public/units/` by a deliberate copy.

**The twenty flats.** `scripts/flats/unit-8.flat.json` through
`unit-27.flat.json` are the diagrams and `public/units/unit-8.json` through
`unit-27.json` the files. All twenty carry zero must-fix, five are over two
storeys, and every one holds a bedroom (rule P4, run 0029). Run 0028's first
five were: Areas 38.88, 51.48, 56.88, 70.20 and 110.88 m²; four one-storey and one
maisonette. Each traces to a plan in `_cowork/outbox/0028-reference-plans.md`.
Advisory counts are 0, 1, 1, 3 and 4 worth-a-look plus one note each. Flat 12's
three N1 findings are the maisonette's own cost: its stair is 16 cells on each
storey and the rule counts a stair as circulation, which puts the flat at 29 per
cent of interior area against a 25 per cent advisory cap.

**Two things the batch taught, both worth knowing before the next fifteen.** A
hall patch and a WC lobby that touch merge into ONE circulation cluster, so a
door between them binds a single space and the app prunes it; the fix is to drop
the graph edge, not to move the room. And a growth void only ever works in a
middle row, because the first and last rows of a flat face the outside on one
side, so voids are affordable in a large flat and expensive in a small one, where
the filler needed to enclose them eats the circulation budget.

**Run 0029 added one slot kind and fixed one real bug.** A `gap` is space the
flat is NOT in. Rows are left-aligned, so before it a row could only start at
the flat's own west edge and the only shape available was a staircase; a gap
lets a row start further in or stop short, which is what makes an L with a
re-entrant corner and a stepped edge. It is checked as the exact inverse of a
growth void: a gap MUST reach the grid border, since one that does not is an
enclosed pocket an elastic room absorbs, taking the hole the plan was drawn
around with it. The bug: both storeys of a maisonette are drawn on the same
grid coordinates, and `deriveDoors` kept its used-edge set in plain plan
coordinates, so a ground-floor door reserved the edge a first-floor door needed
at the same place and the second failed on a boundary it plainly shared. It now
takes a `storeyOf` function and keys that set per storey. Two people found this
independently, and it would have broken every maisonette from here on.

**Shapes the packer can and cannot make**, measured over the twenty. It makes
the L with a re-entrant corner, the stepped edge, the deep plan with a
landlocked kitchen, and the through-flat with rooms on two opposite facades and
a spine between. It cannot make a closed ring or a courtyard, because a hole
inside the outline is an enclosed pocket an elastic room absorbs; it cannot make
a split level, because a storey is a whole storey here; and it cannot make a
non-orthogonal outline, because every module is an axis-aligned rectangle on the
0.6 m grid. `_cowork/outbox/0029-reference-plans-2.md` names the built projects
each of those shapes comes from.

**The library is clean throughout, and the quarantine is gone (run 0035).**
`src/core/libraryClean.slow.test.ts` walks every file in `public/units/` and
asserts zero must-fix. `unit-5.json` used to fail four rules (P1, H1, ST2, ST3),
being a four-instance scratch unit with zero doors, a retired `stair` module on
floor 0 and one bedroom on floor 1 that no stair reached. Run 0028 was told the
seven existing flats stay exactly as they are, so the test quarantined it by
name and by its exact four rule ids, and said in its own header that fixing the
flat would break the test and that breaking it was the reminder to delete the
entry. The flat was redrawn on 6 September and now reports zero must-fix, so
run 0035 deleted the entry. `QUARANTINE` stays as an empty table, because the
next flat that arrives rotten will want the same shape.
---

## 16. Leaving, renaming, and a library that counts from one (run 0035)

**Leaving takes the flat with it.** One person is one profile is one flat, so
`DELETE /api/session/{code}/residents/{name}` removes that person's row and
every flat they own, each flat's blob and its preview blob with it. It answers
`200` with `{ resident, flats }` and `404` when that name has neither a row nor
a flat. The building app asked for this: its run 0059 could not remove a
resident at all, so "leave" only emptied the answers and the building went on
packing a flat nobody stood behind.

**Renaming keeps it.** `POST /api/session/{code}/residents/{name}/rename` with
`{ to }` moves the row and retags every flat that person owns, in one index
write. One call rather than a `PUT` under the new name and a `DELETE` of the
old, because between those two the person is at the table twice and the
building app is polling. `409` when the new name already holds a row or a flat.
Renaming to another spelling of one's own name is not a clash with oneself, and
is the case the call mostly exists for.

**One ownership rule, reached three ways.** `sameResident` has decided who owns
a flat since run 0026 and still does. Run 0035 added three helpers over it
rather than a second answer: `residentKey(index, who)` finds the key a row is
filed under, `flatsOwnedBy(index, who)` finds that person's flats sorted, and
`storedName(index, who, owned)` gives the spelling the store already holds, from
the row when there is one and from a flat they own when there is not. That last
case is why a person who published and never sent wishes gets their own
spelling back rather than the one typed in the URL.

**Order of writes.** The index loses the flats first and the blobs go
afterwards. A crash between the two leaves bytes nothing points at, which is
harmless; the reverse would leave the index promising a flat `/export` cannot
read.

**CORS.** `OPTIONS` now answers `GET, POST, PUT, DELETE, OPTIONS`. A method
missing from that line is a call a browser never sends: the preflight fails and
`fetch` rejects with `TypeError: Failed to fetch`, which says nothing about what
was wrong. `docs/store.md`'s CORS line had also drifted, still naming
`GET, PUT, OPTIONS` after run 0031 added `POST`, and was corrected.

**What leaving does NOT take.** The messages and the building run stay. A
message is an append-only record of a conversation and a run records who asked
for it; neither is a profile or a flat. So after Ben leaves, `messages` still
carries what he said and `building.by` still reads "Ben".

**A dev-server trap, measured in this run.** Under `netlify dev` a `404` from
the function is not the last word: the dev server retries the same path with
`.html` appended and again as `/index.html`, and the client sees THAT response.
`GET /flats/nope` answers `404` and `GET /flats/nope.html` answers `400`,
because a dot is not a legal flat id, so a caller that reads only the status
sees a `400` it cannot explain. `scripts/store-roundtrip.mjs` checks that a
withdrawn flat's body does not come back rather than checking for a bare `404`,
and says why in a comment.

**Step 02 says when the group has an older flat.** `SendState` in
`src/core/flatState.ts` is `never`, `sent` or `edited`, ONE value rather than
two booleans. Run 0034's single `hasSent` boolean could not tell a flat that was
never sent from one sent and then edited, because both leave it false, and those
two want different words on the screen. `afterEdit` is the only thing that moves
it on an edit; `sendButtonLabel` and `staleNotice` are the two pure rules that
read it. The sentence is `GROUP_HAS_OLDER`, "Your group still has this flat as
you sent it. Sending again replaces it.", in `#send-stale` under the button, in
accent red, and `:empty` takes it out of the layout at every other moment.

**`NO_WAY_IN` now reads "Place an entrance to send the flat to the group."** It
names what the entrance is for rather than where it goes. The editor already
refuses an entrance anywhere but an outside edge, so the old wording was
answering a question nobody had. One constant, so the sentence under step 01's
forward button, the bar's step 02 title and the toast an asleep press raises all
move together.

**The library counts from one.** Every entry reads `Flat N`, in
`public/units/index.json` and in each file's own `name` field. Ids and
filenames do not change, because the live store references them by id.
The order: `unit-8` to `unit-27`, the twenty this project designed, are Flat 1
to Flat 20; then `flat-2-single-storey`, `flat-3-terrace` and `unit-1` to
`unit-7` are Flat 21 to Flat 29; then `unit-29`, saved from the app on
6 September, is Flat 30. The descriptors each designed flat carried ("one
bedroom, corner") are gone: `checkEntry` in `src/library/manifest.ts` accepts
only id, name, color, file, preview, storeys, areaM2 and savedAt, so a row has
nowhere to put a second line. Every old name is listed in
`_cowork/outbox/0035-leaving-takes-the-flat.report.md`.
`src/library/libraryNames.test.ts` pins the thirty names, the order and the
unchanged ids in the FAST suite.

**Verified live (run 0035)** against `netlify dev`. The round trip
(`scripts/store-roundtrip.mjs`, 64 checks, all passing) renames Ana through a
URL spelling her name in the wrong case and her flat and her answers follow,
refuses a rename onto Ben's name with `409`, then removes `BEN` and finds his
row, his flat gone from the state and from the export and his preview gone from
the store. In the browser at 1440x900, step 02 showed no sentence before a send,
none after a send with no edit, the sentence in `rgb(214, 52, 28)` directly
under the button after a send and an edit, and none again after a second send.
---

## 17. Sending is one press (run 0036)

**The flat survives a reload.** Before this run nothing wrote the project
anywhere but a download, so a refresh, a closed tab or a crash cost the work.
Measured on 6 September: loading a flat through `?project=`, then reloading,
left `localStorage` holding only `reconfigure.session` and the flat's area
reading a dash. It is now written under `reconfigure.draft` on every mutating
action and restored on load with one line, "Your flat is as you left it."

The draft is the same string the undo history takes. `History.commit` in
`src/core/history.ts` now returns the snapshot it took, or `null` when it took
none, so the app serializes once per action rather than twice and the draft is
exactly what undo would restore. An undo writes it too, from the string
`restoreState` already holds, because `commit` is deliberately a no-op while
restoring. There is no `clearDraft`: emptying the grid writes an empty draft
and `readDraft` refuses to restore one with no rooms, so it clears itself.

**Who and where, once.** Step 02 no longer carries the two fields the landing
already asked for. `whoLine(session)` in `src/session/session.ts` answers one
sentence, "As Ana, to hall-14.", and whether the answer is complete. Complete
folds the fields away behind a small "change"; incomplete leaves them open and
says which half is missing. Pressing "change" keeps them open for the visit, so
they cannot fold under somebody mid-correction. With no group at all the red
button goes to the landing's join rather than trying to send.

**One button, one rule.** `sendButton(phase, state, complaints)` in
`src/core/flatState.ts` answers a label, a notice and whether the button is
awake, over three facts: whether the flat is ready, how far it has got towards
the group, and what the layout check has to say. Nothing on the screen decides
any of those for itself. Run 0035 had a label rule and a notice rule with
main.ts deciding the enabled state on its own, which is how a button ends up
saying one thing and doing another.

| ready | state | complaints | label | notice | awake |
|---|---|---|---|---|---|
| no | any | any | Send it | NO_WAY_IN | no |
| yes | never | 0 | Send it | none | yes |
| yes | never | n | Send anyway · n things to look at | none | yes |
| yes | sent | any | Go to your group | none | yes |
| yes | edited | 0 | Send it | GROUP_HAS_OLDER | yes |
| yes | edited | n | Send anyway · n things to look at | GROUP_HAS_OLDER | yes |

**No dialog.** The advisory `window.confirm` is gone, and `needsRuleConfirm` is
deleted from `src/core/savePlan.ts`. It asked "Check Layout reports N MUST FIX
issue(s) ... Continue?" AFTER the press, covering the flat and naming no issue,
so a resident could not answer it from inside it. The button says the same
thing before the press, and the check chip in the bar is one press from the
report that lists them.

**Sending sends.** `runSend` in `src/main.ts` publishes the flat and does
nothing else. `runSave` did four things in order, all four ticked by default,
so one press put two files in a resident's Downloads folder uninvited.
Measured live: a send now creates zero object URLs where the same send used to
create two. A resident's own earlier flat is replaced without asking, which is
the store's `sameResident` rule and needed no change. The Replace tick and the
takeover confirm are gone; the store still refuses somebody else's flat with a
409, reported as it comes.

**What is left under More.** The colour, chosen from the app's palette and
changeable there; "Save a copy to my computer", which downloads the project
file; and, in the dev build only, "Add to the library" and "Save the unit
file", because a library entry is written by a Vite endpoint no deployed build
has. The four "What to write" checkboxes and the design number left the screen.
The number is chosen automatically, and once a flat has been sent it stops
moving: found live, a flat sent as Unit 31 saved a copy as `flat-32.json`
because opening More re-proposed the next free number after the send had taken
one.

**The store says who left.** `DELETE .../residents/{name}` appends one message
to the group's chat, `{ who: "", text: "<name> left the group.", at }`, inside
the same index write that removes them and trimmed by the same 200-message cap.
`who` is empty on that one message and on no other, because a message from a
person is refused unless `who` is 1 to 64 printable characters. It exists so
the record of a session can tell "four took part" from "five took part and one
left".

**Verified live (run 0036)** against `netlify dev`. The reload check above.
"As Ana, to hall-14." with the fields folded, "change" unfolding them, and "To
hall-14, but you have not said who you are." with them open when the name is
missing. A send answering "Sent to hall-14 as Unit 32 · open Units to see your
group" while creating zero object URLs, followed by "Save a copy to my
computer" creating one and writing `flat-32.json`. The empty flat leaving both
the forward button and step 02 asleep with "Place an entrance to send the flat
to the group." The round trip (`scripts/store-roundtrip.mjs`, 70 checks, all
passing) printing the store's own line raw:
`{"who":"","text":"Ben left the group.","at":"2026-09-06T16:45:55.852Z"}`.
---

## 18. One landing for both apps (run 0037)

**The problem.** The two apps were meant to have the same landing and did not.
Put side by side on 7 September, the doors sat at the far right edge in one and
in the middle in the other, the columns were different widths, and this app had
a brand and a red rule the other lacked. Both had been written from the same
paragraph of the brief, and a paragraph leaves room.

**The fix is one file, not one description.**
`_cowork/design/landing/landing.html` and `landing.css` hold the whole landing.
Both apps render from them byte for byte. The source is
`D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\`, beside the
brief; a change goes there first and each app copies it in.

**The switch is one attribute.** `data-app` on the root, `"flat"` or
`"building"`, and it reaches exactly two things.

The doors. Each carries `data-for="flat"`, `"building"` or `"both"`, and one
rule hides the ones this app does not have. Six door elements carry seven
door-appearances, because "Join a group" is the same door in both apps, which
is the whole reason this is one file rather than two.

| id | label | shown in |
|---|---|---|
| `landing-start` | Start a flat | flat |
| `landing-new` | Start a group | flat |
| `landing-join` | Join a group | both |
| `landing-open` | Open a file | flat |
| `landing-open-building` | Open a building | building |
| `landing-example` | Look at the example | building |
| `landing-group` | the "Go to your group" link in the aside | flat |

The six dots. All six always show. Each step carries `data-owner`, which never
changes. This app's own steps are ink, the other app's are the dim they already
are, and the dot for where a resident is now is red, which on a landing is each
app's own first step: `journey-draw` here, `journey-wishes` there.

**Self-contained means it.** Every selector in `landing.css` is scoped under
`#landing` and every colour, font and size it needs is declared on `#landing`
itself rather than read from either app's `:root`. So no app rule can reach
into the fragment and the fragment inherits nothing that might differ between
the two apps. `landingShared.test.ts` checks both of those properties by
reading the file.

**How this app renders it.** `src/main.ts` imports the markup with `?raw` and
the stylesheet as a stylesheet, so Vite inlines both at build time and nothing
is fetched at runtime. It inserts the markup before anything queries the
document for a piece of the landing, then moves this app's own two forms, the
join form and the new-group form, into the fragment's `#landing-extra` slot,
which is the one place the fragment lets an app add markup. The fragment ships
`hidden` and ships `data-app="flat"`, so this app never shows the building
app's doors for a frame.

**What left this app.** 9046 bytes of landing rules from `src/style.css`, the
landing's markup from `index.html`, and `renderJourney` from `src/main.ts`.

**The fingerprint.** The brief carries one line, under "The screens":

```
LANDING FINGERPRINT sha256 908c7f9e20e8e89f3a36a766056c2659803e38dd266207dd9377ef19553ba419
```

That is `landing.html` then `landing.css`, concatenated, with every CRLF read
as LF, hashed as UTF-8. `src/landingShared.test.ts` computes it over this app's
copy and fails when the two disagree, saying that the landing has drifted and
where to put the change. The normalisation is not decoration: this repository
checks the files out with CRLF while the Context copy has LF, so a hash over
raw bytes would report two identical files as different.

**Verified live (run 0037)** against `netlify dev` at 1440x900. The four flat
doors and the aside shown and the two building doors not; the dots reading
`rgb(214, 52, 28)`, `rgb(22, 22, 22)` and hollow, in that order; the doors 400
px wide at x 966 to 1366; the headline 78 px; the journey strip 22px 0 34px
under a 3 px rule, all as they were before the move. The eleven delays read
back from computed styles unchanged. The join form landing at exactly the
doors' place and "back" restoring them with `no-arrive`. The picture is
`_cowork/outbox/0037-landing.png`, 1440 by 900.
