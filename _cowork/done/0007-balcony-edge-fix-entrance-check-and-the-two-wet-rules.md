---
id: "0007"
title: Balcony edge fix, entrance check, and the two wet rules
created: 2026-07-30
---

## Context

Shrey verified the interface view with his own eyes on 30 July, so run 0006's
code changes can enter history, and his screenshots found one defect. The wall
between a room and its balcony dissolves in the interface view as if it were
an interior partition. It is facade: the balcony sits outside the enclosure
and the boundary carries the french-window glazing. The likely mechanism, to
be confirmed rather than assumed: `partitionEdges()` treats any occupied
neighbour cell as interior, and outdoor cells are occupied cells.

The same boundary question feeds a rule. Meeting item 13 asked to replace the
glazing-percentage emphasis with the rule that actually shapes the plan: every
habitable room has a facade. The regulation research pins it to PBG (LS 700.1)
§ 302, and it is the one rule the interface level must enforce. So this run
defines "facade edge" once and uses it twice, in the view's skip set and in
the new rule, so the picture and the check cannot drift apart.

Also in this run: the split-wet-areas rule Shrey asked for, a read-only check
whether a no-entrance rule already exists (he believes it does), and the
README rule tables, which report 0006 measured as stale by thirteen rules plus
a phantom `S4`.

Decisions taken since 0006, so none of this is open: wet types stay exactly
`bathroom_small`, `bathroom_large`, `kitchen`, no WC id for now; and there is
no law-versus-advice field yet, everything stays advisory, and a rule that
rests on law carries its citation inside its description text.

## Assumptions

These are read from the 0006 report and from Shrey's screenshots, and every
one may be wrong. Where a task depends on one, check it rather than trusting
it, and say in the report if it does not hold. Contradicting this section is
more useful than working around it.

1. The interface-view skip set is built by `partitionEdges()` in
   `src/core/floorManager.ts`, which adds an edge when the neighbouring cell
   is occupied, with no exception for outdoor cells. Read the real condition
   before changing it.
2. Outdoor and circulation placements sit in the same occupancy set as rooms.
3. In the normal view the room-to-outdoor boundary keeps the room's wall with
   its generated glazing, so un-skipping that edge in the interface view
   brings existing geometry back and builds nothing new.
4. A `Rule` is `{id, severity, description, check(graph, ctx)}`, severity
   `"hard" | "soft" | "note"`, 37 entries, all reading graph nodes. The two
   new rules need cell positions; whether `RuleContext` carries them is
   unknown. If it does not, make the smallest addition and report it.
5. Rule ids `E1` and `E2` exist and their subject is unknown. Shrey believes a
   no-entrance rule is already among the 37.
6. `WET_TYPES` and `isWet` sit at `src/core/modules.ts:97-105` from run 0006.
7. Habitable, for the facade rule, means `living`, `bedroom_small`,
   `bedroom_large`, `recreation`. Kitchen is excluded on purpose (it is wet,
   and an interior kitchen is common practice). Bathrooms, circulation,
   outdoor and stairs are excluded. This scope is a choice; state it in the
   report so it can be revisited.
8. There is no test suite. Verification means `tsc` clean, `npm run build`
   clean, and driving the app in a real browser.
9. Doors span two cells. Not needed this run; 0008 builds on it.

## Task

0. **Probe the browser pane first.** Load the app and take one screenshot
   before anything else, so a hidden pane is known at the start. If it is
   hidden, say so, keep going, and plan for manual steps at the end.

1. **Commit run 0006's changes, deliberately.** Shrey has verified the view.
   Run `git status --porcelain` first, then commit exactly the seven files
   from run 0006 (`src/core/modules.ts`, `src/core/floorManager.ts`,
   `src/core/floor.ts`, `src/scene/doorView.ts`, `src/main.ts`, `index.html`,
   `PROJECT_STATE.md`) with the message
   `Interface view (run 0006, verified by Shrey)`. If status lists anything
   else, leave it out and report it.

