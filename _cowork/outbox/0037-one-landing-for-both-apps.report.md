---
id: "0037"
title: One landing for both apps
source: 0037-one-landing-for-both-apps.md
status: complete
branch: run/0037
commit: bfb0ec0
completed: 2026-09-07
---

## Summary

The landing is now one file rather than one description. Two files,
`landing.html` and `landing.css`, hold the whole of it, and this app renders
from them with one attribute on the root choosing its doors and its dot
colours. The source lives in the Context folder beside the brief and this
repository carries a byte-for-byte copy that a test hashes against a line in
the brief, so a copy edited by hand fails and says the landing has drifted. All
seven tasks landed on `run/0037`, which branched from `main` at `d015b9b` and
ends at `bfb0ec0`.

## What I did

Seven commits. The branch state found on `main` was `d015b9b`, "Merge run/0036:
sending is one press, and the store says who left".

`2276db5` **landing: one file for both apps**, three files, 717 insertions.
`_cowork/design/landing/landing.html` is 117 lines, `landing.css` 512 lines,
`README.md` 88 lines.

`67ea7b6` **landing: the shared copy**, one file, 17 insertions. The brief's
landing section gains the paragraph and the fingerprint line at
`_cowork/design/DESIGN-BRIEF-3sep.md:200-214`.

`1c12839` **ui: the landing is the shared one**, five files, 87 insertions and
470 deletions. `index.html` loses the landing's markup and keeps this app's two
forms at `index.html:352-383`. `src/style.css` loses 9046 bytes of landing
rules. `src/main.ts:60-66` imports the fragment and `src/main.ts:104-116` inserts
it and moves the forms in.

`d906959` **landing: it cannot drift, and tests for 0037**, one file, 222
insertions. `src/landingShared.test.ts` is new, 16 cases.

`2bf8868` **landing: what it looks like**, one file.
`_cowork/outbox/0037-landing.png`, 390098 bytes.

`bfb0ec0` **docs: PROJECT_STATE for run 0037**, one file, 81 insertions and 1
deletion.

## Findings

**The two files, their sizes and their hashes.** Sizes and hashes are over the
files with every CRLF read as LF, which is what the fingerprint is over.

| file | bytes | sha256 |
|---|---|---|
| `landing.html` | 6149 | `883c09ee7ae68ffe55a222287d43acb430f8739e3fe47298caabcec1b09d0556` |
| `landing.css` | 14269 | `db3535a16e4223f909f628a09e59d1e19e1dc660fdd5aa00542bc4019e472e7d` |

The line the brief records, at `_cowork/design/DESIGN-BRIEF-3sep.md:211` and at
the same place in the Context copy:

```
LANDING FINGERPRINT sha256 908c7f9e20e8e89f3a36a766056c2659803e38dd266207dd9377ef19553ba419
```

