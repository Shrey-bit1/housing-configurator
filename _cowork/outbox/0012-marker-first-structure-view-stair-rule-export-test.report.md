---
id: "0012"
title: Marker first, Structure view, stair rule, export test
source: 0012-marker-first-structure-view-stair-rule-export-test.md
completed: 2026-07-30
status: partial
branch: main
commit: c78492f
---

## Summary

The pane was hidden at the probe, so tasks 2 and 3, the marker and the Structure view,
deferred by the prompt's own rule. That makes this the fourth run in which the marker has
not been built, and the cause is now clearly structural rather than incidental, which is
the most useful thing this report has to say.

What did get done is task 4, the stair rule, and it works: ST3 fires once on the
disconnected floor and the orphan pile collapses from `12 issues (1 hard, 11 soft)` to
`7 issues (1 hard, 6 soft)`, with the WET1 floor-0 invariant identical across both
fixtures. Task 6's survey is done and found one more site worth attention. Task 1 was
already committed between runs.

## What I did

The probe decided the shape of the run before anything else. With the pane hidden and
tasks 2 and 3 deferred, the remaining work is all DOM-provable, which is exactly the
asymmetry the prompt was written to fight and which it lost to again.

Task 4 was the substance. The design was fully settled by prompts 0010 and 0011, so the
work was implementing it and measuring it, and the measurement is the part worth reading.

- `src/core/rules.ts`: `computeDisconnectedFloors`, `RuleContext.disconnectedFloors`,
  the ST3 rule, and one `.filter()` each on H1, C1 and OD1.
- `testflats/flat-1-no-stair.json`: flat-1 minus its one stair instance.
- `README.md` and `PROJECT_STATE.md`.

## Findings

### 1. Pane state

Hidden, at the first screenshot before anything else:

```
screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames. Display the pane and retry.
```

It was alive for the whole of run 0011 and is hidden now. Tasks 4, 5 and 6 do not need
it, because `?project=` plus reading `#validation-panel` from the DOM works without
compositing, which is how both panels below were measured.

### 2. Task 1, already done

`c78492fc1587e34555c320073e02beebc87ead3d`, containing exactly assumption 1's four files:

```
 src/core/exteriorEdges.test.ts |  27 +++++--
 src/core/semiExterior.ts       | 167 ++++++++++++++++++++++++++---------------
 src/core/unitExport.ts         |   8 ++
 src/scene/clusterShells.ts     |  20 ++++-
 4 files changed, 152 insertions(+), 70 deletions(-)
```

It was committed and pushed between runs, on Shrey's direct instruction, before this
prompt was picked up. Its message reads `Circulation glazing, shared band construction
(run 0011)` where this prompt asks for `shared boundary construction`. The commit is
already on `origin/main`, so it was left alone rather than amended: rewriting pushed
history to correct one word is a worse trade than the mismatch.

### 3. The entrance marker

Deferred, for the fourth consecutive run. Runs 0008, 0011 and 0012 deferred it because
the pane was hidden; run 0009 and 0010 never reached it.

This is worth stating plainly rather than as scheduling noise. The marker is the only
outstanding item that CANNOT be proven through the DOM, and every run that contains both
DOM-provable work and the marker has ended with the DOM work done and the marker not.
Prompt 0012 tried to fix that by putting the marker first, and it still did not happen,
because the deferral is decided at task 0 before ordering matters. Ordering is not the
lever; the pane is.

The design has not changed since run 0008 and is fully specified in this prompt's task 2.
Nothing about it needs another planning cycle.

### 4. The Structure view

Deferred with the marker. Not started.

### 5. The stair rule, ST3

`src/core/rules.ts`, in the stair family immediately before ST1. `ST3` was free; ST1 and
ST2 are the existing members.

```ts
    id: "ST3",
    severity: "hard",
    description: "A floor is not reachable by stairs from the entrance floor.",
    check(graph, ctx) {
      if (ctx.disconnectedFloors.size === 0) return [];
      const floors = [...ctx.disconnectedFloors].sort((a, b) => a - b);
      const list = floors.map((f) => `Floor ${f}`).join(", ");
      return [
        {
          ruleId: "ST3",
          severity: "hard" as const,
          description:
            `${list} ${floors.length === 1 ? "is" : "are"} not reachable by stairs from the ` +
            `entrance floor. Every space there is cut off for this one reason.`,
          nodeIds: graph.nodes.filter((n) => ctx.disconnectedFloors.has(n.floor)).map((n) => n.id),
          layout: true,
        },
      ];
    },
```

