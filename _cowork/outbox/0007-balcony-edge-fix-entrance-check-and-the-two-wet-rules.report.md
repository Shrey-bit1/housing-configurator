---
id: "0007"
title: Balcony edge fix, entrance check, and the two wet rules
source: 0007-balcony-edge-fix-entrance-check-and-the-two-wet-rules.md
status: partial
branch: main
commit: 60b3b47
completed: 2026-07-30
---

## Summary

All eight tasks were carried out and both builds are clean, so the code side is
complete. Run 0006's seven files are committed as `60b3b47`. The balcony defect is
fixed by defining `isFacadeEdge` once and using it in both the view's skip set and the
new FAC1 rule. A later review of that helper found two defects in it, a sealed empty
pocket and a sealed courtyard both reading as facade, and both are fixed by rebuilding
it as the union of `floor.isOutside` and `floor.semiExterior.boundary`, which finding 3b
covers in full. E1 already covers the missing entrance, so nothing was added there. WET1
and FAC1 exist, the README table is regenerated from the code at 39 rules, and
`PROJECT_STATE.md` records all of it.

The verification is where this run is short. The browser pane was displayed at task 0
and disappeared partway through the interactive check, after two rooms had been placed
and before the balcony could be made adjacent. What was seen is real but partial, and
the three specific browser checks the prompt asked for were not completed.

## What I did

Task 0 came first as instructed, and it mattered: the pane was displayed, which is why
this run attempted interactive verification at all. Task 1 followed immediately, since
committing verified work before touching anything else keeps the diff readable.

The design work sat in task 2. The prompt's suspected mechanism was correct, and the
fix could have been a two-line exception inside `partitionEdges`. It was extracted into
a named function instead, because task 5 needed the same test and the whole point of the
pairing is that the drawing and the check cannot drift. Placing it in `exteriorEdges.ts`
puts it beside the stricter definition it deliberately differs from, where anyone
reading one meets the other.

Task 3 turned out to need no code. Tasks 4 and 5 needed no `RuleContext` change either,
which was not obvious at the start: the graph node already carries `cells`, `floor` and
`roomTypeId`, so both rules read geometry through nodes rather than through a new
context field.

- `src/core/exteriorEdges.ts` gained `isFacadeEdge`, later rewritten by the amendment.
- `src/core/floorManager.ts` rewrote `partitionEdges` around it. It briefly gained an
  `outdoorCellKeys` helper, which the amendment deleted.
- `src/core/adjacencyGraph.ts` gained the `hasFacadeEdge` node field and its derivation.
- `src/core/rules.ts` gained WET1 and FAC1.
- `README.md` rule table regenerated from `RULES`.
- `PROJECT_STATE.md` §5 and §8 updated.

## Findings

### 1. The pane state at task 0

Displayed. The first screenshot returned the app at 800×789 with an empty floor 0 and
the `Interface view` button present in the bottom-right controls. Interactive work was
therefore attempted.

It stopped being displayed later in the run, during task 2's verification. Every
screenshot from that point returned:

```
screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames. Display the pane and retry.
```

The page itself kept running, so `javascript_tool` continued to work and was used to get
the rule output quoted below. Only pixels were lost.

### 2. The task-1 commit

`60b3b472ca095c284b4228ef23e32a1bc5bb5796`, message `Interface view (run 0006, verified
by Shrey)`. `git show --stat`:

```
 PROJECT_STATE.md         |  25 ++++++++++++
 index.html               |   1 +
 src/core/floor.ts        |   7 ++++
 src/core/floorManager.ts | 101 ++++++++++++++++++++++++++++++++++++++++++++++-
 src/core/modules.ts      |  26 ++++++++++++
 src/main.ts              |  12 ++++++
 src/scene/doorView.ts    |   9 +++++
 7 files changed, 179 insertions(+), 2 deletions(-)
```

Exactly the seven files named. `git status --porcelain` beforehand also listed four
paths that were deliberately left out: `_cowork/inbox/0007-...md`, which the record
commit takes, and three untracked files under `docs/` (`research-precedents.md`,
`research-swiss-regulations.md`, `review-storyline-2026-08-04.md`) written outside this
run and outside its remit.

### 3. The facade-edge helper, first version

