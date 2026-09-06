---
id: "0034"
title: One way forward, and the landing arrives in order
source: 0034-one-way-forward.md
status: complete
branch: run/0034
commit: 43ff0be
completed: 2026-09-06
---

## Summary

The flat app now hands a resident onward instead of asking them to notice a
number in the bar. Step 01 ends with one button that says where it goes, step
02's one red button turns into the way to the group once a flat has been sent,
the six journey dots say which of the two apps owns each step, and the landing
arrives in a fixed order written entirely in CSS. All seven tasks landed on
`run/0034`, which branched from `main` at `62564ee` and now ends at `43ff0be`.
Nothing on `main` was touched.

## What I did

Seven commits, in the order the prompt asked for them.

`ea70a91` **design: the brief as of 6 September**, one file, 47 insertions and
29 deletions. `_cowork/design/DESIGN-BRIEF-3sep.md` was replaced byte for byte
with the copy in `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\`, growing from
13759 to 14356 bytes. `cmp` reports the two files identical.

`8389a1d` **ui: one way forward**, three files, 77 insertions and 2 deletions.
`index.html:192-197` adds `#forward`, holding `#forward-why` and
`#forward-go`. `src/style.css:2697-2721` positions it and
`src/style.css:496-512` makes `aria-disabled="true"` look the same as
`disabled` on `.btn-send`. `src/main.ts:1295-1296` takes the two element
references, `src/main.ts:1324-1325` sets them inside `syncStepTabs`, and
`src/main.ts:1341` wires the click to `setStep("send")`.

`0e72f79` **ui: and then to the group**, three files, 50 insertions and 7
deletions. `src/core/flatState.ts:66-79` adds `SEND_IT`, `GO_TO_GROUP` and
`sendButtonLabel(hasSent)`. `src/main.ts:1005` declares `hasSent`,
`src/main.ts:1364-1370` adds `groupUrl()`, `src/main.ts:1412` points the
landing's own link at it, `src/main.ts:1674-1675` sets the label and the
enabled state, `src/main.ts:1891` sets the flag on a successful publish,
`src/main.ts:1209` clears it on any edit, and `src/main.ts:1998-2004` gives the
click its two branches. `index.html:276` names the label span
`#save-go-label`.

`399dc3e` **ui: the journey knows where it is**, four files, 72 insertions and
26 deletions. `src/core/journey.ts:48-81` replaces `JourneyMark` and
`journeyMarks` with `JourneyTone` and `journeyTones(currentId, thisApp)`.
`src/main.ts:1427` calls it with `"flat"` and `src/main.ts:1436` writes the
tone as the class. `src/style.css:3082-3099` gives `now` the accent red and
`here` the ink, and leaves `elsewhere` to the dim that
`.journey-dot`/`.journey-label` already carry. `src/core/journey.test.ts:47-84`
replaces the four `journeyMarks` cases with four `journeyTones` cases.

`733fbb7` **ui: the landing arrives**, three files, 94 insertions and 7
deletions. `index.html:363` splits the headline into three spans.
`src/style.css:2959-3033` is the whole arrival: two keyframes, eleven delays, a
`prefers-reduced-motion` block and the `.no-arrive` escape.
`src/style.css:2842-2844` replaces the old `blurin` animation the headline
carried with `display: block` on the three spans. `src/main.ts:1372-1381` adds
`showLandingDoors`, called from `src/main.ts:1485` and `src/main.ts:1511`.

`5177784` **ui: tests for 0034**, two files, 115 insertions.
`src/core/flatState.test.ts:102-143` adds seven cases.
`src/chromeWiring.test.ts` is new, 69 lines, four cases.

`43ff0be` **docs: PROJECT_STATE for run 0034**, one file, 75 insertions and 5
deletions.

## Findings

**The readiness rule is `canSend(phase)` in `src/core/flatState.ts:41-43`,**
which returns true only for the phase `ready`. The phase itself comes from
`flatPhase(placedRooms, unitBuilds)` at `src/core/flatState.ts:34-37`, where
`unitBuilds` is whether `buildUnitExport` succeeded. So "ready" means the store
would accept the flat, which in practice means it has a way in and holds
together.