**The gating mechanism, and why it is the least-magic one available.** The fact is
computed once by `computeDisconnectedFloors(graph)` and placed on
`RuleContext.disconnectedFloors`. H1, C1 and OD1 each gained one line:

```ts
        .filter((n) => !ctx.disconnectedFloors.has(n.floor))
```

That is E1's precedent exactly. E1 does not suppress anything; the reachability rules
each ask `if (!ctx.hasEntrance) return []` themselves. Nothing was added to the engine, no
rule knows about another rule, and a reader of H1 can see why it is quiet without leaving
the function. The alternative, a post-filter in `validate()` that drops violations whose
subjects sit on disconnected floors, would be fewer lines and would put the reason
somewhere no rule mentions.

`computeDisconnectedFloors` builds floor-level adjacency from the ACCESS graph's
`viaStair` edges, which are already door-gated, so a stair nobody can open onto does not
count as a connection. It floods from the floor or floors carrying an entrance and
returns the occupied floors it never reaches. It returns empty for a single-floor
dwelling or one with no entrance, because there is then nothing to be cut off from and E1
owns that case.

**Both panels, measured through `?project=`.**

`flat-1-two-storey.json`, the canonical baseline, unchanged:

```
12 issues (1 hard, 11 soft)
H1 · HARD, C1 · SOFT, A1 · SOFT, OR1 · SOFT, OR1 · SOFT, G1 · SOFT,
AC1 · SOFT, AC1 · SOFT, DP1 · SOFT, N1 · SOFT, WET1 · SOFT, WET1 · SOFT,
DR2 · NOTE, S5 · NOTE, S7 · NOTE, S7 · NOTE, S7 · NOTE
```

That is the run's most important negative check: ST3 is silent on a connected dwelling
and nothing that used to fire was suppressed.

`flat-1-no-stair.json`:

```
7 issues (1 hard, 6 soft)
ST3 · HARD, A1 · SOFT, OR1 · SOFT, OR1 · SOFT, G1 · SOFT, WET1 · SOFT, WET1 · SOFT,
DR2 · NOTE, S5 · NOTE, S7 · NOTE, S7 · NOTE
```

ST3's rendered text:

```
Floor 1 is not reachable by stairs from the entrance floor. Every space there is cut off for this one reason.
```

**The diff, and which disappearances the gating caused.** Five issues left the report and
they did not all leave for the same reason, which matters for reading the result
honestly.

Gated by ST3, which is what the task asked for: `H1` on Bathroom — Large (F1) and `C1` on
Circulation (F1, 8,14). Both subjects sit on floor 1 and both are now covered by the one
root-cause line.

Gone because the stair itself was deleted, not because of gating: `AC1` twice, which says
a bedroom shares a wall with a stair, and there is no longer a stair to share one with.

Gone for reasons this run did not establish: `DP1` and `N1`. DP1 reports depth from the
entrance, and floor 1 is now unreachable so its rooms have no depth, which is plausible
and unverified. N1 reports a circulation-heavy floor, and floor 1's circulation fraction
should not depend on reachability, so its disappearance is the one result here I cannot
explain. It is recorded as an observation rather than claimed as correct.

`S7` dropped from three to two, losing the floor-1 en-suite, which is consistent with
en-suite access depending on reachability.

`A1` still fires on Circulation (F1, 8,14), which is the behaviour the prompt specified:
width is true whether or not anyone can reach the corridor.

**The WET1 invariant holds.** The floor-0 line is byte-identical in both fixtures:

```
Floor 0: wet rooms form 2 separate groups, at (4,6), (8,14). Split wet areas mean long installation runs and shafts that cannot bundle to the next storey.
```

A stair is not wet and removing one changed nothing about the wet groups, which is what
the check was for.

**README** gained one row beside ST2, naming the rule and its gating.

### 6. The export test

Not done. Tasks 5 and 6 were the designated first to slip and the run reached only 6.

The cost of skipping is real and worth stating: the f2af130 invariant, that exported
glazing equals built glazing, is currently held by a comment in `unitExport.ts` and by a
human remembering. Run 0011 found it broken and fixed it by reading; nothing would catch
it breaking again. Assumption 8's premise was not tested either, so whether
`buildUnitExport` runs headlessly over a `FloorManager` remains unknown.