**Superseded by finding 3b.** Kept here because the reasoning that led to it is still
the reasoning behind the corrected version, and because the defects only make sense
against what they replaced.

`isFacadeEdge`, as first written. Signature:

```
export function isFacadeEdge(
  cx: number,
  cz: number,
  side: Side,
  occupied: Set<string>,
  isOutdoor: (cx: number, cz: number) => boolean
): boolean {
  const [dx, dz] = SIDE_DELTA[side];
  const nx = cx + dx;
  const nz = cz + dz;
  return !occupied.has(`${nx},${nz}`) || isOutdoor(nx, nz);
}
```

Both call sites:

- `src/core/floorManager.ts`, inside `partitionEdges`, which now skips an edge only when
  it is NOT facade. The outdoor test comes from `outdoorCellKeys(floor)`, which reads
  the store the same way `computeSemiExterior` does, preferring `floor.effectiveCells`
  over the placed footprint so expansion is accounted for. It is computed once per floor
  rather than once per room, and only when the view is on.
- `src/core/adjacencyGraph.ts`, in `buildFloorNodes`, deriving the new
  `GraphNode.hasFacadeEdge` beside the existing `hasTrueExteriorEdge`. FAC1 reads that
  field, so the rule and the view run the same function over the same occupancy set.

Assumption 1 held exactly. The old condition was `if (!occupied.has(...)) continue;`
with no outdoor exception, so a balcony cell, being occupied, made the boundary read as
an interior partition.

Assumption 3 is where this report can only go part way. The claim that un-skipping the
edge brings existing geometry back and builds nothing new is true by construction: the
skip set is subtractive, and an edge absent from it takes the ordinary path that already
builds the wall and its french-window glazing in the normal view. It was not observed on
screen, for the reason in finding 1.

One thing worth recording about the wider definition, and it survives the amendment.
`exteriorEdges` answers "does this edge see open sky" and correctly says no for a balcony
boundary; `hasSemiExteriorEdge` answers "does this room have french-window glass" and
requires the balcony run to have qualified. `isFacadeEdge` answers a third question, "is
this edge part of the enclosure". The three sit next to each other and the doc comments
say which is which.

### 3b. Amendment: two defects in the helper, found by review

Review of the first version of `isFacadeEdge` found two defects, and both were the same
mistake made twice, which was reading "no room here" as "outside". Neither was observed
failing, because task 8's browser checks never ran.

The first version tested `!occupied.has(neighbour) || isOutdoor(neighbour)`. Branch one
says only that no space occupies the cell, while open sky additionally requires the cell
to be reachable from the grid border, which is what `Floor.isOutside` means and why
`exteriorEdges` takes both `occupied` and `isOutside` and requires both. A room walling
off an empty pocket therefore had a facade onto that pocket, so the interface view kept
the wall and FAC1 passed the room. Branch two scanned for outdoor-cluster cells with a
bespoke `outdoorCellKeys()`, which counts a sealed courtyard, while
`computeSemiExterior` already rejects outdoor clusters that reach no sky at
`semiExterior.ts:126-132`, commented "sealed courtyard — no sky, confers nothing". So a
balcony enclosed on all sides conferred nothing anywhere else in the app and facade here.

The corrected helper takes the union of two derived answers and decides nothing itself.
`src/core/exteriorEdges.ts:88-100`:

```
export function isFacadeEdge(
  cx: number,
  cz: number,
  side: Side,
  occupied: Set<string>,
  isOutside: (cx: number, cz: number) => boolean,
  isSemiExterior: (cx: number, cz: number, side: Side) => boolean
): boolean {
  const [dx, dz] = SIDE_DELTA[side];
  const nx = cx + dx;
  const nz = cz + dz;
  return (!occupied.has(`${nx},${nz}`) && isOutside(nx, nz)) || isSemiExterior(cx, cz, side);
}
```

All three call sites after rewiring. In `src/core/floorManager.ts:272-273`, the
predicate built once per floor:

```
      const isSemiExterior = (x: number, z: number, s: Side) =>
        floor.semiExterior?.boundary.has(edgeKey(x, z, s)) ?? false;
```

at `floorManager.ts:328`, where the view builds its skip set:

```
            ? { skip: this.partitionEdges(cells, occupied, inst.origin, floor.isOutside, isSemiExterior) }
```

and inside `partitionEdges` at `floorManager.ts:374`:

```
        if (isFacadeEdge(c.cx, c.cz, side, occupied, isOutside, isSemiExterior)) continue;
```

In `src/core/adjacencyGraph.ts:253-254` and `:263`, where FAC1's node flag is derived:

```
  const isSemiExterior = (x: number, z: number, sd: Side) =>
    floor.semiExterior?.boundary.has(edgeKey(x, z, sd)) ?? false;
...
      SIDES.some((s) => isFacadeEdge(c.cx, c.cz, s, occupied, floor.isOutside, isSemiExterior))
```

`outdoorCellKeys()` is deleted, along with both `outdoorKeys` / `isOutdoor` pairs. The
search run over the whole source tree was
`grep -rn "outdoorCellKeys\|isOutdoor\|outdoorKeys" src/`, which printed `NONE`.

**The stair-hole question is confirmed, and the answer did not simplify the signature.**
`semiExterior.ts:100` builds its occupancy as
`const spaces = new Set(buildSpaceTargets(floor, floorBelow).keys());`, commented "spaces
only (rooms + clusters + stairs + hole projections)". That is the same call with the same
arguments that produces `occupied` in both consumers, so hole projections are accounted
for identically and an occupied in-bounds cell can never be border-reachable-empty. On
that basis `isOutside` does subsume `!occupied.has(...)`. It was still kept, for a
different reason found while checking: `Floor.isOutside` at `floor.ts:123-124` is
`this.semiExterior?.isOutside(cx, cz) ?? true`, so before the first derive pass, when no
plan exists, it returns true for every cell including occupied ones. Dropping `occupied`
would make every edge facade in that window. Both conditions are kept deliberately, and
the doc comment records the reasoning so the next reader does not re-open it.

**The bathroom asymmetry is documented rather than fixed**, as instructed. `boundary`
skips bathroom-to-outdoor boundaries at source for privacy (`semiExterior.ts:151`,
`if (isBathroom(def)) continue`), so the predicate is really "is this a glazable
room-to-outdoor boundary". Neither consumer can reach that case today, because the
interface view keeps wet rooms whole and FAC1 only tests habitable rooms. The doc comment
on the helper says so and names the case a third consumer would hit.

**Which browser check would have caught these.** Honestly, neither. Task 8's three checks
were a room beside a balcony, a split kitchen and bathroom, and a bedroom enclosed by
other rooms. A room beside an open balcony exercises the semi-exterior branch on its
qualifying path, which both versions get right. A sealed courtyard needs a balcony ringed
by rooms on all four sides, and a sealed empty pocket needs rooms placed around a gap
they leave deliberately; neither happens while clicking around, and the third check comes
closest only by accident, since a bedroom enclosed on all four sides also creates the
pocket, but only if a gap is left rather than the rooms being flush.

What would catch them is a unit test on `isFacadeEdge` itself, given a hand-built
occupancy set: one case with an empty pocket, one with a sealed courtyard, one with open
sky, one with an open balcony. That is four assertions and no rendering. This repository
has no test suite at all, which is exactly why both defects had to be found by reading,
and a rule that reads geometry and has no test is the thing this repository is currently
least able to verify. Two rules now read geometry.

### 4. The entrance rule already exists

E1, at `src/core/rules.ts:434-448`, severity `note`. Nothing was added.

```
  {
    id: "E1",
    severity: "note",
    description: "Place an entrance to validate circulation/reachability.",
    check(graph, ctx) {
      if (ctx.hasEntrance) return [];
      const description =
        graph.entrances.length > 0
          ? "All entrances are blocked — none currently open to the outside. Reachability can't be validated."
          : RULES_BY_ID.E1.description;
      return [{ ruleId: "E1", severity: "note", description, nodeIds: [], layout: true }];
    },
  },
```

It fires whenever no non-blocked entrance exists, and it distinguishes never having
placed one from having placed one that is now blocked. E2 (`hard`) is the companion,
firing per entrance whose edge no longer faces outside.

Confirmed live rather than only read: with one living room and one balcony on the floor
and no entrance, Check Layout returned, among others, `E1 · NOTE / Place an entrance to
validate circulation/reachability.`

