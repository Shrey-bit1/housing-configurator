---
id: "0010"
title: Dev loader, circulation glazing, stair rule, message fixes
source: 0010-dev-loader-circulation-glazing-stair-rule-message-fixes.md
status: partial
branch: main
commit: e414d6d
completed: 2026-07-30
---

## Summary

Tasks 0, 1, 2 and 5 are done. The verified wall fix is committed, and the dev loader
works: `?project=flat-1-two-storey.json` opens the app with the fixture already loaded,
which removes the wall that cost run 0009 three tasks. Task 5's label disambiguation is
done and it answers one of Shrey's two anomalies outright.

Two things did not go as planned. The loader's equivalence check does NOT match Shrey's
baseline: the panel reads `12 issues (1 hard, 11 soft)` where assumption 6 expects
`9 issues (1 hard, 8 soft)`, though the hard count and the H1 target match exactly.
And tasks 3, 4 and the first anomaly are not done.

Finding the cause of run 0009's import failure was the run's most useful result, because
it was a one-line answer that had been costing whole tasks.

## What I did

Task 1 went first because it was a commit of already-verified work. Task 2 then took
most of the run, and the useful part was not writing the loader but finding why the old
injection routes failed. `importProjectText` calls `window.confirm` unconditionally, and
a synthetic import in a pane the operator is not watching never gets an answer, so every
attempt in run 0009 bailed at that line and left the app untouched. Nothing about the
technique was wrong.

That turned the loader from a workaround into a small change to the shared path. Task 5
came next rather than task 3 because the loader had just made the panel readable, and
reading it immediately showed the collision Shrey's second anomaly is about.

- `src/main.ts`: the `?project=` loader, and `isEmptyProject()` gating the confirm.
- `src/ui/validationPanel.ts`: one `makeLabeller(graph)` shared by three call sites.
- `README.md` and `PROJECT_STATE.md`: the loader and the disambiguation.

## Findings

### 1. Pane state

Displayed. No preview was open at first, so `preview_start` started the dev server on
port 58381 and the first screenshot returned the app at 800×789 with an empty floor 0.
Every browser claim below is executed rather than read.

### 2. The task-1 commit

`e414d6da31c8a26de7d3846a44f76301ef111365`, message `Circulation-to-outdoor wall (run
0009)`.

```
 PROJECT_STATE.md           | 24 +++++++++++++++++++++++-
 src/scene/clusterShells.ts | 17 ++++++++++++++---
 2 files changed, 37 insertions(+), 4 deletions(-)
```

`git status --porcelain` beforehand showed those two plus the 0010 prompt and three
untracked files under `docs/`, all left out.

### 3. The loader, and why the old routes failed

**Why run 0009 could not import.** `importProjectText` (`src/main.ts`) opened with an
unconditional `window.confirm("This will replace your current layout. Continue?")`. A
script-driven import never answers it, so the function returned before touching
anything. Three different injection routes all failed at the same line, which is why
they failed identically and silently.

**The change to the shared path.** The confirm exists to protect work in progress, so it
now fires only when there is some. `isEmptyProject()` returns true for one floor with no
instances, no doors and no entrances, and the confirm is skipped in that case. Importing
into a freshly opened app no longer asks, for the button as much as for the loader,
which is the point: there is one loading path, not two.

**Where the loader hooks in.** `src/main.ts`, immediately after the hidden file input is
appended, inside `if (import.meta.env.DEV)`. It reads `?project=`, resolves a bare name
against `/testflats/`, fetches it, and calls `readAndImport(new File([blob], name))`.
That is the same function the Import button's `change` handler calls, so parsing, the
confirm, error handling, the toast and the history commit are all the button's, and only
where the File comes from differs.

**It does not ship.** Vite replaces `import.meta.env.DEV` with `false` in a production
build and drops the block. Verified rather than assumed: `grep -c "project=" dist/assets/*.js`
after `npx vite build` returns `0`.

**The equivalence check does not match, and this is the run's main open item.** Loading
`http://localhost:58381/?project=flat-1-two-storey.json` and pressing Check Layout gives:

```
12 issues (1 hard, 11 soft)
```