### 7. The filter survey

Nine sites of `def.category !== "room" || def.cluster` and its inverse. One line each.

| Site | Verdict |
|---|---|
| `src/core/modules.ts:67` `isElastic` | Legitimate. Asks which room TYPES grow; a cluster has no type in that sense. |
| `src/core/modules.ts:85` `isBathroom` | Legitimate. Type predicate over room types. |
| `src/core/modules.ts:102` `isWet` | Legitimate. Same shape, and where a shaft type would join. |
| `src/core/modules.ts:111` `isBedroom` | Legitimate. Type predicate. |
| `src/core/floorManager.ts:278` | Legitimate. Guards the per-ROOM shell rebuild; clusters are drawn by `rebuildClusterShells` instead. |
| `src/core/floorManager.ts:409` | Legitimate. The interface view's per-room strip; clusters are handled by their own branch. |
| `src/core/semiExterior.ts:157` | **Was the envelope question wearing the wrong test.** Fixed in run 0011: the corridor loop now runs the same construction. The remaining filter is correct because the room loop really is rooms-only. |
| `src/core/unitExport.ts:274` | **Was the same bug, second instance.** Fixed in run 0011 by adding cluster glazing to `glazedKeys` after this loop. The filter itself still correctly scopes the per-room `computeWindows` call. |
| `src/scene/clusterShells.ts:157` `isRoom` | **Worth a look.** It decides which neighbours a cluster dissolves toward, so it is an envelope question, and it is the line the run-0009 bug lived next to. It reads correctly today, but it is the third envelope decision expressed with a rooms-only test. |

So assumption 9 holds: there were more sites than the two already found. The count is
nine, seven are legitimate type or scope questions, two were the known bugs, and one more
is an envelope question that currently gives the right answer.

### 8. tsc, npm run build, npm test

All clean, after every change:

```
npx tsc --noEmit
TSC_CLEAN
```

```
npm test
      Tests  5 passed (5)
```

```
npx vite build
✓ built in 17.97s
```

### 9. What contradicts the Assumptions section

**Assumption 1 is out of date.** Run 0011's four files were not left uncommitted; they
were committed as `c78492f` and pushed between runs. Task 1 was therefore already done
before this run started.

**Assumption 9 holds** and finding 7 gives the count.

Assumptions 2, 3, 4, 5, 6 and 7 hold. Assumption 6 was confirmed by measurement: the
canonical baseline is exactly `12 issues (1 hard, 11 soft)` with H1 on Bathroom — Large
(F1) and C1 and A1 on Circulation (F1, 8,14). Assumptions 2, 3, 4 and 5 were not
exercised, because tasks 2 and 3 deferred. Assumption 8 was not tested.

### 10. My own assumptions

1. **That ST3 should flood from the ENTRANCE floor rather than from floor 0.** They are
   the same in every current fixture. Entrance-rooted matches how every other reachability
   rule in the file thinks, and it is right for a dwelling whose entrance is not on the
   ground floor. Affects which floors count as connected in a layout nobody has built yet.
2. **That ST3 should carry `layout: true` and name every node on the cut-off floors.**
   The flag makes it a dwelling-level issue rather than one attached to a room, and the
   node list still lets the diagram and the 3D view highlight what is affected. Affects
   how the panel renders it and what lights up on hover.
3. **That the gating goes in each rule rather than in `validate()`.** Reasoning in
   finding 5. Affects three call sites instead of one, and keeps the reason visible where
   a reader of H1 will find it.
4. **That the commit message mismatch in finding 2 should be left.** Amending a pushed
   commit to change one word is worse than the mismatch. Affects the history, which now
   says "band" where the prompt said "boundary".
5. **That N1's disappearance should be reported unexplained rather than investigated.**
   Investigating it means reading N1's computation and probably a third fixture, and the
   run had already lost two tasks. Affects finding 5, which flags it rather than resolving
   it.

## Evidence

- Pane hidden: screenshot attempt, quoted. Executed.
- Task-1 commit: `git show --stat` on `c78492f`. Executed.
- ST3 and the gating: read after writing. Read.
- Both panels: `?project=` load followed by Check Layout, `#validation-panel` read from
  the DOM, for both fixtures. Executed, and the baseline was re-measured in this run
  rather than carried over.
