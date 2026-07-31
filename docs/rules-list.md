# Layout validation rules — list

All 41 rules in `src/core/rules.ts`. For each: why it's there, and how it's computed in code.

---

### E1 — Note
**Why:** Reachability is measured from the entrance. With none placed, there's nothing to measure from, so this replaces the reachability flags with one note instead of firing nothing.
**Code:** Fires when `graph.entryIds.length === 0`. Message text differs based on whether `graph.entrances.length > 0` (placed-but-blocked vs never-placed).

### E2 — Must fix
**Why:** An entrance whose edge got built over no longer opens to the outside.
**Code:** `graph.entrances.filter(e => e.blocked)`. `blocked` is recomputed every graph build in `adjacencyGraph.ts` by re-testing the entrance's edge against current exterior edges — never cached.

### DR1 — Note
**Why:** Reachability is door-based, so a plan with rooms and zero doors flags every room via H1. This note explains why, instead of leaving the wall of red unexplained.
**Code:** Fires when `graph.doorCount === 0` and at least one room node exists.

### DR2 — Note
**Why:** A bedroom with 3+ doors is unusual — most carry one, sometimes two for an en-suite — and starts costing furnishable wall and privacy.
**Code:** Bedroom nodes with `ctx.degree(n.id) >= 3` (degree = count of ACCESS/door edges).

### P1 — Must fix
**Why:** A dwelling needs a bathroom.
**Code:** `graph.nodes.some(ctx.is.bathroom)`; flags the whole dwelling if false.

### P2 — Must fix
**Why:** A dwelling needs a kitchen.
**Code:** Same shape as P1, with `ctx.is.kitchen`.

### P3 — Note
**Why:** More than one kitchen is unusual for a single dwelling but not wrong (shared house, granny flat).
**Code:** `graph.nodes.filter(ctx.is.kitchen).length > 1`.

### MB1 — Worth a look
**Why:** A sleeping floor with no bathroom means a stair trip at night. Gated on a bathroom existing *somewhere* so it never double-fires with P1 on a bathroom-less flat.
**Code:** Per floor: bedrooms present AND no bathroom on that floor. Skipped entirely if no bathroom exists anywhere in the dwelling.

### H1 — Must fix
**Why:** A room with no doored path from an entrance can't be used.
**Code:** `ctx.reachableFrom(ctx.entryIds)` — multi-source BFS over ACCESS (door) edges from all entrances. Room nodes not in the result set are flagged.

### H2 — Must fix
**Why:** A room reachable only by crossing a bathroom is a privacy/practicality failure.
**Code:** Two BFS passes: full reach vs. reach with `ctx.is.bathroom` blocked as an intermediate node (not as a seed — you can still walk *into* a bathroom, just not through it). Nodes in the first set but not the second are flagged; bathrooms themselves are excluded from the flagged set.

### H3 — Must fix
**Why:** Same as H2 but for bedrooms — except a bathroom reached only through its bedroom is an en-suite, not a failure, so bathrooms are exempted.
**Code:** Same blocked-BFS pattern with `ctx.is.bedroom` blocked. `ctx.is.bathroom(n)` targets are explicitly excluded from the flag (that's S7's territory instead).

### H4 — Must fix
**Why:** A door straight from a kitchen into a bathroom is a hygiene hazard.
**Code:** `edgeViolations(graph, ctx, "H4", "hard", pair(bathroom, kitchen), access=true)` — reads ACCESS edges only.

### S6 — Note
**Why:** The opposite of H4: a kitchen and bathroom sharing a *wall* with no door is efficient plumbing (stacked riser), worth confirming, not flagging.
**Code:** `edgeViolations(..., access=false, excludeAccessCovered=true)` — reads TOUCH edges, skips any pair that also has an ACCESS edge (so it never co-fires with H4 on the same boundary).

### H6 — Must fix
**Why:** A room reachable only by crossing outdoor space is weather-dependent.
**Code:** Same blocked-BFS pattern with `ctx.is.outdoor` blocked. No extra exemption needed — outdoor nodes are `kind: "cluster"`, not `"room"`, so they're already outside the room/stair target set.

