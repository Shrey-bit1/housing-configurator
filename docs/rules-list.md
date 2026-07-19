# Layout validation rules — list

All 36 rules in `src/core/rules.ts`. For each: why it's there, and how it's computed in code.

---

### E1 — note
**Why:** Reachability is measured from the entrance. With none placed, there's nothing to measure from, so this replaces the reachability flags with one note instead of firing nothing.
**Code:** Fires when `graph.entryIds.length === 0`. Message text differs based on whether `graph.entrances.length > 0` (placed-but-blocked vs never-placed).

### E2 — hard
**Why:** An entrance whose edge got built over no longer opens to the outside.
**Code:** `graph.entrances.filter(e => e.blocked)`. `blocked` is recomputed every graph build in `adjacencyGraph.ts` by re-testing the entrance's edge against current exterior edges — never cached.

### DR1 — note
**Why:** Reachability is door-based, so a plan with rooms and zero doors flags every room via H1. This note explains why, instead of leaving the wall of red unexplained.
**Code:** Fires when `graph.doorCount === 0` and at least one room node exists.

### DR2 — note
**Why:** A bedroom with 3+ doors is unusual — most carry one, sometimes two for an en-suite — and starts costing furnishable wall and privacy.
**Code:** Bedroom nodes with `ctx.degree(n.id) >= 3` (degree = count of ACCESS/door edges).

### P1 — hard
**Why:** A dwelling needs a bathroom.
**Code:** `graph.nodes.some(ctx.is.bathroom)`; flags the whole dwelling if false.

### P2 — hard
**Why:** A dwelling needs a kitchen.
**Code:** Same shape as P1, with `ctx.is.kitchen`.

### P3 — note
**Why:** More than one kitchen is unusual for a single dwelling but not wrong (shared house, granny flat).
**Code:** `graph.nodes.filter(ctx.is.kitchen).length > 1`.

### MB1 — soft
**Why:** A sleeping floor with no bathroom means a stair trip at night. Gated on a bathroom existing *somewhere* so it never double-fires with P1 on a bathroom-less flat.
**Code:** Per floor: bedrooms present AND no bathroom on that floor. Skipped entirely if no bathroom exists anywhere in the dwelling.

### H1 — hard
**Why:** A room with no doored path from an entrance can't be used.
**Code:** `ctx.reachableFrom(ctx.entryIds)` — multi-source BFS over ACCESS (door) edges from all entrances. Room nodes not in the result set are flagged.

### H2 — hard
**Why:** A room reachable only by crossing a bathroom is a privacy/practicality failure.
**Code:** Two BFS passes: full reach vs. reach with `ctx.is.bathroom` blocked as an intermediate node (not as a seed — you can still walk *into* a bathroom, just not through it). Nodes in the first set but not the second are flagged; bathrooms themselves are excluded from the flagged set.

### H3 — hard
**Why:** Same as H2 but for bedrooms — except a bathroom reached only through its bedroom is an en-suite, not a failure, so bathrooms are exempted.
**Code:** Same blocked-BFS pattern with `ctx.is.bedroom` blocked. `ctx.is.bathroom(n)` targets are explicitly excluded from the flag (that's S7's territory instead).

### H4 — hard
**Why:** A door straight from a kitchen into a bathroom is a hygiene hazard.
**Code:** `edgeViolations(graph, ctx, "H4", "hard", pair(bathroom, kitchen), access=true)` — reads ACCESS edges only.

### S6 — note
**Why:** The opposite of H4: a kitchen and bathroom sharing a *wall* with no door is efficient plumbing (stacked riser), worth confirming, not flagging.
**Code:** `edgeViolations(..., access=false, excludeAccessCovered=true)` — reads TOUCH edges, skips any pair that also has an ACCESS edge (so it never co-fires with H4 on the same boundary).

### H6 — hard
**Why:** A room reachable only by crossing outdoor space is weather-dependent.
**Code:** Same blocked-BFS pattern with `ctx.is.outdoor` blocked. No extra exemption needed — outdoor nodes are `kind: "cluster"`, not `"room"`, so they're already outside the room/stair target set.

### C1 — soft
**Why:** A circulation cluster with no doors onto it is dead space. Demoted from hard — wastes area, doesn't make the dwelling unusable.
**Code:** Circulation cluster nodes with `ctx.degree(n.id) === 0`.

### C2 — soft
**Why:** A corridor with exactly one door doesn't circulate anything — you go in and back out.
**Code:** Circulation cluster nodes with degree `=== 1`.

### A1 — soft
**Why:** SIA 500 wants ~1.2 m clear width for accessibility (2 grid cells); nothing else checks corridor width, so a plan could have 600 mm corridors with 1200 mm doors opening onto them.
**Code:** `narrowWidthCells()` helper — per circulation cluster, a cell is narrow if none of the four 2×2 cell-blocks containing it is fully inside the same cluster. Reports the narrow-cell count per cluster.

### O1 — soft
**Why:** An outdoor space with no door onto it (balcony, terrace) is unusable. Mirrors C1.
**Code:** Outdoor cluster nodes with degree `=== 0`.

### ST1 — soft
**Why:** A stair should have a door at both the floor it leaves and the floor it arrives at.
**Code:** Compares `ctx.viaStairAdj.get(n.id).size` (top-side/floor-above door count) against remaining degree (bottom-side count) per stair node; names whichever is 0.

### ST2 — hard
**Why:** An unreachable stair cuts off whatever floor it serves.
**Code:** Same reachability BFS as H1, applied to stair nodes (`ctx.is.stair`).