The bar and the button read the same call because there is only one call. In
`syncStepTabs` (`src/main.ts:1318-1344`) the first line of the body is
`const open = canSend(phase);` at `src/main.ts:1319`, and `open` is then used
four times and `canSend` never again:

- `src/main.ts:1324` — `forwardGoBtn.setAttribute("aria-disabled", String(!open));`
- `src/main.ts:1325` — `forwardWhyEl.textContent = open ? "" : NO_WAY_IN;`
- `src/main.ts:1333` — `stepSendBtn.setAttribute("aria-disabled", String(!open));`
- `src/main.ts:1334` — `stepSendBtn.title = open ? "" : NO_WAY_IN;`

`syncStepTabs` is called from `refreshFlatFigures` at `src/main.ts:1277`, and
`refreshFlatFigures` is called from `commitHistory` at `src/main.ts:167`, which
every mutating action goes through, so an entrance placed in step 01 wakes both
controls on the same frame.

**There are exactly two `.btn-send` buttons in the editor** and each is hidden
in the other's step, so one is on screen at a time. `src/style.css:2679` hides
`#save-column` in step `draw` and `src/style.css:2687` hides `#forward` in step
`send`. Measured live, the visible `.btn-send` set is `["forward-go"]` in step
01 and `["save-go"]` in step 02.

**The bottom centre of the viewport was the one free edge.** `#bottom-left`
holds undo and redo at `left: 16px; bottom: 16px`, `#view-controls` holds
Display at `right: 16px; bottom: 16px`, and the palette is `#sidebar`, outside
`#viewport` entirely. Measured at 1440×900, `#viewport` occupies x 296 to 1440
and y 52 to 900; `#forward-go` sits at x 722 to 1014 and y 838 to 884, so it is
centred on the viewport to the pixel and clears its bottom edge by 16 px.

**Run 0027's `journeyMarks` could not answer the question the strip is for.**
Done and ahead describe how far along a resident is, and the flat app cannot
know that: the two apps share only `docs/store.md`'s contract, and nothing in
it says whether a resident has voted. Which app owns a step is knowable from
`JOURNEY` alone, so `journeyTones` was written to replace `journeyMarks`
outright rather than to sit beside it. The building app calls the same function
with `"building"` and gets the mirror image.

**A `<br>` cannot carry an animation delay,** so the headline had to become
three elements. `index.html:363` is now
`<h1 class="landing-title"><span>Draw the flat</span><span>you want</span><span>to live in.</span></h1>`
with `.landing-title span { display: block; }` at `src/style.css:2842-2844`, which
breaks the three lines exactly where the three `<br>`s did.

**Re-showing an element restarts its CSS animation.** Coming back from the join
form or the new-group form sets `landingDoors.hidden = false`, and that
`display` change would replay the 2500 to 2900 ms stagger, leaving a resident
looking at an empty column for two and a half seconds. `showLandingDoors` at
`src/main.ts:1372-1381` adds `.no-arrive` on that path only, and
`src/style.css:3021-3023` turns the stagger off for it. The first show, from
`showLanding` at `src/main.ts:1396`, does not carry the class.

## Evidence

Everything below was executed. Nothing here is estimated.

**The readiness rule and the two controls, live.** Verified against
`netlify dev` on port 8888 with the tab emulating 1440×900, reading the DOM
directly rather than from a screenshot.

| state | `#forward-go` aria-disabled | its background | `#forward-why` | `#step-send` aria-disabled |
|---|---|---|---|---|
| step 01, nothing drawn | `"true"` | `rgb(163, 156, 141)` | the sentence, visible | `"true"` |
| step 01, a flat with a way in | `"false"` | `rgb(214, 52, 28)` | empty, not rendered | `"false"` |

`rgb(163, 156, 141)` is `--dim`, `#a39c8d`. `rgb(214, 52, 28)` is `--accent`,
`#d6341c`. The sentence reads, in full: "Place an entrance on an outside edge
first, so the flat has a way in." It is `NO_WAY_IN` at
`src/core/flatState.ts:82-83`, the same constant the bar's step 02 carries as
its `title`. It disappears rather than emptying because `#forward-why:empty`
sets `display: none` at `src/style.css:2720-2722`.

