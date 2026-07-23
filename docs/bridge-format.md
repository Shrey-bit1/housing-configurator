# `dwelling-unit` v1 — the flat → building bridge format

The handoff file from **Re_Configure** (the flat editor, the export side) to
**bottom-up-design** (the building packer, the import side). Direction is
deliberate and load-bearing: *the inhabitant designs the dwelling first; the
building aggregates authored dwellings.* The building never hands down
envelopes, and it never mutates a flat's interior — a placed unit is
inviolable. Edge classifications flow **upward as requirements** (glazed/open
edges want facade, the entrance edge needs corridor, blank edges are free
party-wall material), and the packer treats them advisorily: it **scores
against burying authored intent rather than forbidding it**, and reports the
conflict — the same advisory-not-blocking stance both apps already hold at
their own scales.

This document is the format's **source of truth**. The exporter lives in
Re_Configure (`src/core/unitExport.ts`); the importer lives in
bottom-up-design (`bridgeImport.ts`). The JSON file is the *entire* interface
— neither codebase depends on the other.

## The JSON shape

```jsonc
{
  "format": "dwelling-unit",       // fixed discriminator
  "version": 1,
  "name": "…",                     // user-facing unit name (from the export dialog)
  "color": "#rrggbb",              // hex STRING (bottom-up convention)
  "cellSize": 0.6,                 // meters — the contract is 0.6 VERBATIM (see Grid contract)
  "northAngle": 0,                 // the flat's authored north, degrees — informational (see Orientation)
  "storeys": [                     // index 0 = entry storey (Re_Configure floor 0)
    {
      "cells": [[x, z], …],        // occupied cells, normalized (see Normalization)
      "edges": [                   // EVERY exterior boundary edge of this storey, classified
        { "cell": [x, z], "side": "N|S|E|W", "class": "entrance|glazed|open|blank" }
      ],
      "height": 3.0                // this storey's floor-to-floor, meters
    }
  ],
  "sourceProject": { … }           // the full flat-configurator-project JSON, embedded VERBATIM
}
```

## Coordinate convention and the exact mapping

Re_Configure is **Y-up**: the plan is the X/Z plane, cells are `{cx, cz}`
objects, floors stack along +Y. bottom-up is **Z-up** (tekto convention): the
plan is the X/Y plane, cells are `[x, y]` tuples, storeys stack along +Z.

**All conversion happens in bottom-up's importer — never inside either core.**
The file itself is written in Re_Configure's plan terms: a cell is `[x, z]`
(that is, `[cx, cz]`), a storey index counts Re_Configure floors bottom-up.

The importer's mapping is the direct axis relabel:

| file (Re_Configure plan) | bottom-up plan |
|---|---|
| `x` (= `cx`) | `x` |
| `z` (= `cz`) | `y` |
| storey index | `z` (storey) |

Side letters map to bottom-up neighbour deltas the same way (Re_Configure's
`SIDE_DELTA`: north = −z, south = +z, east = +x, west = −x):

| side | Re_Configure neighbour | bottom-up neighbour `[dx, dy]` |
|---|---|---|
| `N` | `(cx, cz−1)` | `[0, −1]` |
| `S` | `(cx, cz+1)` | `[0, +1]` |
| `E` | `(cx+1, cz)` | `[+1, 0]` |
| `W` | `(cx−1, cz)` | `[−1, 0]` |

Because cells and edges pass through the *same* relabel, edge↔cell
registration and footprint **chirality are preserved by construction** — the
mapping introduces no reflection. What the relabel does *not* fix is the
real-world compass bearing of the axes; v1 deliberately doesn't score
orientation (see Orientation below), so that is a recorded limitation, not a
bug.

## Normalization — one translation per unit

The exporter computes the minimum `x` and minimum `z` over the **union of ALL
storeys' cells**, and applies that single translation to every storey's cells
AND edges. Storeys are **never normalized independently** — storey footprints
may differ, and their mutual registration (where the stair lands on the storey
above) is meaningful. After normalization the unit's bounding box starts at
`[0, 0]` but an individual storey's own min corner may not.

Nothing about the flat's world/grid position is recorded — placement is
entirely the building's decision.

## Grid contract — 0.6 m verbatim, no rationalization

`cellSize` is **0.6** and the importer **rejects any other value** (never
rescales). In bridge mode the building runs its fine grid at `fineXY = 0.6`,
so flat footprints transfer **cell-for-cell**. Native bottom-up preset types
use `moduleCells = 4` (2.4 m modules) so they keep sensible apartment-scale
granularity on the fine grid; imported units use the per-type **`module: 1`**
override (already present in `UnitType`) so their cells ARE fine cells.

> Note: no native preset exercised `module: 1` before the bridge; the importer
> work verified it end-to-end (placement, orientations, corridor door-finding)
> before building on it.

## Vertical contract