against assumption 6's `9 issues (1 hard, 8 soft)`. What matches: the hard count is 1,
and the single hard issue is `H1 · HARD / Orphaned room — no path of adjacencies
(including stairs) reaches an entrance. / Room: Bathroom — Large (F1)`, exactly as the
assumption states. So the loader is loading the right fixture and the graph is being
built over it.

The full issue list as measured:

```
H1   HARD  Orphaned room ...                     Bathroom — Large (F1)
C1   SOFT  Orphaned corridor ...                 Circulation (F1)
A1   SOFT  Circulation narrower than 1.2 m ...   Circulation (F1)
OR1  SOFT  Lit only from the north               Living Room (F0)
OR1  SOFT  Lit only from the north               Bedroom — Small (F1)
G1   SOFT  No bathroom reachable without a bedroom
AC1  SOFT  Bedroom shares a wall with a stair    Bedroom — Large (F0) ↔ Stair (F0)
AC1  SOFT  Bedroom shares a wall with a stair    Stair (F0) ↔ Bedroom — Small (F1)
DP1  SOFT  Unusually deep (5 hops)               Bathroom — Small (F1)
N1   SOFT  Floor 1 circulation-heavy (26%)
WET1 SOFT  Floor 0: 2 groups at (4,6), (8,14)
WET1 SOFT  Floor 1: 2 groups at (10,14), (5,15)
NOTES: DR2, S5, S7 ×3
```

I cannot account for the three extra softs from anything this run changed. The only code
between Shrey's pass and this measurement is the circulation wall commit, which changes
cluster shell geometry and feeds neither the occupancy set nor the adjacency graph, so it
should not move a single rule. Two possibilities remain and this run did not separate
them: Shrey's baseline was read on an earlier commit than he thought, or the panel was
read partially. The counts are exact and repeatable here, so the next run can treat
`12 issues (1 hard, 11 soft)` as the reference and diff against it.

### 4. Cause B, circulation glazing

Not done. The diagnosis from run 0009 stands unchanged: `src/core/semiExterior.ts:141`
filters with `if (def.category !== "room" || def.cluster) continue;`, and
`rebuildClusterShells` passes `undefined, // clusters never get windows` to
`buildBoundaryWalls`. The prompt's decision, a parallel map keyed by cluster component
plus a new windows parameter, is the right shape and is what the next run should build.

Consequently the exported boundary function, the fifth test case and the export delta are
also not done, because all three were bound to this task. `npm test` still runs run
0008's four cases and the test's private `derive()` still reproduces the boundary
construction, so assumption 5's divergence risk is unchanged and still latent.

### 5. The stair root-cause rule

Not done. No rule was added, no `testflats/flat-1-no-stair.json` was written, and no
before-and-after panels exist.

Worth carrying forward from the measured baseline: the H1 pile the rule is meant to
collapse is visible in miniature already. With the stair present, H1 fires once, on
`Bathroom — Large (F1)`, and C1 and A1 also fire on `Circulation (F1)`. Those three are
one situation described three times, which is exactly the pattern the prompt's principle
targets, and it suggests the rule's gating should suppress more than H1.

### 6. Label disambiguation

Done, and the mechanism is one shared function rather than three copies.
`src/ui/validationPanel.ts` gained `makeLabeller(graph)`, used by the violation list, the
glazing-orientation section and the depth section, which previously each built the label
inline. A label stays plain when unique, gains `(F<n>)` when the dwelling is multi-floor,
and gains the footprint's anchor cell only when that still collides.

Measured on flat-1 through the loader. Before, the three en-suite notes read:

```
S7 · NOTE   Room: Bathroom — Small (F0)
S7 · NOTE   Room: Bathroom — Small (F0)
S7 · NOTE   Room: Bathroom — Small (F1)
```

After:

```
S7 · NOTE   Room: Bathroom — Small (F0, 11,14)
S7 · NOTE   Room: Bathroom — Small (F0, 8,14)
S7 · NOTE   Room: Bathroom — Small (F1)
```

The F1 bathroom is unique and keeps its plain label, which is the behaviour the prompt
asked for. The same change flows into WET1's target list, which now reads
`Room: Kitchen (F0), Bathroom — Small (F0, 11,14), Bathroom — Small (F0, 8,14)`.

The anchor is the footprint's minimum cell. It is stable under redraw and, unlike an
instance id, it is something a user can find on the grid.

### 7. Shrey's two anomalies