The ready state was produced by loading the `sourceProject` out of
`public/units/unit-6.json` through the app's own `?project=` route. That file
was written to `public/testflats/tmp0034.json`, used, and deleted; the
directory it needed was deleted with it, and `git status` shows nothing left
behind.

**Step 01, element by element, in the asleep state.** The button is a
292 px wide red block, `.btn-send`, 46 px tall, at the bottom centre of the
viewport. Its label reads "Send it to your group" followed by an arrow that
nudges; asleep, `.btn-send[aria-disabled="true"] span:last-child` stops the
nudge and the fill goes to `--dim`. Above it, in an 11 px line on a bordered
paper background, sits the one sentence quoted above. Nothing else on the
screen sends: the visible `.btn-send` set read `["forward-go"]`.

**Step 01 awake.** The same button in `--accent` red with the arrow nudging,
and `#forward-why` gone from the layout entirely. Visible `.btn-send` set
unchanged at `["forward-go"]`.

**Step 02 before a send.** Pressing the forward button set
`document.body.dataset.step` to `"send"`, `#forward` became invisible, and the
visible `.btn-send` set read `["save-go"]` with `#save-go-label` reading
"Send it". The headline above it reads "Send it to your group." across two
lines.

**Step 02 after a send.** A real publish into the group `run-0034` as
"verify", with only the "Send to group" box ticked and the three file boxes
unticked, answered in `#save-results`:
"Sent to run-0034 as Unit 29 · open Units to see your group." `#save-go-label`
then read "Go to your group", the button stayed enabled, and clicking it called
`window.open` with `["http://localhost:5182/?session=run-0034", "_blank",
"noopener"]`, captured by replacing `window.open` for the length of the click.
That URL is `groupUrl()` at `src/main.ts:1364-1370`, which is also what the
landing's "Go to your group" anchor now reads.

**The flag clears on an edit.** Returning to step 01, selecting a room and
pressing Delete, then returning to step 02, put `#save-go-label` back to
"Send it". That is `hasSent = false` at `src/main.ts:1209`, the first line of
`refreshFlatFigures`.

**The landing's arrival, as computed by the browser.** Read from
`getComputedStyle` on each element after the page settled. Every one matches
what `src/style.css:2993-3017` declares.

| element | selector | delay | duration |
|---|---|---|---|
| yellow disc | `.landing-disc-a` | 1000 ms | 600 ms |
| blue disc | `.landing-disc-b` | 1000 ms | 600 ms |
| headline line 1 | `.landing-title span:nth-child(1)` | 1600 ms | 300 ms |
| headline line 2 | `.landing-title span:nth-child(2)` | 1750 ms | 300 ms |
| headline line 3 | `.landing-title span:nth-child(3)` | 1900 ms | 300 ms |
| paragraph | `.landing-lead` | 2200 ms | 300 ms |
| door 1, Start a flat | `.landing-doors > *:nth-child(1)` | 2500 ms | 300 ms |
| door 2, Start a group | `.landing-doors > *:nth-child(2)` | 2600 ms | 300 ms |
| door 3, Join a group | `.landing-doors > *:nth-child(3)` | 2700 ms | 300 ms |
| door 4, Open a file | `.landing-doors > *:nth-child(4)` | 2800 ms | 300 ms |
| the aside line | `.landing-doors > *:nth-child(5)` | 2900 ms | 300 ms |
| journey strip | `.landing-journey` | 3200 ms | 300 ms |

The whole arrival ends at 3500 ms. The red rule at the top and the brand line
are not animated, because the brief's sequence does not name them.

Three frames were captured on reload. At about 0.3 s: paper, the red rule and
the brand line, nothing else. At about 1.2 s: both discs part-grown out of
their own corners, the yellow from top left and the blue from bottom right, no
headline. At about 2.3 s: the headline fully in, the paragraph part-way, no
doors. The order the brief asks for is what appears.

**Honest if it never runs.** Both keyframes are `from`-only:
`@keyframes landing-disc { from { transform: scale(0); } }` and
`@keyframes landing-arrive { from { opacity: 0; transform: translateY(12px); } }`
at `src/style.css:2987-2992`. With no `to`, the finished state is the element's
own resting state, so an engine that ignores the animation renders the landing
whole. Read back live, every one of the twelve elements above rests at
`opacity: 1`. A `prefers-reduced-motion: reduce` block at
`src/style.css:3024-3033` sets `animation: none` on all of them.