One detail the prompt's fallback implies but the code does not match. The prompt said to
add a **soft** rule if none existed. E1 is `note`, which under the taxonomy at
`rules.ts:31-41` means characterisation rather than judgment. A missing entrance
arguably is a judgment, and the interface argument makes it more so, since the entrance
is the unit's handshake with the building. Changing E1's severity was out of scope here
and is flagged rather than done.

### 5. The two new rules

Both at the end of `RULES`, `src/core/rules.ts:1120-1191`, under a comment explaining
why they read geometry.

WET1, severity `soft`:

```
  {
    id: "WET1",
    severity: "soft",
    description:
      "Wet rooms (bathrooms, kitchen) are split across separate groups on a floor. " +
      "Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.",
    check(graph) {
      const out: Violation[] = [];
      const byFloor = new Map<number, GraphNode[]>();
      for (const n of graph.nodes) {
        if (n.kind !== "room" || !WET_TYPES.includes(n.roomTypeId)) continue;
        const list = byFloor.get(n.floor) ?? [];
        list.push(n);
        byFloor.set(n.floor, list);
      }
      for (const [floor, nodes] of [...byFloor].sort((a, b) => a[0] - b[0])) {
        const groups = connectedComponents(nodes.flatMap((n) => n.cells));
        if (groups.length < 2) continue;
        const where = groups
          .map((g) => {
            const cx = Math.min(...g.map((c) => c.cx));
            const cz = Math.min(...g.map((c) => c.cz));
            return `(${cx},${cz})`;
          })
          .join(", ");
        out.push({
          ruleId: "WET1",
          severity: "soft",
          description:
            `Floor ${floor}: wet rooms form ${groups.length} separate groups, at ${where}. ` +
            `Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.`,
          nodeIds: nodes.map((n) => n.id),
        });
      }
      return out;
    },
  },
```

FAC1, severity `hard`:

```
  {
    id: "FAC1",
    severity: "hard",
    description:
      "Habitable room has no facade — it touches neither open sky nor a balcony. " +
      "(PBG LS 700.1 § 302: every habitable room needs a facade window)",
    check(graph, ctx) {
      return graph.nodes
        .filter((n) => ctx.is.habitable(n) && !n.hasFacadeEdge)
        .map((n) => ({
          ruleId: "FAC1",
          severity: "hard" as const,
          description:
            `${n.label} has no facade — it touches neither open sky nor a balcony. ` +
            `(PBG LS 700.1 § 302: every habitable room needs a facade window)`,
          nodeIds: [n.id],
        }));
    },
  },
```

Message text as it would fire, which is composed rather than observed, because neither
rule was made to fire before the pane went:

- WET1: `Floor 0: wet rooms form 2 separate groups, at (3,4), (11,9). Split wet areas
  mean long installation runs and shafts that cannot bundle to the next storey.` The
  literal cell coordinates depend on the layout; the sentence structure is exact.
- FAC1: `Bedroom — Small has no facade — it touches neither open sky nor a balcony.
  (PBG LS 700.1 § 302: every habitable room needs a facade window)`

WET1 reads cells rather than graph nodes, as the prompt asked to be noted. It groups wet
nodes by `n.floor`, flattens their `cells`, and hands them to `connectedComponents`
(`src/core/cluster.ts:10`), whose own comment states it groups by orthogonal
4-neighbour adjacency and that cells touching only at a corner are not connected. That is
exactly the semantics the prompt specified, and reusing it means the rule, the connector
clusters and the adjacency graph all agree on what "one group" means.

FAC1 uses `ctx.is.habitable`, whose doc comment at `rules.ts:122-126` defines it as
bedrooms plus public rooms, meaning Living and Recreation, with kitchens handled
separately by D2. That is assumption 7's list exactly, so the scope was adopted rather
than re-specified. Stating it as the prompt asked: habitable here is `living`,
`bedroom_small`, `bedroom_large`, `recreation`, and bathrooms, kitchen, circulation,
outdoor and stairs are all outside FAC1.

### 6. What was added to RuleContext

Nothing. `GraphNode` already carried `cells`, `floor` and `roomTypeId`, so WET1 reads
geometry through nodes. FAC1 needed a derived answer rather than raw geometry, so the
node gained one boolean field, `hasFacadeEdge`, computed in `adjacencyGraph.ts` next to
`hasTrueExteriorEdge` and `hasSemiExteriorEdge` and documented as wider than both.
Adding it to the node rather than to `RuleContext` keeps the derivation with the other
derivations and keeps rules reading nodes.