That is the two files concatenated in that order, normalised, hashed as UTF-8.
`cmp` reports `landing.html`, `landing.css` and `README.md` identical between
`_cowork/design/landing/` and
`D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\`.

**Line endings had to be normalised, and the reason is not tidiness.** This
repository checks the brief and the fragment out with CRLF while the Context
folder holds them with LF: the repo's brief carries 319 CRLF pairs and 15717
bytes where the Context copy carries none and 15397. A hash over raw bytes
would therefore report two identical files as different, and the building app,
checked out on the same machine under its own settings, could disagree with
this one for no reason a person could see.

**Seven door-appearances are six door elements.** "Join a group" is the same
door in both apps, carrying `data-for="both"`, and
`src/landingShared.test.ts:95-98` pins that there is exactly one of it. Two
elements for one door would have been the first crack in a file whose whole
purpose is that there is only one.

**The doors take their arrival delay by id, not by position.** `nth-child`
counts elements that are `display: none`, so with the building app's two doors
hidden the flat app's fourth door would have taken the fifth delay. The
fragment writes the delays out per id, five rules for the flat app and three
for the building app, at `_cowork/design/landing/landing.css:469-492`.

**The journey strip stopped being rendered.** The six dots are markup in the
fragment with their tones from `data-app` in CSS, so `renderJourney` in
`src/main.ts` is gone and the building app does not need `journey.ts` at all to
draw them. `src/core/journey.ts` stays the record of what the six steps ARE,
and `src/landingShared.test.ts:121-132` checks the fragment's dots against it,
in order and wording, so the markup and the record cannot part company either.

**Two things had drifted in the fragment itself, caught by proving it against
run 0034's landing.** The journey strip's spacing was written `0 0 28px` over a
2 px rule where the app had `22px 0 34px` over 3 px. Both are the original
again, and the fingerprint moved with them, from
`1ee8bee8…` to `908c7f9e…`. That is the fingerprint doing its job on its first
day.

**A picture of a 1440 by 900 landing could not come from the Browser pane.**
The pane is about 800 by 500, so an emulated 1440 by 900 viewport comes back
scaled by 0.55. The picture was taken with the Chrome already installed on this
machine, in headless mode, at a real 1440 by 900. No dependency was added.

**A headless screenshot of an arriving landing catches it at zero.** The first
attempt used `--virtual-time-budget=8000` and produced a page holding only the
red rule, the brand and the credit line: virtual time does not advance a CSS
animation. `--force-prefers-reduced-motion` is what makes it the finished
landing, and it is honest rather than a trick, because the fragment answers
that setting by turning the arrival off and its keyframes have a `from` and no
`to`, so the state with no animation IS the finished state.

## Evidence

Everything below was executed. Nothing is estimated.

**The eleven delays, read back from computed styles on the shared landing**,
against `netlify dev` at 1440 by 900. Run 0034's table is the middle column and
what the shared landing reports is the right one.

| element | run 0034 | the shared landing |
|---|---|---|
| yellow disc | 1000 ms / 600 ms | `1s` / `0.6s` |
| blue disc | 1000 ms / 600 ms | `1s` / `0.6s` |
| headline line 1 | 1600 ms / 300 ms | `1.6s` / `0.3s` |
| headline line 2 | 1750 ms / 300 ms | `1.75s` / `0.3s` |
| headline line 3 | 1900 ms / 300 ms | `1.9s` / `0.3s` |
| paragraph | 2200 ms / 300 ms | `2.2s` / `0.3s` |
| door 1, Start a flat | 2500 ms / 300 ms | `2.5s` / `0.3s` |
| door 2, Start a group | 2600 ms / 300 ms | `2.6s` / `0.3s` |
| door 3, Join a group | 2700 ms / 300 ms | `2.7s` / `0.3s` |
| door 4, Open a file | 2800 ms / 300 ms | `2.8s` / `0.3s` |
| the aside line | 2900 ms / 300 ms | `2.9s` / `0.3s` |
| journey strip | 3200 ms / 300 ms | `3.2s` / `0.3s` |

Eleven arrivals over twelve rows, because the two discs share one. The
building app's three doors report `0s` in this app because they are
`display: none` and their delay rules only match `[data-app="building"]`.

**What the switch shows, door by door.** Read from the live DOM with
`getComputedStyle(...).display !== "none"`, and pinned in
`src/landingShared.test.ts:76-118`.

| door | `data-for` | `data-app="flat"` | `data-app="building"` |
|---|---|---|---|
| `landing-start`, Start a flat | flat | shown | hidden |
| `landing-new`, Start a group | flat | shown | hidden |
| `landing-join`, Join a group | both | shown | shown |
| `landing-open`, Open a file | flat | shown | hidden |
| `landing-open-building`, Open a building | building | hidden | shown |
| `landing-example`, Look at the example | building | hidden | shown |
| the aside, "Already sent your flat? Go to your group" | flat | shown | hidden |

Live, with `data-app="flat"`: `landing-start` true, `landing-new` true,
`landing-join` true, `landing-open` true, `landing-open-building` false,
`landing-example` false, the aside true.

**What the switch shows, dot by dot.** All six always render. The colours below
are the dot's `background-color`, read live under `data-app="flat"`; a
transparent background is the hollow dim dot, which keeps its `--dim` border.

| dot | owner | `data-app="flat"` | `data-app="building"` |
|---|---|---|---|
| `journey-draw`, Draw your flat | flat | red, `rgb(214, 52, 28)` | dim |
| `journey-send`, Send it | flat | ink, `rgb(22, 22, 22)` | dim |
| `journey-wishes`, Your wishes | building | dim, `rgba(0, 0, 0, 0)` | red |
| `journey-group`, The group | building | dim, `rgba(0, 0, 0, 0)` | ink |
| `journey-your-flat`, Your flat in it | building | dim, `rgba(0, 0, 0, 0)` | ink |
| `journey-vote`, Vote | building | dim, `rgba(0, 0, 0, 0)` | ink |

`rgb(214, 52, 28)` is the brief's red `#d6341c` and `rgb(22, 22, 22)` its ink
`#161616`.