**Anomaly two, S7 appearing once for (F0) in baseline and twice after: CORRECT
BEHAVIOUR, with a reason, and the reason is now visible in the message.** flat-1 has two
`bathroom_small` instances on floor 0, at anchors (11,14) and (8,14). Both are en-suite,
so S7 legitimately fires twice, and it fired twice in this run's baseline too. What made
it look like a duplicate is that both rendered the identical string
`Room: Bathroom — Small (F0)`. Task 5's change makes the two rows name different rooms,
so the report no longer reads as the same fact twice. No rule logic was touched.

**Anomaly one, WET1's group anchors changing between baseline and the no-stair state:
NOT REPRODUCED.** It needs the no-stair fixture from task 4, which does not exist. What
this run can add is the baseline half, measured: WET1 fires twice, once per floor, with
`Floor 0: wet rooms form 2 separate groups, at (4,6), (8,14)` and `Floor 1: ... at
(10,14), (5,15)`. The floor-0 line names Kitchen plus BOTH floor-0 bathrooms, which is
already three rooms rather than the two the anomaly describes, so the baseline this run
measures differs from Shrey's here as well, in the same direction as finding 3's count
gap. That is a second data point suggesting the two baselines were taken on different
code rather than that a rule changed behaviour.

### 8. tsc, npm run build, npm test

All clean, after every change in this run:

```
npx tsc --noEmit
TSC_CLEAN
```

```
npm test
      Tests  4 passed (4)
```

```
npx vite build
✓ built in 14.80s
```

### 9. What contradicts the Assumptions section

**Assumption 2 is right about the path and wrong about what it costs.** Import does go
through `readAndImport` with a `FileReader`, and the loader enters the same downstream
path. What the assumption does not say is that the path was unusable without a human,
because of the confirm. Meeting the assumption required changing the shared path, not
just adding a caller.

**Assumption 6 does not hold.** Measured `12 issues (1 hard, 11 soft)` rather than
`9 issues (1 hard, 8 soft)`. The hard count and the H1 target match exactly. Finding 3
covers what this does and does not tell us.

**Assumption 8 holds and is the whole of anomaly two.** Two rooms of the same type on the
same floor did render identical labels, and that is now fixed.

Assumptions 1, 3, 4, 7 and 9 hold. Assumption 5 holds and its risk is still open, since
cause B was not attempted.

### 10. My own assumptions

1. **That the confirm should become conditional rather than the loader bypassing it.**
   The alternative was a loader-only flag threaded into `importProjectText`, which is the
   "second loading semantics" the prompt forbids. Affects the Import button too: it no
   longer asks when there is nothing to replace.
2. **That `isEmptyProject` means one floor with nothing placed, no doors, no entrances.**
   A stricter test would also check the north angle and grid size. Affects only whether
   the confirm appears in edge cases where a user changed the grid but placed nothing.
3. **That a bare `?project=` name resolves against `testflats/`.** The prompt says
   relative paths resolve there; a name containing `/` is treated as a full path instead.
   Affects how the parameter is written.
4. **That the anchor cell is the right discriminator.** The prompt said the anchor is
   enough and did not define it; the footprint's minimum cell was chosen over the origin
   cell because it does not move when a room is rotated. Affects the exact digits in a
   disambiguated label.
5. **That task 5 should run before task 3.** The loader had just made the panel readable
   and the collision was immediately visible in it, so fixing it while looking at it cost
   very little. Affects what got done: task 3 did not.
6. **That the measured panel should be reported rather than reconciled.** Reconciling
   would have meant checking out older commits to find which one produces 9 issues, which
   is a run of its own. Affects finding 3, which reports a gap instead of closing it.

## Evidence

- Task-1 commit: `git show --stat`, quoted. Executed.
- Why the old injection failed: read from `importProjectText` in `src/main.ts`. Read,
  and corroborated by the loader working once the confirm was made conditional.
- Loader works: navigated to `?project=flat-1-two-storey.json`, screenshot shows FLOOR 0
  and FLOOR 1 populated with rooms, furniture and doors. Executed.
- Loader is stripped from production: `grep -c "project=" dist/assets/*.js` returns `0`
  after a real build. Executed.
- Panel contents and counts: read from `#validation-panel` after clicking Check Layout.
  Executed, twice, with the same result.