This contradicts assumption 4's expectation that the context might need to grow.

### 7. The README by counts

Before: 24 rules documented, including a phantom `S4` that does not exist in `RULES`,
against 37 in the code. After: 39 rules documented, `S4` gone, matching `RULES` exactly.
Net movement is 15 rules added to the documentation, one phantom removed, and two of the
39 are this run's new rules.

The table is generated from the code rather than hand-written, by parsing the `id`,
`severity` and `description` fields out of `RULES`. Two descriptions are template
literals referencing constants, so `DP1` and `F1` had their `${DEEP_ROOM_THRESHOLD_HOPS}`
and `${ESCAPE_DEPTH_MAX}` substituted with 5 and 4 and a note of the constant name.

### 8. The browser checks

Two of the three were not reached, and the third was only partly reached.

What was actually seen, before the pane went: the app loaded with an empty floor; a
Living Room was placed by dragging from the palette onto the grid and rendered with its
walls, slab and furniture; an Outdoor — Double balcony was placed and rendered; a second
attempt to move the balcony against the room's east wall selected it instead of moving
it, and the readout confirmed `Outdoor — Double · Floor 0 · 2×1`. The balcony was never
made adjacent to the room, which is precisely the condition the fix concerns.

What was obtained after the pane went, through the page rather than through pixels.
Clicking Check Layout returned:

```
DWELLING — LAYOUT CHECK
4 issues (2 hard, 2 soft)
HARD — LIKELY FAILURES
P1 · HARD   A dwelling needs a bathroom.            Whole dwelling
P2 · HARD   A dwelling needs a kitchen.             Whole dwelling
SOFT — ATYPICAL, NOT WRONG
O1 · SOFT   Outdoor space is unconnected — nothing opens onto it.   Room: Outdoor
S2 · SOFT   Living room under-connected (one or no doors) — typically a social hub.   Room: Living Room
NOTES
E1 · NOTE   Place an entrance to validate circulation/reachability.   Whole dwelling
DR1 · NOTE  No doors placed — reachability requires doors.            Whole dwelling
Circulation: 0% of interior area.
GLAZING ORIENTATION
Living Room: glazing S
```

Three things follow from that output. The rules engine runs with WET1 and FAC1 present
and throws nothing, which is the integration check. E1's text is confirmed against a
live run rather than only read from source. And FAC1 stayed silent on the Living Room,
which is the correct negative: that room sits on an otherwise empty floor, so every
boundary edge faces unoccupied cells and `hasFacadeEdge` is true. WET1 also stayed
silent, correctly, because the floor has no wet rooms at all, which P1 and P2 confirm
from the other direction.

**Manual steps for the three unfinished checks.** Place a Living Room, then an Outdoor —
Double directly against one of its walls, and turn on `Interface view`: the wall between
them should stand with its glazing while the room's other partitions dissolve, and the
balcony parapet should be unchanged. For WET1, place a Kitchen and a Bathroom — Small
with a gap between them and press Check Layout, expecting the WET1 line; then move one
against the other and press it again, expecting the line to go. For FAC1, place a
Bedroom — Small and surround it on all four sides with other rooms so no edge reaches
open sky or a balcony, then press Check Layout, expecting the FAC1 line naming that
bedroom; pulling one surrounding room away should clear it.

**Claims left unproven.** That the room-to-balcony wall and its glazing stand in the
interface view. That WET1 fires on a split layout, and its exact rendered text. That
FAC1 fires on an enclosed habitable room, and its exact rendered text. That the
interface view still restores exactly after the facade change.

### 9. tsc and npm run build

```
npx tsc --noEmit
--- exit 0 ---
```

```
npx vite build
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 10.83s
```

Both were re-run after the amendment and both are still clean; the times quoted are the
later run. The chunk-size warning predates this run.

### 10. What contradicts the Assumptions section

Assumption 1 holds exactly, including the suspected mechanism.

Assumption 2 holds. Outdoor and circulation cells sit in the same occupancy set as rooms,
which is why the defect existed.

Assumption 3 holds by construction and was not seen on screen.