**That the landing did not change while moving.** Measured at 1440 by 900 after
the move, against the values the app had before it: the doors 400 px wide with
their column from x 966 to x 1366; the headline 78 px; the journey strip
`22px 0px 34px` under a 3 px rule. The join form opens at exactly the doors'
place, 400 px wide at x 966, the doors hide while it is open, and "back"
restores them carrying `no-arrive` so the stagger plays once. "Start a group"
invented the code `marble-34` and showed the new-group form. No console errors.

**That the fingerprint catches drift.** One comment line was appended to
`_cowork/design/landing/landing.css`, the test was run, and it failed with:
"the landing has drifted from the shared one: this app's copy of landing.html
and landing.css no longer hashes to the line in the brief. Copy them again from
Context\01-design\landing\, or, if the change was meant, make it there and
update the brief." The hash it reported was `bb0be784…` against the recorded
`908c7f9e…`. The line was removed and the test passed again.

**The picture.** `_cowork/outbox/0037-landing.png`, 1440 by 900, 390098 bytes,
PNG header read back to confirm the dimensions. It shows the red rule, the
yellow disc out of the top left and the blue out of the bottom right, the brand
and the credit line, the headline over three lines, the paragraph, the four
doors with "Start a flat" red, the aside, and the six dots with "Draw your
flat" red, "Send it" ink and the other four dim.

**Test counts.**

| suite | on `main` (`d015b9b`) | on `run/0037` |
|---|---|---|
| fast | 374 in 21 files | 390 in 22 files |
| slow | 58 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

The 16 new cases are all in `src/landingShared.test.ts`.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical and the store contract did not
change.** `git diff --stat main HEAD` over `src/core/saveFiles.ts`,
`src/core/projectIO.ts`, `src/core/unitExport.ts`, `docs/bridge-format.md`,
`testflats/` and `src/session/store.ts` returns nothing at all.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 8.44 s**, 84 modules,
`dist/index.html` 22.68 kB, CSS 43.88 kB, JS 3435.91 kB. The CSS grew by 1.86 kB
and the HTML shrank by 2.41 kB, which is the landing moving from the document
into the bundle.

## Artifacts produced