**The rest of the app does not wait.** Nothing in the arrival sets
`pointer-events`, and the only transform is a 12 px vertical offset, which
moves the hit area with the pixels rather than away from them. Checked with
`document.elementFromPoint` at the centre of "Start a flat" during the
sequence: the element returned was `landing-start` itself.

**The six dots, and their three colours.** All six render, always.
`journeyTones("draw", "flat")` gives
`["now", "here", "elsewhere", "elsewhere", "elsewhere", "elsewhere"]`. On
screen: "Draw your flat" is a filled `--accent` red dot with a red label;
"Send it" is a filled `--ink` dot with an ink label; "Your wishes", "The
group", "Your flat in it" and "Vote" are hollow `--dim` dots with dim labels.
The building app calls `journeyTones(<its step>, "building")` and gets the
mirror, which `src/core/journey.test.ts:59-69` pins with
`journeyTones("group", "building")` equal to
`["elsewhere", "elsewhere", "here", "now", "here", "here"]`.

**Test counts.** The fast suite goes from **298 in eighteen files to 309 in
nineteen**. The before figure was measured, not recalled: `main` at `62564ee`
was checked out into a throwaway `git worktree` under the scratchpad with
`node_modules` junctioned in, `vitest run` gave `18 passed (18)` and
`298 passed (298)`, and the worktree was removed and pruned. The after figure
is `19 passed (19)` and `309 passed (309)` in the repository itself. The eleven
new cases are seven in `src/core/flatState.test.ts` and four in
`src/chromeWiring.test.ts`; `src/core/journey.test.ts` stays at nine, since the
four `journeyTones` cases replaced four `journeyMarks` cases one for one.

The slow suite is unchanged at **57 passed, 1 expected fail** across four
files.

**Both fixture baselines are unchanged at 12 and 7.** `flat-1-two-storey.json`
reads 1 hard plus 11 soft and `flat-1-no-stair.json` 1 hard plus 6 soft; both
are asserted inside the slow suite, which passed with the same counts as
before.

**The three downloads are byte-identical and the store contract did not
change.** `git diff --stat main HEAD` over `testflats/`, `public/testflats/`,
`src/core/rules.ts`, `src/core/saveFiles.ts`, `src/core/savePlan.ts`,
`src/core/modules.ts`, `docs/bridge-format.md` and `src/session/store.ts`
returns nothing at all. The full diff against `main` touches seven files:
`_cowork/design/DESIGN-BRIEF-3sep.md`, `index.html`, `src/core/flatState.ts`,
`src/core/journey.ts`, `src/core/journey.test.ts`, `src/main.ts` and
`src/style.css`, plus the two test files and `PROJECT_STATE.md` added in the
last two commits.

**`npx tsc --noEmit` exits 0.** `npm run build` succeeds in 8.80 s, 84 modules,
`dist/index.html` 25.37 kB, CSS 39.94 kB, JS 3430.71 kB. The chunk-size warning
is the same one every build in this repo has printed.

## Artifacts produced

- `_cowork/outbox/0034-one-way-forward.report.md` — this file.
- `src/chromeWiring.test.ts` — 69 lines, four cases, new.
- `_cowork/design/DESIGN-BRIEF-3sep.md` — replaced, 14356 bytes.
- `PROJECT_STATE.md` — §14 extended, two reference rows corrected.
- `_cowork/CONTEXT.md` — one paragraph for run 0034, **Last updated** now
  2026-09-06.

No captures were written to disk. The Browser pane in this environment returns
screenshots into the session rather than to a file, so the states the prompt
asked to see are described above element by element with every sentence quoted
in full.

## Skills read from disk