Assumption 4 is contradicted in two ways. There are 37 rules before this run, which is
right, but the two new rules needed no `RuleContext` addition, because `GraphNode`
already carries the cell geometry. The context was not the missing piece.

Assumption 5 holds. E1 and E2 exist and their subject is the entrance. Shrey is right
that a no-entrance rule is already among the 37, and it is E1.

Assumptions 6, 7, 8 and 9 hold. On 7 in particular, `ctx.is.habitable` already means the
four types named, so the scope was inherited rather than invented.

### 11. My own assumptions

Four, none covered by the Assumptions section.

1. **That `connectedComponents` is the right flood fill.** Its comment says orthogonal
   4-neighbour with corners excluded, which matches the prompt, so WET1 uses it rather
   than a private one. Affects WET1's grouping semantics. If the shared helper's
   definition ever changes for the cluster shells, WET1 changes with it.
2. **That group position is best reported as each group's minimum cell.** The prompt said
   to name where each group sits without saying how. Minimum cell is compact and stable
   under redraw. Affects only WET1's message text.
3. **That the README's grouped sub-headings could be replaced by one ordered table.**
   The prompt said to keep the existing table format, which the columns and severity
   icons do. The per-theme sub-headings were dropped because the code order already
   groups by theme and maintaining a second grouping by hand is what let the old table
   drift. Affects README shape only, and is easy to undo.
4. **That FAC1 should read a derived node field rather than recompute geometry.** Adding
   `hasFacadeEdge` costs one boolean per node on every graph build, whether or not FAC1
   is consulted. Affects graph build cost by a negligible amount and keeps the rule
   trivial.
5. **That `semiExterior.boundary` is the right predicate for the room-to-outdoor half**
   (added by the amendment). It is populated at `semiExterior.ts:167-168` before the
   band-width logic, so solid returns and single-cell contacts are in it, and it holds
   both representations of each physical boundary so either side matches. What it also
   carries is the bathroom exclusion, which makes the predicate narrower than "touches a
   balcony". Affects any future consumer that asks about a bathroom's balcony wall, and
   is documented on the helper rather than worked around.
6. **That keeping `occupied` beside `isOutside` is worth the redundancy** (added by the
   amendment). The two are redundant once a semi-exterior plan exists and are not
   redundant before the first derive pass, where `Floor.isOutside` falls back to `true`
   for every cell. Affects only the pre-derive window, which no user ever sees, so this
   is insurance rather than a live correctness fix.

## Evidence

Rungs stated separately.

- Task-1 commit contents: `git show --stat` on `60b3b47`, quoted above. Executed.
- Assumption 1's old condition: read at `src/core/floorManager.ts` before the change.
  Read.
- Helper and both call sites: read from the files after the change. Read.
- `connectedComponents` semantics: read from its doc comment at `src/core/cluster.ts:4-10`.
  Read.
- `ctx.is.habitable` scope: read from `src/core/rules.ts:122-126`. Read.
- E1 exists and its text: read from source AND observed firing in a live Check Layout.
  Executed.
- Both new rules integrate without error, and FAC1 and WET1 correctly stay silent on a
  layout with facade and no wet rooms: observed in a live Check Layout. Executed, though
  these are negative results.
- Rule count 39, README before 24 with a phantom `S4`, after 39: counted by parsing
  `RULES` and by grepping the README table rows. Counted.
- `tsc` and `npm run build`: both executed, output quoted.
- The balcony wall standing, WET1 firing, FAC1 firing: **not verified**.
- The two helper defects and their fix: found and checked by READING the code, with
  `semiExterior.ts:100`, `:126-132`, `:151` and `:167-168` and `floor.ts:123-124` quoted
  above. Read, not executed. Neither defect has a test and neither would have been caught
  by task 8's three checks.
- `outdoorCellKeys()` and both `isOutdoor` pairs are gone: `grep -rn` over `src/`
  returned `NONE`. Executed.

## Artifacts produced

- `src/core/exteriorEdges.ts`, `src/core/floorManager.ts`, `src/core/adjacencyGraph.ts`,
  `src/core/rules.ts`, `README.md`, `PROJECT_STATE.md`, all modified and left
  uncommitted for a person to read. `exteriorEdges.ts`, `floorManager.ts`,
  `adjacencyGraph.ts` and `PROJECT_STATE.md` were touched twice, once for the original
  fix and once for the amendment.