- `_cowork/outbox/0037-one-landing-for-both-apps.report.md` — this file.
- `_cowork/outbox/0037-landing.png` — the landing at 1440 by 900.
- `_cowork/design/landing/landing.html`, `landing.css`, `README.md` — new.
- `D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\` — the same three
  files, byte for byte, and this is the source.
- `_cowork/design/DESIGN-BRIEF-3sep.md` and the Context copy — the landing
  paragraph and the fingerprint line.
- `src/landingShared.test.ts` — new, 222 lines, 16 cases.
- `PROJECT_STATE.md` — new §18.
- `_cowork/CONTEXT.md` — one paragraph for run 0037, **Last updated** 2026-09-07.

## Skills read from disk

Two, from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\f1d881be-0a13-45d3-acab-472cf2886dae\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\skills\`.

`design-automation/SKILL.md`, 45081 bytes. Its section 2.1 on production rules
is the argument for one attribute rather than two files: a rule stated once and
read by every consumer cannot be inconsistent, and two landing files that begin
identical are two rules that will not stay so. It is also why the switch
reaches exactly two things and why the README says plainly that anything else
differing is drift; a switch with a third arm is the beginning of the second
file. Its section 2.6 on conflict resolution, that a more specific rule
overrides a general one, is the shape of the door rule: every door is shown by
default and one specific rule hides the ones this app lacks, so a door added
without a `data-for` appears in both apps rather than in neither, which is the
safer failure.

Rejected from it: sections 3 to 7, constraint satisfaction, space planning,
layout generation, drawing automation and code compliance. This run moved
markup and styles between two folders.

`interoperability/SKILL.md`, 53097 bytes. Its section 3.5, database-mediated
exchange, is the shape of the fingerprint: a shared store of record with copies
that check themselves against it, which is what two repositories that cannot
import from each other can actually have. A live link is what its section 3.3
describes and neither app can have one. Its section 1.4, the data-loss taxonomy,
named the failure this is against, which is semantic loss: two landings that
still look like landings while having quietly stopped being the same one, which
is precisely what Shrey found on 7 September. Its section 7.1 on what a caller
may assume decided what the fragment promises: stable ids and one attribute, and
nothing about the app's own CSS, which is why every selector is scoped and every
token is declared inside the file.

Rejected from it: sections 2, 4, 5, 6 and 8 to 10, file formats, Rhino, Revit,
Speckle, schema mapping and coordinate systems. Its section 7.5 on rate limiting
does not apply to a file read at build time.

## The Assumptions, checked

**Assumption 1 holds.** The landing was `#landing` in `index.html` from run
0027, the arrival CSS was at `src/style.css:2959-3033` from run 0034, and the
three-tone dots came from `src/core/journey.ts`.

**Assumption 2 holds.** The building app's three doors and this app's four plus
the aside are what the fragment now carries, with Join a group shared.

**Assumption 3 holds.** The brief's landing paragraphs are the authority and
run 0034's report holds the eleven delays; both were used as written.

**Assumption 4 holds in substance and was not relied on.** Both apps do use the
same fonts, colours and paper, but the fragment declares every colour and font
it needs on `#landing` itself rather than trusting that, so the two apps cannot
diverge through a token that differs.

**My own assumptions, and what each costs if it is wrong.**

*That the red dot on a landing is that app's own first step.* The brief says
the current dot is red and a landing is where a resident starts, so on the flat
app that is "Draw your flat" and on the building app "Your wishes". If the
building app's landing should mark a different step, that is one rule in
`landing.css` and it is written out explicitly rather than derived.

*That an app's own forms belong outside the fragment.* The prompt's list of
what the fragment holds does not include them, and the two apps' forms are not
the same form. The shapes they take ARE styled in the fragment, so they look
alike, and `#landing-extra` is where they go. If the building app finds it
needs something the slot cannot hold, the slot is one div and can be moved.

*That the fragment ships `data-app="flat"`.* It has to ship one of the two.
`hidden` on the same element is what makes the choice harmless: nothing is on
screen until an app has both set the attribute and decided to show it. If the
building app forgets to set it, its landing shows this app's doors, which its
own test for the switch would catch.

*That the picture may be taken with reduced motion forced.* It is the finished
landing by the fragment's own definition, since its keyframes have no `to`. If
a picture of the arrival mid-flight is wanted, that is a different capture and
a different tool.

## Decisions and rationale

**One file with a switch, rather than two files that start identical.** Two
files would need a process to keep them equal, and the process is the thing
that failed the first time.

**The switch reaches two things and the README says so.** A switch that can
reach anything is a template, and a template is how the two landings diverge
again with the divergence written down as configuration.

**Doors are shown by default and hidden by a specific rule.** A door added
without a `data-for` appears in both apps. The other way round it would appear
in neither, and a door nobody can see is harder to notice than a door in the
wrong app.