2. **Define "facade edge" once, and fix the balcony boundary with it.**
   Extract the edge test into one named helper: an edge is a facade edge when
   the neighbouring cell is unoccupied, or occupied by an outdoor-cluster
   cell. Use it in `partitionEdges()` so the interface view keeps every facade
   edge's wall and glazing, including toward balconies and terraces. Edges
   toward circulation cells stay interior and keep dissolving. Follow the
   one-sided dissolve convention: the room's wall comes back, the outdoor
   cluster does not gain a second one. Verify on a flat like Shrey's
   screenshot, a room with a balcony beside it: interface view on, the wall
   and glazing stand between room and balcony, the parapet is unchanged, and
   everything else dissolves as before.

3. **Check whether a no-entrance rule already exists.** Read the 37 ids and
   descriptions in `src/core/rules.ts` and report what fires when a flat has
   no entrance (`E1` and `E2` are the suspects). If such a rule exists, change
   nothing and quote it. If none exists, add one soft rule: no entrance is
   defined; the entrance is the unit's interface to the building.

4. **Add the split-wet-areas rule, soft.** Collect the wet cells of a floor
   via `WET_TYPES`, flood-fill with four-neighbour connectivity, corner
   contact does not connect. More than one group fires one violation naming
   the group count and where each group sits. The description carries the
   reason: split wet areas mean long installation runs and shafts that cannot
   bundle to the next storey. Note in the report that this rule reads cells
   rather than graph nodes, which departs from the existing 37 and is a
   deliberate choice.

5. **Add the room-has-facade rule.** Every habitable room (assumption 7) has
   at least one facade edge, tested with the task-2 helper so the rule and the
   view cannot disagree. Severity `hard`, because it is the rule the meeting
   named as the one that must hold. The description ends with the citation:
   `(PBG LS 700.1 § 302: every habitable room needs a facade window)`. Facade
   presence only; do not implement the glazing-ratio half.

6. **Rewrite the README rule tables from `rules.ts`.** Every rule now in the
   code appears, the phantom `S4` goes, the new rules are included. Keep the
   existing table format.

7. **Update `PROJECT_STATE.md`** for the fix and the new rules.

8. **Verify.** `tsc` clean, `npm run build` clean. In the browser: the balcony
   wall standing in the interface view; the split-wet rule firing on a flat
   with separated kitchen and bathroom and clearing when they touch; the
   facade rule firing on a room sealed in by other rooms and clearing when it
   reaches the boundary. Quote each rule's message text exactly. If the pane
   is hidden, stop at the builds, give the manual steps, and list which claims
   are therefore unproven.

If the run has to stop early: tasks 1 and 2 matter most, then 3 because it is
minutes, then 4, 5 and 6.

## Constraints

- Code changes stay uncommitted apart from task 1's deliberate commit. This
  run's own record commit stages `_cowork/` as the skill says. Never push.
- No change to the `dwelling-unit` export or `docs/bridge-format.md`.
- Touch nothing under `docs/`. The root `README.md` is this run's one
  documentation target.
- Rules never block placement, save or export. No new severity values, no new
  fields on `Rule`. `RuleContext` may grow the smallest cell access if it has
  none, reported.
- No interior-solver work.

## What I need back

Quote raw command output rather than summarising it, and state the
verification rung for each claim separately.

1. Task 0's pane state, first.
2. The task-1 commit hash and its exact file list from `git show --stat`.
3. The facade-edge helper: name, file, line range, and both call sites.
4. What exists for the entrance among the 37 rules, quoted, and what if
   anything was added.
5. Both new rules quoted in full with file and line ranges, and each rule's
   message text as fired.
6. What was added to `RuleContext`, if anything.
7. The README change by counts: rules documented before, after, phantoms
   removed.
8. Screenshots for the three browser checks, or the manual steps plus the
   list of claims left unproven.
9. `tsc` and `npm run build` output.
10. Anything you found that contradicts the Assumptions section.
11. Your own assumptions. Anything you had to assume during the run that the
    Assumptions section above does not cover, listed clearly in one place,
    each with what it affected. An empty list is a valid answer if nothing
    was assumed.

The report follows `WRITING.md`: connected sentences that carry their own
logic, no em dashes as glue, no contrast flourishes, neutral voice, plain
words, prose before any list or table, and every number exact.