One was read, from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\f1d881be-0a13-45d3-acab-472cf2886dae\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\skills\`.
The prompt named `design-automation`, and that is the file that was opened:
`design-automation/SKILL.md`, 45081 bytes.

It contributed one thing that decided the shape of the work. Its section 2.1,
production rules, is the same argument `src/core/flatState.ts` was written on
in run 0027 and states it as a design constraint rather than as a preference:
a rule stated once and read by every consumer cannot be inconsistent between
consumers, and a rule restated at each consumer will eventually be. That is why
the forward button reads `open` out of `syncStepTabs` instead of calling
`canSend(phase)` for itself, which would have been the shorter diff and would
have compiled and behaved identically today. It is also why
`src/chromeWiring.test.ts` asserts on the call COUNT and not only on the
resulting attributes: the invariant worth protecting is the single call site,
not the two values it happens to produce.

Its section 1.4, hard rules against soft rules, is a second small contribution.
A hard rule makes a design invalid; a soft rule scores it. Readiness here is a
hard rule, so the control it governs is shut rather than merely discouraged,
and the one sentence it shows says what to do about it rather than how bad it
is.

Rejected, and worth recording because the file is large and mostly irrelevant
to this run: sections 3 to 5, the constraint-satisfaction and space-planning
material, and sections 6 and 7, drawing automation and code compliance. This
run touched only chrome. It placed no rooms, changed no rule in
`src/core/rules.ts` and generated no geometry, so none of that applied. Its
section 8.4 on audit trails was considered for the send flow and rejected as
out of scope: the prompt asks for one button with two moments, not for a
record of what a resident sent and when.

The prompt also asked which skills were read, in the plural. Only the one named
was read. The directory holds thirty others, and none of them was opened,
because none of them speaks to a button, a label or a CSS delay.

## The Assumptions, checked

**Assumption 1 holds, and the rule is named.** Step 02 does wake on one rule
since run 0027. It is `canSend(phase)` at `src/core/flatState.ts:41-43`, over
`flatPhase(placedRooms, unitBuilds)` at `src/core/flatState.ts:34-37`.

**Assumption 2 holds.** Step 01 had no button leading to step 02 before this
run. The palette is `#sidebar`, left of `#viewport`; the drawing fills the
rest; the numbers strip is `.tb-figures` inside the top bar and the check chip
is `#fig-check` beside it. The only route to step 02 was `#step-send` in the
bar.

**Assumption 3 is right about the shape and incomplete about the state,** which
is written up under **Deviations**.

**My own assumptions, and what each one costs if it is wrong.**

*That "after a flat has been sent" means after a successful publish to the
group, and not after any save.* Ticking "Project file" and writing a `.json` to
the machine does not turn the button into the way to the group; only the
`r.ok` branch of the publish sets `hasSent`, at `src/main.ts:1891`. If the
intent was any save at all, the flag moves up out of the `sel.publish` block
and the rest is unchanged.

*That the flag lives for the visit and not beyond it.* `hasSent` is a module
variable, so a reload puts the button back to "Send it" even though the flat is
still in the group. Persisting it would mean writing it into
`reconfigure.session` alongside the code and the name, which changes what is
stored about a resident, and the prompt says the store contract does not
change. If a resident returning to a sent flat should see "Go to your group"
straight away, that is a store change and belongs in its own run.

*That the arrival plays on every visit.* Nothing remembers that it has run, so
a resident who opens the landing four times sees it four times. This is raised
as open question 3.

*That the aside line, "Already sent your flat? Go to your group", is part of
the doors for the purpose of the stagger.* It is the fifth child of
`.landing-doors` and arrives at 2900 ms, after the four doors. The brief names
four doors rising and then the strip, and says nothing about this line, so it
was put where it reads: with the doors it belongs to, before the strip.

## Decisions and rationale

**`journeyMarks` was replaced rather than kept alongside `journeyTones`.** Two
functions answering "how does this dot read" would let the two apps disagree,
which is the exact failure `src/core/journey.ts`'s own header says the module
exists to prevent. The four tests that pinned the old marks were rewritten as
four tests pinning the tones, so the file's case count did not move.

**The forward button uses `aria-disabled`, not `disabled`.** This copies what
run 0027 found live for the bar's step 02 and recorded at `src/main.ts:1329-1332`:
a `disabled` button fires no click, so the resident who most needs to hear why
the way forward is shut is the one who gets silence. Pressing it asleep reaches
`setStep`, which refuses at `src/main.ts:1300-1303` and raises `NO_WAY_IN` as a
toast. The look is kept honest by
`.btn-send[aria-disabled="true"]` at `src/style.css:496-512`, which repeats what
`.btn-send:disabled` does.