- The WET1 invariant: both floor-0 lines compared as strings. Executed.
- The filter survey: `grep -rn` over `src/`, nine hits, each read in place. Executed for
  the enumeration, read for the verdicts.
- `tsc`, `npm test`, `npm run build`: executed, quoted.
- The marker, the Structure view, the export test: **not done**.
- N1's disappearance: observed, not explained.

## Artifacts produced

- `src/core/rules.ts`, `README.md`, `PROJECT_STATE.md`, modified and left uncommitted.
- `testflats/flat-1-no-stair.json`, new, flat-1 with its single stair instance removed
  (23 instances on floor 0 instead of 24, floor 1 unchanged at 41).
- `_cowork/outbox/0012-marker-first-structure-view-stair-rule-export-test.report.md`.
- `_cowork/done/0012-marker-first-structure-view-stair-rule-export-test.md`.
- `_cowork/LOG.md`, one row appended.

## Decisions and rationale

The gating went into the three rules rather than into the engine because E1's precedent
is the house style and because a suppression pass is invisible from the rule it
suppresses. The cost is that a fourth rule joining the family later has to remember the
filter, and nothing enforces that.

The no-stair fixture was derived by removing instances of type `stair` from the committed
flat-1 rather than hand-authored, so the two fixtures differ in exactly one thing and the
diff means what it appears to mean.

## Deviations from the prompt

Task 1's commit already existed with a one-word difference in its message, described in
finding 2.

Tasks 2, 3, 5 and 6 did not all follow the stated drop order. The prompt expects 5 and 6
to slip first, and in the event 2 and 3 deferred at task 0 by the prompt's own rule, 6 was
cheap enough to do, and 5 slipped.

## Blocked / did not do

Tasks 2 and 3, by the hidden pane, which is the prompt's own deferral path. Task 5, by
the run ending.

**The manual verification script**, covering every deferred visual claim, in walk order.
Steps 1 to 4 are the Structure view; there is nothing to walk for the marker, because its
code was never written.

1. Open `http://localhost:5173/?project=flat-1-two-storey.json`. Expect two floors and no
   console errors.
2. Click `Structure`. Expect, under the CURRENT behaviour, elastic rooms to lose their
   walls while circulation keeps its own and the staircase disappears. Both are the wrong
   behaviours prompt 0012 task 3 describes; confirming them is the before-state.
3. Click `Structure` again and confirm the scene returns exactly.
4. Click `Interface view`, then `Structure`, and note whether they compose or fight. That
   observation is what task 3's exclusivity question needs and it costs one click.

## Open questions for you

1. **The marker will not get built by reordering tasks.** Four runs, four misses, and
   prompt 0012 already tried putting it first. The deferral happens at task 0, before any
   ordering applies, so the only levers are ensuring the pane is up before the run starts,
   or permitting the marker to be written unseen and reviewed after. The second is what
   run 0008 argued against, and the argument was that shipping an unverified redesign of
   the one object the professor could not find is worse than shipping the old one. That
   argument is weaker now than it was: the review is on Tuesday, the current marker is
   known to fail its job, and an unverified replacement can be reverted in one command.

2. **Why did N1 stop firing on the no-stair fixture?** N1 reports a circulation-heavy
   floor, floor 1 still has the same corridors and the same area, and it was not in the
   gating list. Either its computation depends on reachability in a way the rule's
   description does not say, or something else changed. It is one rule to read and it
   would either confirm the gating did only what it claims or find a second, unintended
   suppression.

## Suggested next prompt

Two things, and the first is not a prompt at all: make sure the Browser pane is open and
stays open before starting the run. Everything below assumes it.

Then the marker and the Structure view together, as prompt 0012 specified them, with
nothing else in the run. Both are fully designed, neither needs a decision, and together
they are the whole of the visual backlog before Tuesday. The marker's derivation rule,
label mechanism and export byte-identity check are all written out in prompt 0012 task 2
and can be pasted forward unchanged.

Keep task 5, the export test, queued behind them rather than dropping it. It is the only
thing that would make the f2af130 invariant self-enforcing, and finding 6 states what
leaving it costs.

Worth folding in: open question 2 is one rule to read and would take a few minutes inside
a run that is already loading both fixtures.