### C1 — Worth a look
**Why:** A circulation cluster with no doors onto it is dead space. Demoted from hard — wastes area, doesn't make the dwelling unusable.
**Code:** Circulation cluster nodes with `ctx.degree(n.id) === 0`.

### C2 — Worth a look
**Why:** A corridor with exactly one door doesn't circulate anything — you go in and back out.
**Code:** Circulation cluster nodes with degree `=== 1`.

### A1 — Worth a look
**Why:** SIA 500 wants ~1.2 m clear width for accessibility (2 grid cells); nothing else checks corridor width, so a plan could have 600 mm corridors with 1200 mm doors opening onto them.
**Code:** `narrowWidthCells()` helper — per circulation cluster, a cell is narrow if none of the four 2×2 cell-blocks containing it is fully inside the same cluster. Reports the narrow-cell count per cluster.

### O1 — Worth a look
**Why:** An outdoor space nothing opens onto (balcony, terrace) is unusable. Mirrors C1. Since the semi-exterior pass, "connected" no longer means "doored" — a french window counts. Gated to the pre-entrance case: once there is an entrance, OD1 owns the same node.
**Code:** `!ctx.hasEntrance`, then outdoor cluster nodes with degree `=== 0`.

### OD1 — Must fix
**Why:** A balcony you cannot get to is floor area the dwelling cannot use. With french-window access this fires only when the balcony touches no room along a run wide enough to glaze (a 1-cell contact is 0.6 m of wall, not a way through), or when the only rooms it touches are themselves unreachable from the entrance.
**Code:** Outdoor cluster nodes absent from `ctx.reachableFrom(ctx.entryIds)`. Outdoor clusters are routing *leaves* — reachable, never a through-route.

### ST1 — Worth a look
**Why:** A stair should have a door at both the floor it leaves and the floor it arrives at.
**Code:** Compares `ctx.viaStairAdj.get(n.id).size` (top-side/floor-above door count) against remaining degree (bottom-side count) per stair node; names whichever is 0.

### ST2 — Must fix
**Why:** An unreachable stair cuts off whatever floor it serves.
**Code:** Same reachability BFS as H1, applied to stair nodes (`ctx.is.stair`).

### D1 — Must fix
**Why:** A habitable room (bedroom/living/recreation) with no exterior wall gets no daylight.
**Code:** Reads `GraphNode.hasExteriorEdge`, derived once per floor in `adjacencyGraph.ts` from `buildSpaceTargets()` (which correctly excludes stairwell-hole-facing edges — a past bug source).

### D2 — Worth a look
**Why:** Same check for kitchens, soft not hard — internal kitchens are common and get mechanical ventilation.
**Code:** Same `hasExteriorEdge` check, `ctx.is.kitchen` nodes.

### W1 — Worth a look
**Why:** A room's actual glazing falls short of its type's daylight target.
**Code:** Reads `node.glazing.belowTarget`, computed by `computeWindows()` in `windows.ts` (per-type ratio: `1/6` living/recreation, `1/10` bedroom/kitchen, kitchen fixed at 2 edges, 2-edge minimum everywhere). Gated on `hasExteriorEdge` so it doesn't double-fire with D1/D2 on a room with no facade at all.

### OR1 — Worth a look
**Why:** A habitable room (or kitchen) lit only from the north gets no meaningful direct sun (solar-access practice at this latitude). A heuristic, not a code failure.
**Code:** `(ctx.is.habitable(n) || ctx.is.kitchen(n)) && n.glazing.northLit`. `northLit` is computed in `computeWindows()` (which now takes `northAngle`): each windowed edge's side → compass bearing (`orientation.ts`, north = world −Z rotated CW by `northAngle`) → true only if glazing EXISTS and every edge is within `NORTH_SECTOR_HALF_WIDTH` (45°) of due north. A no-glazing room has `northLit === false`, so OR1 never double-fires with D1/W1. Glazing itself is south-biased by the generator, so OR1 fires only when a room's ONLY exterior faces are northern.