**`hasSent` clears on any edit.** The prompt says the button becomes the way to
the group after a send, and says nothing about coming back. Leaving the flag
set would mean a resident who improves their flat has no way to send the new
version, which is worse than the small cost of the label changing back. The
clear sits on the first line of `refreshFlatFigures`, which only
`commitHistory`, undo/redo/import and the initial call reach, so a send never
clears its own flag.

**The delays are written out as eleven literal values rather than derived from
custom properties.** The building app has to copy them exactly and reads them
out of the table in this report and out of the comment at
`src/style.css:2959-2985`, so the numbers are in one place and readable without
arithmetic.

**The arrival stops at the journey strip.** The red top rule and the brand and
credit line are visible from the first frame. The brief's sequence names the
discs, the headline, the paragraph, the doors and the strip, and adding the
header to it would be inventing a sixth step nobody settled.

## Deviations from the prompt

**Assumption 3 was slightly wrong about where the button shape lives.** The
prompt says `.btn-send` is in `src/style.css` from run 0026, which is right,
but it describes only the awake look. The asleep look existed as
`.btn-send:disabled` at `src/style.css:498`, which does not apply to a button
that is `aria-disabled` instead. `src/style.css:496-512` extends the existing
rules with an `[aria-disabled="true"]` selector rather than writing a second
grey.

**`_cowork/CONTEXT.md` was updated even though this run did not change the
repo's shape.** The `/next` skill says to update it only for a new top-level
directory, a new entry point or a new dependency or run step, and this run
added none of those. Task 6 asked for it by name, so it was updated, and the
paragraph says plainly that nothing structural moved.

**One correction outside the run's scope, in `PROJECT_STATE.md`.** §14 still
described the empty state's drop hint as "one dashed red diamond … a DOM
overlay rotated onto the isometric angle". That has not been true since run
0033 replaced the CSS diamond with an SVG polygon traced on the active floor's
projected grid corners. `CLAUDE.md` requires `PROJECT_STATE.md` to be accurate
to the actual code, so the sentence was corrected in the same commit.

## Blocked / did not do

**Captures were not written as image files.** The prompt allows either captures
or a description element by element with every sentence quoted, and this
environment's Browser pane returns screenshots into the session rather than to
a path, so the description route was taken. The four states the prompt names
are all covered under **Evidence**.

## Open questions for you

1. **Does the forward button belong in step 02 as well, pointing at the group,
   or does that job stay with `#save-go`?** Right now step 02 has one red
   button that changes what it says. That satisfies "one button, two moments",
   but it means the way onward lives inside the send panel rather than in the
   viewport where the forward button trained the resident to look. If the
   building app puts its own forward control in a fixed place on every screen,
   the two apps will disagree about where "onward" lives, and the resident
   crosses between them.

2. **Should a resident who has sent, and then edits, be told that the group is
   now looking at an older flat?** The label going back to "Send it" is the
   only signal. Nothing on the screen says a version is already out there under
   their name, and the store knows: `publishUnit` returns a version number, and
   the answer line shows it only when it is above 1. A resident who edits and
   then leaves without sending again has silently left the group with the old
   flat.

3. **The arrival takes 3.5 seconds every visit.** That is what the brief asks
   for and it reads well the first time. A resident who comes back four times
   in an afternoon sees it four times, because the sequence is pure CSS and CSS
   cannot know it has run before. Making it play once per browser would mean a
   stored flag and a class, which is the same shape as `.no-arrive`. Whether
   that is worth doing is a question about the presentation as much as about
   the app: the landing is also the user-journey slide.

## Suggested next prompt

**The building app's own landing, and the mirror of the six dots.** The brief
settled on 6 September that both apps have the same landing: same headline,
same three lines, same two discs, same journey strip, only the doors differ.
This run built that landing's arrival and its three-tone strip in the flat app.
The next prompt should carry the same into `bottom-up-design`: copy the eleven
delays out of the table in this report exactly, render `JOURNEY`'s six steps
with `journeyTones(<current step>, "building")` so the last four are ink and
the first two dim, and give it the three doors the brief names for that app,
which are Join a group, Open a building and Look at the example. It should
report back the same table of delays measured from its own computed styles, so
the two landings can be compared number by number, and it should say which of
its five screens each of the four building-app dots maps to.