Bridge mode sets the building's uniform `cellZ` to **3.0 m** — Re_Configure's
default derived floor height (`(max(4, tallest room) + 1) × 0.6`). Exported
storey heights are carried **per storey** in the file; if any imported
storey's `height ≠ cellZ`, the importer accepts it and surfaces an **advisory
warning per unit** (report, don't block). There are **no per-unit floor
heights in the building grid in v1** — a taller-than-3.0 flat still occupies
one 3.0 m storey slab in the building model; the warning is the honest record
of that mismatch.

## Orientation — quarter-turns only, never mirror

The packer may rotate an imported unit through the **4 quarter-turns**; edge
metadata rotates **with** the footprint. The packer must **NEVER mirror** an
imported unit — a designed flat is chiral (its rooms, door swings, and
furnishing have handedness). bottom-up's `orientations()` already contains no
mirror; the bridge makes that property **load-bearing** — do not add one.
Orientation de-duplication must compare **edges as well as cells**: two
rotations with identical cell sets but different edge classifications are
distinct orientations.

**Recorded v1 limitation:** `glazed` edges were derived under the flat's
authored `northAngle` with a south bias. Rotating the unit in the building
changes those edges' real-world bearing, and **v1 does not score
orientation** — glazing burial is scored, glazing *bearing* is not. That is
the future `SunPosition` upgrade. `northAngle` is carried informationally
for that future and for provenance.

**Click-through rule (future, binding on implementers):** any future
click-through from a placed unit back into the flat editor must **compose the
placement rotation into `northAngle`** before opening `sourceProject`, so
re-derived windows match the as-built unit rather than the pre-placement
authoring orientation.

## Storey count

A unit may have **any number of storeys** (index 0 = entry storey). Native
presets stop at 2; the importer/placement loop iterates storeys generically —
implementations must not cap the count.

## Entrance semantics

- The exporter emits an `entrance` edge for every **NON-blocked** authored
  entrance on storey 0 (blocked = the entrance's host cell no longer resolves
  to a room/cluster, or its edge is no longer exterior — the same
  re-validation the adjacency graph performs). At least one is required for
  export (a hard export gate).
- In the building, a placement is **feasible only if, after packing, the
  corridor network can reach at least one authored entrance edge**. The
  corridor "door" cell is the free cell directly adjacent to (outward of)
  such an edge. For imported units, bottom-up's corridor Dijkstra **target
  set is constrained to exactly those cells**, replacing its native "cheapest
  adjacent free cell" freedom. Native presets keep their free-door behaviour.
- A unit placeable nowhere (no position/orientation reaches any entrance
  edge) is skipped and counted under its own counter — distinct from the
  pre-existing `unreached` counter, which means *placed but corridor-failed*.
- Surplus entrance edges that end up buried are **counted and reported**, and
  weigh into fitness more heavily than glazing (a dead door is worse than a
  blocked window — see below).

## Glazing / open-air semantics

- `glazed` — a derived window (Re_Configure's `computeWindows`) places
  glazing on this edge.
- `open` — an exterior edge of an **Outdoor** cluster (balcony/terrace):
  never glazed, but needs open air just as much.
- Both want facade. In the building, an edge is **buried** when its
  outward-facing neighbour cell is occupied (unit/corridor/core) **or**
  belongs to an **enclosed empty pocket with no path to the building
  exterior** (classified by a border flood fill — the facade/void distinction
  of `lib/voxelFaces.ts` — not naive same-storey adjacency, so a sealed
  1-cell slot counts as buried).
- Burying is **legal but penalized**: per unit,
  `w_g · buriedGlazedLength + w_g · buriedOpenLength + w_e · buriedEntranceCount`,
  lengths in meters (absolute, not fractions), `w_e > w_g` scaled so one dead
  door outweighs a typical window band. The penalty subtracts from the
  building's `fitness()`; the status report carries per-building and per-unit
  advisory lines. Units with zero glazed/open length contribute 0 and report
  as "no authored glazing" (never 0% or NaN).
- `blank` edges are free party-wall material — no cost, ever.

Edge class priority when one physical edge qualifies twice (e.g. an entrance
authored on an Outdoor cluster's edge): `entrance > glazed > open > blank`.
(`glazed`/`open` cannot actually collide — clusters never receive windows —
and windows already skip entrance edges; the ordering is stated for
completeness.)

## `sourceProject` — provenance, opaque

The full `flat-configurator-project` JSON, embedded **verbatim** (byte-
identical to a normal Save at export time). The importer carries it — and
`northAngle` — attached to the unit as **opaque provenance**; it must not
parse or interpret it. It exists for the future click-through back into the
flat editor (see the click-through rule under Orientation).

## Versioning

`version` starts at 1. **Additive fields are tolerated** — a reader must
ignore fields it doesn't know and default fields that are absent (the same
tolerant stance as `flat-configurator-project`). Any **breaking** change to an
existing field's meaning or shape bumps `version`.