### G1 — Worth a look
**Why:** A guest should be able to reach a bathroom without crossing a bedroom.
**Code:** One dwelling-level check: bedroom-blocked BFS from entrances; fires if no bathroom node survives in that reduced reachable set.

### G2 — Worth a look
**Why:** An entrance opening straight into a bedroom or bathroom skips the usual public threshold (deliberate in studios).
**Code:** Iterates `graph.entrances`; flags if the entrance's host node is a bedroom or bathroom.

### S1 — Worth a look
**Why:** An outdoor space with more than two doors is over-connected — usually balconies are a leaf, not a through-route. Glazing doesn't count: a continuous balcony band with a french window onto three rooms is a normal typology.
**Code:** Outdoor cluster nodes with **door** degree `> 2` (`ctx.doorDegree` — authored doors only, ignoring the doorless `viaFrench` links every other rule counts).

### S2 — Worth a look
**Why:** A living room with one door or none isn't functioning as the social hub it's meant to be.
**Code:** Living nodes with degree `<= 1`.

### S3 — Worth a look
**Why:** A bedroom sharing a wall with a kitchen or a public room compromises privacy/comfort.
**Code:** `edgeViolations` on TOUCH edges, `pair(bedroom, kitchen-or-public)`.

### AC1 — Worth a look
**Why:** A bedroom sharing a wall with a stair takes impact + airborne noise (SIA 181). Replaced an earlier rule (bedroom-touching-bedroom) that had no defensible grounding.
**Code:** `edgeViolations` on TOUCH edges, `pair(bedroom, stair)`.

### S5 — Note
**Why:** A door between kitchen and living room reads as open-plan — confirmed, not flagged.
**Code:** `edgeViolations` on ACCESS edges, `pair(kitchen, living)`.

### S7 — Note
**Why:** A bathroom reachable only through its own bedroom is an en-suite — the exact case H3 exempts, named positively here.
**Code:** Same bedroom-blocked-BFS pattern as H3, but targeting bathroom nodes that ARE in the full reach set and NOT in the bedroom-blocked one.

### DP1 — Worth a look
**Why:** A room 5+ doored hops from the entrance is unusually buried in the plan (space-syntax depth).
**Code:** `computeEntranceDepths()` = `accessDepths(graph, graph.entryIds)` — 0-1 BFS over ACCESS edges with stair weighting (entering a stair costs 1 hop, leaving costs 0, so a floor change costs 1 hop total). Flags rooms with depth `>= DEEP_ROOM_THRESHOLD_HOPS` (= 5).

### N1 — Worth a look
**Why:** Too much of the interior given over to circulation is inefficient. Checked whole-dwelling AND per floor, since one bloated storey can otherwise hide behind efficient others in the average.
**Code:** `computeCirculationFraction()` = (circulation-cluster cells + stair cells) ÷ (all occupied cells), outdoor excluded from both. Flags above `CIRCULATION_FRACTION_MAX` (= 0.25). `computeCirculationFractionByFloor()` shares the same per-node tally, broken out by `GraphNode.floor`; on a multi-floor dwelling the rule additionally flags any floor whose own fraction crosses 0.25, naming it and pointing at that floor's circulation/stair nodes. Suppressed on a single floor (`graph.floorCount > 1` gate) — the per-floor figure would just repeat the whole-dwelling one. The percentage(s) are also always printed in the report regardless of the flag.

### PG1 — Worth a look
**Why:** Hillier & Hanson's genotype expects public rooms shallower than bedrooms; this flags the inversion.
**Code:** `publicVsBedroomDepth()` compares mean depth of living/recreation nodes vs. bedroom nodes (reachable ones only). Flags if public mean `>` bedroom mean.

### F1 — Worth a look
**Why:** A room far from any exit is an egress concern (approximated — hop count, not fire-code metres).
**Code:** `accessDepths(graph, [...entryIds, ...stairIds])` — same 0-1 BFS machinery as DP1, seeded at entrances AND stairs. Flags rooms with distance `> ESCAPE_DEPTH_MAX` (= 4).

---

**Tier counts:** 10 hard, 19 soft, 7 note. All ids/tiers/constants verified against `src/core/rules.ts` and `src/core/windows.ts`.