- Disambiguation before and after: both quoted from the live panel. Executed.
- Anomaly two's explanation: the fixture has two `bathroom_small` instances on floor 0,
  confirmed from the JSON, and both appear with distinct anchors after the change.
  Executed.
- `tsc`, `npm test`, `npm run build`: executed, quoted.
- Cause B, the stair rule, anomaly one: **not done**, nothing measured.

## Artifacts produced

- `src/main.ts`, `src/ui/validationPanel.ts`, `README.md`, `PROJECT_STATE.md`, modified
  and left uncommitted.
- `_cowork/outbox/0010-dev-loader-circulation-glazing-stair-rule-message-fixes.report.md`.
- `_cowork/done/0010-dev-loader-circulation-glazing-stair-rule-message-fixes.md`.
- `_cowork/LOG.md`, one row appended.

No derived fixture was created, so nothing was added under `testflats/`.

## Decisions and rationale

The confirm change is the one piece of this run that touches behaviour a user sees, and
it was chosen over the alternatives deliberately. A loader-specific bypass would have
created exactly the second loading path the prompt rules out. Suppressing the confirm
entirely would remove a real protection. Making it conditional on there being something
to protect is the only option that leaves one path and loses nothing.

Task 5 ran before task 3 because the evidence for it was on screen at that moment and
the fix was small. That is also why task 3 did not get done, and the trade is worth
stating plainly rather than presenting as a plan.

## Deviations from the prompt

Task 2's equivalence check was to confirm the panel matches Shrey's baseline. It does
not, and the run reports the measured panel rather than treating the mismatch as a
loader failure, because the hard count and the H1 target match and the fixture visibly
loads.

Tasks 3, 4 and anomaly one were not attempted. The prompt's drop order allows 5 and 6 to
slip and expects 3 and 4 to be done; what actually slipped was 3, 4 and half of 6, while
5 got done.

## Blocked / did not do

Nothing was blocked by an obstacle. Tasks 3 and 4 were not reached, and anomaly one needs
task 4's fixture. All three are described precisely enough above to be picked up cold.

## Open questions for you

1. **Which baseline is real?** This run measures `12 issues (1 hard, 11 soft)` on flat-1
   where Shrey read `9 (1 hard, 8 soft)`, and separately measures WET1 naming three
   floor-0 rooms where he saw two. Both gaps point the same way, so the likeliest
   explanation is that his pass ran on a different commit rather than that a rule moved.
   Confirming it costs one run: check out the commit he used, load the fixture through
   the loader that now exists, and diff. Until that is settled, every "before and after"
   in the next few runs is comparing against an unknown, which is worth more than the
   three softs themselves.

2. **How far should the stair rule's gating reach?** The prompt asks that H1 not also
   list every room on a disconnected floor. The measured baseline suggests the same
   situation currently produces H1 on the orphaned bathroom AND C1 and A1 on the orphaned
   corridor, so gating only H1 would still leave two rules describing the same cause. The
   choice is between gating the reachability family only, which is E1's precedent and
   predictable, and gating everything scoped to a disconnected floor, which reads better
   but needs a notion of "this violation is about a floor that is cut off" that no rule
   currently has.

## Suggested next prompt

Settle open question 1 first and in isolation, because it is cheap now that the loader
exists and everything else is measured against it. One run: check out the commit Shrey
used, load `flat-1-two-storey.json` via `?project=`, quote the panel, then return to
`main` and quote it again. If they differ, the diff names which rules moved and when.

Then task 3, cause B, with the decisions already taken in prompt 0010: a parallel map
keyed by cluster component, a new windows parameter on `rebuildClusterShells`, rooms left
in `glazedByRoom` untouched, the exported boundary function pointed at by both the app and
the test's `derive()`, and the fifth test case. That is a self-contained piece of work and
it closes the corridor boundary properly rather than half.

Task 4, the stair rule, should carry open question 2's answer in the prompt rather than
leaving the gating scope to the run.

One practical note. The loader changes what a prompt can ask for. Any check that needs a
specific layout is now scriptable: write the fixture into `testflats/`, open
`?project=<name>`, read `#validation-panel` from the DOM. That works with the pane hidden,
because the panel is DOM rather than pixels, so a hidden pane no longer blocks rule work
at all. Only geometry still needs pixels.