**The fragment declares its own tokens.** It could have read `--accent` and the
rest from each app's `:root`, and both apps do define them identically today.
Declaring them inside removes a way for the two landings to differ that nobody
would think to check.

**The fingerprint is over both files together.** Two hashes would say which
file drifted, which is information a person gets from `git diff` anyway, and
would mean two lines in the brief to keep in step.

## Deviations from the prompt

**Tasks 4 and 5 share one commit, `d906959`.** Both are `src/landingShared.test.ts`
and task 4's fingerprint test is one of task 5's cases. Two commits would have
meant writing the file, committing, and reopening it immediately, which the
constraints ask me not to do.

**The fragment holds six door elements, not seven.** The prompt says "all seven
doors". Seven is the number of door-appearances across the two apps; six is the
number of doors, because "Join a group" is the same door in both. Giving it two
elements would have put an app-specific duplicate into a file whose purpose is
that there is one of everything.

**The journey strip's spacing was corrected after task 2's commit**, which
moved the fingerprint from `1ee8bee8…` to `908c7f9e…`. Task 4 says to record
the hash in this run, and the recorded line is the final one.

**The picture was taken with Chrome rather than through the Browser pane.** The
pane cannot produce a 1440 by 900 raster. Chrome was already on the machine and
was invoked once; nothing was installed and `package.json` is untouched.

**`_cowork/CONTEXT.md` was updated, and this time the repo's shape did change.**
There is a new shared directory outside either repository,
`Context\01-design\landing\`, which is the first thing the two apps have in
common besides `docs/store.md`.

## Blocked / did not do

**The building app's copy was not made.** That is its own run 0062, as the
prompt says. This run wrote the source and this app's copy.

**A second dev server is still running on port 8899**, with Vite on 5199,
started in run 0035 because the one on 8888 was not mine to restart.

## Open questions for you

1. **What happens when the two apps disagree about the fingerprint?** Each app
   fails its own test, which tells each developer that their copy is stale, but
   nothing tells anybody which of the two is right. In practice the answer is
   "the Context folder", and the README says so, but neither app can read the
   Context folder from its own tests: they hash their own copy against a line in
   their own copy of the brief. If both copies of the brief drift too, both apps
   pass while showing different landings. A test that reads the Context path
   directly would close that, at the cost of a test that only works on Shrey's
   machine.

2. **Does the aside line belong to the flat app only?** "Already sent your
   flat? Go to your group" is marked `data-for="flat"` because only this app
   sends flats. A resident who arrives at the building app and has already sent
   one has the same question and no answer on that screen. If the building app
   wants its own version of that line, it is one attribute here, and the two
   apps would then each carry a sentence the other does not, which is the first
   thing this file was built to prevent.

3. **Should the six dots be clickable?** They are not, in either app. A
   resident looking at the landing sees the whole journey and cannot use it to
   go anywhere, which makes it a diagram rather than a control. That may be
   right for a landing, where a person has not started. It is worth settling
   before the building app copies the file in, because making them navigation
   later means deciding what a dot does in an app that does not own that step.

## Suggested next prompt

**The building app copies the landing in.** The two files are at
`D:\_Studies\_DFAB\DFAB\_T3\Context\01-design\landing\`, with a README beside
them and their combined hash recorded in the brief under "The screens" as
`LANDING FINGERPRINT sha256 908c7f9e20e8e89f3a36a766056c2659803e38dd266207dd9377ef19553ba419`.
Run 0062 in `bottom-up-design` should copy both files in byte for byte, delete
whatever landing markup and styles it has now, set `data-app="building"` before
showing it, wire its three doors to `landing-join`, `landing-open-building` and
`landing-example`, put its own forms in `#landing-extra`, and carry a test that
computes the same hash the same way, over the two files concatenated with CRLF
read as LF. It should photograph its landing at 1440 by 900 the way this run
did, headlessly with reduced motion forced, and put the two pictures side by
side in its report. It should report anything the fragment did not give it,
because that is the list of things the file still has to learn.