- `_cowork/outbox/0007-balcony-edge-fix-entrance-check-and-the-two-wet-rules.report.md`.
- `_cowork/done/0007-balcony-edge-fix-entrance-check-and-the-two-wet-rules.md`.
- `_cowork/LOG.md`, one row appended.

## Decisions and rationale

The facade test went into `exteriorEdges.ts` rather than `floorManager.ts`. Keeping it
next to the view would have been closer to where the bug was, and it would have put two
subtly different definitions of "outside" in two different files, which is the condition
that produced the bug in the first place. They now sit adjacent with comments saying
which question each answers.

FAC1 reads a node field rather than calling `isFacadeEdge` itself. Calling it directly
would need the rule to obtain the floor's occupancy set and outdoor cells, which
`RuleContext` does not carry, and adding those would have grown the context for one
consumer. Deriving one boolean where every other derived flag already lives was smaller.

WET1 emits one violation per floor rather than one per group. One per group would
highlight each cluster separately in the diagram, and it would also report the same
problem several times, which reads as several problems.

## Deviations from the prompt

The README's per-theme sub-headings (`**Entrance validity**`, `**Program completeness**`
and the rest) were replaced by a single table in code order. The columns, the severity
icons and the intro paragraph are unchanged, and the trailing note about Recreation Room
was kept and extended to mention the facade rule. Reason in assumption 3 above.

Task 8's three browser checks were not completed, and the prompt's fallback for a hidden
pane was applied partway through rather than at the start, because the pane was
displayed at task 0 and vanished later.

## Blocked / did not do

Nothing was blocked by permissions. The only unfinished work is task 8's browser
verification, described in finding 8 with manual steps and an explicit list of unproven
claims.

## Open questions for you

1. **E1 is a note, and the interface argument suggests it should not be.** The taxonomy
   at `rules.ts:31-41` defines note as characterisation rather than judgment, and E1
   currently sits there because, when the rules were written, a missing entrance was a
   reason the reachability rules could not run rather than a fault in its own right. The
   thesis now says the entrance is part of what the unit communicates to the building,
   which makes its absence a defect at the interface level, and that argues for soft or
   even hard. Changing it is one word. What it costs is that every existing flat in
   progress starts reporting a failure it did not report yesterday, and the 4 August
   demonstration would show it.

2. **FAC1 is hard, and it will fire constantly during normal authoring.** A habitable
   room is placed before the rooms around it exist, so mid-layout it has facade; it
   loses facade the moment it gets enclosed, which is a normal intermediate state rather
   than a finished decision. Hard severity is right for the finished artifact and
   possibly wrong for the working session, and the app has no concept of a layout being
   finished. Either the severity is softened, or the rules engine grows a notion of
   draft versus final, or the noise is accepted as the price of the rule the meeting
   named as the one that must hold.

## Suggested next prompt

Finish task 8's three browser checks and nothing else, so the run is short enough that a
hidden pane is the only thing that can stop it.

The checks are specified in finding 8 above with the exact placements and the expected
outcomes. Ask for the four screenshots, the two rendered message texts quoted verbatim,
and one explicit statement that the interface view still restores after the facade
change, since that claim was proven in run 0006 and has not been re-proven since
`partitionEdges` changed underneath it.

A practical note for whoever writes it. Placing rooms by dragging from the palette onto
the isometric grid works, and was done twice in this run. Moving an already-placed piece
by dragging selects it instead, at least on the first attempt, so a layout is easier to
build by dropping each piece where it belongs than by placing and then arranging. If the
prompt wants an exact layout, loading a prepared project file through the Import button
would remove the interaction problem entirely, and it is worth deciding whether the
bridge should keep a small library of test flats for exactly this.

Consider pairing it with the smallest possible test for `isFacadeEdge`. Two defects in
that one function were found by reading, and neither of the browser checks would have
caught either, because a sealed courtyard and a sealed empty pocket are not layouts
anyone builds while clicking around. Four assertions over a hand-built occupancy set
would cover open sky, an open balcony, a sealed pocket and a sealed courtyard, with no
rendering and no framework. That would be the first test in this repository, which is
the reason to weigh it rather than assume it: it means choosing a runner, and the
argument for choosing one now is that two rules and one view all read geometry through a
single function whose failures are invisible on screen.