### D1 — hard
**Why:** A habitable room (bedroom/living/recreation) with no exterior wall gets no daylight.
**Code:** Reads `GraphNode.hasExteriorEdge`, derived once per floor in `adjacencyGraph.ts` from `buildSpaceTargets()` (which correctly excludes stairwell-hole-facing edges — a past bug source).

### D2 — soft
**Why:** Same check for kitchens, soft not hard — internal kitchens are common and get mechanical ventilation.
**Code:** Same `hasExteriorEdge` check, `ctx.is.kitchen` nodes.

### W1 — soft
**Why:** A room's actual glazing falls short of its type's daylight target.
**Code:** Reads `node.glazing.belowTarget`, computed by `computeWindows()` in `windows.ts` (per-type ratio: `1/6` living/recreation, `1/10` bedroom/kitchen, kitchen fixed at 2 edges, 2-edge minimum everywhere). Gated on `hasExteriorEdge` so it doesn't double-fire with D1/D2 on a room with no facade at all.

### OR1 — soft
**Why:** A habitable room (or kitchen) lit only from the north gets no meaningful direct sun (solar-access practice at this latitude). A heuristic, not a code failure.
**Code:** `(ctx.is.habitable(n) || ctx.is.kitchen(n)) && n.glazing.northLit`. `northLit` is computed in `computeWindows()` (which now takes `northAngle`): each windowed edge's side → compass bearing (`orientation.ts`, north = world −Z rotated CW by `northAngle`) → true only if glazing EXISTS and every edge is within `NORTH_SECTOR_HALF_WIDTH` (45°) of due north. A no-glazing room has `northLit === false`, so OR1 never double-fires with D1/W1. Glazing itself is south-biased by the generator, so OR1 fires only when a room's ONLY exterior faces are northern.

### G1 — soft
**Why:** A guest should be able to reach a bathroom without crossing a bedroom.
**Code:** One dwelling-level check: bedroom-blocked BFS from entrances; fires if no bathroom node survives in that reduced reachable set.

### G2 — soft
**Why:** An entrance opening straight into a bedroom or bathroom skips the usual public threshold (deliberate in studios).
**Code:** Iterates `graph.entrances`; flags if the entrance's host node is a bedroom or bathroom.

### S1 — soft
**Why:** An outdoor space with more than two doors is over-connected — usually balconies are a leaf, not a through-route.
**Code:** Outdoor cluster nodes with degree `> 2`.

### S2 — soft
**Why:** A living room with one door or none isn't functioning as the social hub it's meant to be.
**Code:** Living nodes with degree `<= 1`.

### S3 — soft
**Why:** A bedroom sharing a wall with a kitchen or a public room compromises privacy/comfort.
**Code:** `edgeViolations` on TOUCH edges, `pair(bedroom, kitchen-or-public)`.

### AC1 — soft
**Why:** A bedroom sharing a wall with a stair takes impact + airborne noise (SIA 181). Replaced an earlier rule (bedroom-touching-bedroom) that had no defensible grounding.
**Code:** `edgeViolations` on TOUCH edges, `pair(bedroom, stair)`.

### S5 — note
**Why:** A door between kitchen and living room reads as open-plan — confirmed, not flagged.
**Code:** `edgeViolations` on ACCESS edges, `pair(kitchen, living)`.

### S7 — note
**Why:** A bathroom reachable only through its own bedroom is an en-suite — the exact case H3 exempts, named positively here.
**Code:** Same bedroom-blocked-BFS pattern as H3, but targeting bathroom nodes that ARE in the full reach set and NOT in the bedroom-blocked one.

### DP1 — soft
**Why:** A room 5+ doored hops from the entrance is unusually buried in the plan (space-syntax depth).
**Code:** `computeEntranceDepths()` = `accessDepths(graph, graph.entryIds)` — 0-1 BFS over ACCESS edges with stair weighting (entering a stair costs 1 hop, leaving costs 0, so a floor change costs 1 hop total). Flags rooms with depth `>= DEEP_ROOM_THRESHOLD_HOPS` (= 5).

### N1 — soft
**Why:** Too much of the interior given over to circulation is inefficient. Checked whole-dwelling AND per floor, since one bloated storey can otherwise hide behind efficient others in the average.
**Code:** `computeCirculationFraction()` = (circulation-cluster cells + stair cells) ÷ (all occupied cells), outdoor excluded from both. Flags above `CIRCULATION_FRACTION_MAX` (= 0.25). `computeCirculationFractionByFloor()` shares the same per-node tally, broken out by `GraphNode.floor`; on a multi-floor dwelling the rule additionally flags any floor whose own fraction crosses 0.25, naming it and pointing at that floor's circulation/stair nodes. Suppressed on a single floor (`graph.floorCount > 1` gate) — the per-floor figure would just repeat the whole-dwelling one. The percentage(s) are also always printed in the report regardless of the flag.

### PG1 — soft
**Why:** Hillier & Hanson's genotype expects public rooms shallower than bedrooms; this flags the inversion.
**Code:** `publicVsBedroomDepth()` compares mean depth of living/recreation nodes vs. bedroom nodes (reachable ones only). Flags if public mean `>` bedroom mean.

### F1 — soft
**Why:** A room far from any exit is an egress concern (approximated — hop count, not fire-code metres).
**Code:** `accessDepths(graph, [...entryIds, ...stairIds])` — same 0-1 BFS machinery as DP1, seeded at entrances AND stairs. Flags rooms with distance `> ESCAPE_DEPTH_MAX` (= 4).

---

**Tier counts:** 10 hard, 19 soft, 7 note. All ids/tiers/constants verified against `src/core/rules.ts` and `src/core/windows.ts`.
