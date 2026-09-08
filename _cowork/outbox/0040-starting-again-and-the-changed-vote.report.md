---
id: "0040"
title: Starting again, and the vote a person changed
source: 0040-starting-again-and-the-changed-vote.md
status: complete
branch: run/0040
commit: c54c556
completed: 2026-09-08
---

## Summary

The landing now has a written way out. When this browser remembers a flat or a
name, one quiet line under the doors offers to start again, asks once, and then
forgets both while the flat already sent stays in the group. And the store
keeps a vote somebody changed: the superseded one goes into `replaced` on the
round, while `votes` keeps its meaning so nothing counting from it changes. All
eight tasks landed on `run/0040`, which branched from `main` at `bbe4494` and
ends at `c54c556`.

## What I did

Eight commits. The branch state found on `main` was `bbe4494`, "Merge
run/0039: the store holds a vote".

`f08fc55` **design: the brief as of 8 September**, one file, 19 insertions and
1 deletion. `_cowork/design/DESIGN-BRIEF-3sep.md` went from 18750 bytes to
19814, `cmp`-identical to the Context copy.

`046e886` **landing: start again with a new flat**, three files, 161 insertions
and 5 deletions. `src/core/draft.ts:43` is `BROWSER_MEMORY`, `53`
`forgetThisBrowser`, `82` `remembersAnything`, `97` `asksToForget`, `103`
`withoutFresh`, `117` `START_AGAIN` and `124` `FORGET_CONFIRM`.
`index.html:369` is the line; `src/style.css:568-593` styles it.

`a46545a` **landing: forgetting this browser**, one file, 75 insertions and 3
deletions. `src/main.ts:1497-1518` is `forgetAndStartAgain`, `1520` the
handler, `1467` the line's own visibility, and `2504-2510` the `?fresh` path.

`9820782` **store: a changed vote is kept**, one file, 28 insertions and 2
deletions. `src/session/store.ts:262` is the field, `779` where a superseded
vote is kept, and `360` where the wire shape defaults it to a list.

`50d65c1` **docs: the changed vote**, one file, 16 insertions and 3 deletions.

`b6ca219` **store: the round trip changes a vote**, one file, 17 insertions and
1 deletion.

`57f18a7` **tests for 0040**, two files, 273 insertions and 3 deletions.
`src/core/draft.test.ts` goes from 16 cases to 35;
`src/session/store.test.ts` from 89 to 96.

`c54c556` **docs: PROJECT_STATE for run 0040**, one file, 76 insertions and 1
deletion.

## Findings

**The line could stay outside the shared fragment, and did.** The prompt said
to stop and say so if that turned out to be impossible. It did not. The
fragment already provides `#landing-doors` as a container, and the line is
declared in `index.html:369` and moved into it by `src/main.ts` at startup.
Putting this app's own element inside a container the fragment provides, and
styling that element from this app's stylesheet, is not restyling anything of
the fragment's. `src/landingShared.test.ts` still passes at 16, so the shared
files and their fingerprint are untouched.

**Its arrival delay had to be written by id.** The fragment gives every child
of `.landing-doors` the `animation` shorthand, which resets `animation-delay`
to zero. `#landing .landing-start-again` and `#landing .landing-doors > *` are
the same specificity and the fragment's stylesheet comes later, so the
fragment won. Measured live, the line read `animationDelay: "0s"` and appeared
at once while everything else staggered. Written `#landing #landing-start-again`
it reads `3.05s`, which puts it after the aside at 2900 ms and before the
journey strip at 3200 ms.

**"Remembers something" cannot simply mean "the key exists".** Emptying the
editor writes an empty draft like any other edit, because run 0036 hangs the
draft off every mutating action. So the moment after somebody starts again,
`reconfigure.draft` is back with an empty project inside it. The first version
of `remembersAnything` looked only for a non-empty string and the line stayed on
screen after forgetting, measured live. It now asks `draftHasRooms`, the same
question `readDraft` asks before restoring, and treats a session of two empty
strings as nothing as well. `src/core/draft.test.ts` pins both.

**`history` in `src/main.ts` is the undo stack**, so cleaning the address needed
`window.history.replaceState`. `tsc` caught it: `Property 'replaceState' does
not exist on type 'History'`.

**`replaced` is an empty list on the wire, not an absent field.**
`src/session/store.ts:360` names it in `roundView` rather than leaving it to the
spread. A round nobody changed their mind on and a round opened before this
field existed then read the same, and a client can take `replaced.length`
without checking for undefined first. That matters because the building app is
the only caller and run 0064 will count from these.

**Keeping the replaced votes changed no count.** `votes` is filtered exactly as
it was; the superseded entries are copied into `replaced` before the filter runs.
The pair's `voted` count, the close rule and every refusal are untouched.
`src/session/store.test.ts` drives four changes of mind on one pair and shows
the round not closing early, then the last expected vote closing it.

## Evidence

Everything below was executed. Nothing is estimated.

**Two pictures**, both 1440 by 900, taken with the Chrome already on this
machine in headless mode with reduced motion forced, which is the finished
landing by the fragment's own definition.

- `_cowork/outbox/0040-remembered.png`, 410990 bytes. The line reads "Start
  again with a new flat." under "Already sent your flat? Go to your group".
- `_cowork/outbox/0040-first-visit.png`, 406651 bytes. The same landing after
  `?fresh`, with nothing where the line was.

**The written line, measured live** against `netlify dev` on 8888 at 1440 by
900, with `reconfigure.session` holding `{"resident":"Ana","code":"hall-14"}`.

| what | reading |
|---|---|
| hidden | `false` |
| text | `Start again with a new flat.` |
| colour | `rgb(107, 102, 92)` |
| cursor | `pointer` |
| animation delay | `3.05s` |
| its top | y 629 |
| the aside's top | y 583 |
| its parent | `landing-doors` |

`rgb(107, 102, 92)` is the fragment's `--meta`, `#6b665c`. On a browser with
nothing in `localStorage` the same reading gives `hidden: true`.

**The confirm's wording, as shown.** Captured by replacing `window.confirm` for
the length of the click and reading what it was passed:

```
This forgets the flat and the name on this browser. The flat you sent stays in your group. Start again?
```

**What one function clears.** `forgetThisBrowser` at `src/core/draft.ts:53`
walks `BROWSER_MEMORY` at `src/core/draft.ts:43`, which is exactly two keys:

```
reconfigure.draft      the flat as it was being drawn
reconfigure.session    the group code and the name
```

It returns the keys it cleared. Nothing else is touched;
`src/core/draft.test.ts` puts a third key in the store and shows it surviving.
Nothing is sent anywhere: a flat already published stays in its group.

**The no path and the yes path, live.**

| moment | `localStorage` keys | line hidden | first door | fields |
|---|---|---|---|---|
| before | `["reconfigure.session"]` | `false` | — | — |
| after a no | `["reconfigure.session"]` | `false` | — | — |
| after a yes | `["reconfigure.draft"]`, no rooms in it | `true` | `Start a flat` | both empty |

After the yes the recall sentence is hidden, the flat's area reads `—`, and the
landing is showing. The `reconfigure.draft` key that remains holds the empty
grid the editor was reset to, which `remembersAnything` and `readDraft` both
read as nothing.

**`?fresh`, shown once.** With both keys present, loading
`http://localhost:8888/?fresh` gave:

```json
{ "address": "http://localhost:8888/", "search": "", "keys": [],
  "lineHidden": true, "startLabel": "Start a flat", "code": "" }
```

Both keys gone, no question asked, and the address cleaned so a reload does not
forget again.

**The round after a replaced vote, pasted whole.** From the round trip against
`netlify dev`, session `rt-mtsjq3do`, read immediately after Ana's second vote
on `p1`:

```
  Ana on p1, current: [{"who":"Ana","pair":"p1","pick":"b","reasons":["light","privacy"],"at":"2026-09-08T10:48:10.701Z"}]
  Ana on p1, replaced: [{"who":"Ana","pair":"p1","pick":"a","reasons":["light"],"at":"2026-09-08T10:48:10.418Z"}]
  ok    one current vote for Ana on p1, her second
  ok    and her first is kept in `replaced`
  ok    the kept one carries the earlier time (2026-09-08T10:48:10.418Z before 2026-09-08T10:48:10.701Z)
```

One current vote for her on that pair, her second. Her first is in `replaced`
with its own earlier time and the reasons she ticked then.

**The round-trip script's output.** `node scripts/store-roundtrip.mjs
http://localhost:8888` exits 0 with `all checks passed for session
"rt-mtsjq3do"`, at 97 checks, up from 94 before this run. The three new ones
are quoted above. The full output is 322 lines and is not pasted whole; the
script prints every response raw when run.

**Test counts.**

| suite | on `main` (`bbe4494`) | on `run/0040` |
|---|---|---|
| fast | 432 in 23 files | 458 in 23 files |
| slow | 58 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

The 26 new cases are 19 in `src/core/draft.test.ts` and 7 in
`src/session/store.test.ts`.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The landing fingerprint test passes at 16**, so the shared files are
untouched. `git diff --stat main HEAD` over `_cowork/design/landing/` returns
nothing at all.

**The three downloads are byte-identical.** The same command over
`src/core/saveFiles.ts`, `src/core/projectIO.ts`, `src/core/unitExport.ts`,
`docs/bridge-format.md` and `testflats/` returns nothing.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 9.62 s.**

## Artifacts produced

- `_cowork/outbox/0040-starting-again-and-the-changed-vote.report.md` — this file.
- `_cowork/outbox/0040-remembered.png` — the landing with the line, 1440 by 900.
- `_cowork/outbox/0040-first-visit.png` — the same after forgetting.
- `src/core/draft.ts` — the browser's memory and what forgetting clears.
- `src/session/store.ts` — `replaced` on the round.
- `docs/store.md` — the changed vote, in the vote section and the example.
- `scripts/store-roundtrip.mjs` — 97 checks.
- `_cowork/design/DESIGN-BRIEF-3sep.md` — the 8 September brief.
- `PROJECT_STATE.md` — new §21.
- `_cowork/CONTEXT.md` — one paragraph for run 0040.

A `public/seed0040.html` was written to seed a browser for the first picture and
deleted afterwards; `git status` shows nothing left behind. The round trip left
its own `rt-…` session in the local Blobs store, as it always does.

## Skills read from disk

One, from
`C:\\Users\\ADMIN\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\skills-plugin\\f1d881be-0a13-45d3-acab-472cf2886dae\\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\\skills\\`.

`interoperability/SKILL.md`, 53097 bytes. Its section 7.1, on what a caller may
assume from a shape, is why `votes` was left exactly as it was and the kept
votes went into a new field beside it. The building app counts from `votes` and
run 0064 will; a field that quietly grew to hold both current and superseded
entries would have changed every count without changing a name. Its section 1.4,
the data-loss taxonomy, is the argument for the change existing at all: throwing
the earlier vote away is the metadata loss it describes, information that is
not needed to run the thing and is needed to understand it afterwards, and it
is the kind that is only noticed once it is gone. Its section 7.5 on error
handling and defaults is why `replaced` is an empty list rather than absent on
the wire: a caller should not have to tell "nobody changed their mind" from "an
older store".

Rejected from it: sections 2 to 6 and 8 to 10, file formats, exchange
strategies, Rhino, Revit, Speckle, schema mapping and coordinate systems.
Nothing here crosses a format.

`design-automation` was not read for this run and was not asked for. Its
section 2.1, one rule stated once, is what `forgetThisBrowser` is, and it was
read earlier in this session.

## The Assumptions, checked

**Assumption 1 holds.** The flat is under `reconfigure.draft` in
`src/core/draft.ts` and the code and name under `reconfigure.session` in
`src/session/session.ts`. Those two are all the landing reads, and
`BROWSER_MEMORY` at `src/core/draft.ts:43` now names them in one place.

**Assumption 2 holds.** `showLanding` sets the first door's label from
`isEmptyProject()` and the fields from `landingRecall()`. It now also sets the
written line's visibility, at `src/main.ts:1467`, and nothing else decides what
the landing shows.

**Assumption 3 holds.** A round's `votes` holds one entry per person per pair,
the current one, and this run did not change that.

**My own assumptions, and what each costs if it is wrong.**

*That an empty draft is not something to start again from.* It is why the line
disappears after forgetting rather than staying. If a resident should be
offered a fresh start even with an empty grid, the check at
`src/core/draft.ts:85` comes out, and the line then shows on a browser that has
nothing but has once had the editor open.

*That the line belongs in the doors column rather than the fragment's
`#landing-extra` slot.* The prompt says under the doors, and the slot lays out
beside them rather than under, because it is `display: contents` inside a flex
row. Putting the line in the doors column is what "under the doors" means on
the screen. If the building app later wants the same line, the fragment is
where it would go, and the fingerprint would move with it.

*That `?fresh` should ask nothing.* The prompt says so and the reason is that
it is for the operator. Anybody who reaches it by accident loses a draft they
did not ask to lose. It is one word in an address and not linked from anywhere.

*That forgetting resets the editor rather than reloading the page.* A reload
would be simpler and would also clear the scene. It would also throw away the
warm scene the landing is deliberately drawn over, which run 0027 built on
purpose, and would make `?fresh` and the button behave differently from each
other.

*That the replaced votes are not capped.* `messages` has a 200 cap because a
group can talk indefinitely. A round has a bounded number of people and pairs,
and a person changing their mind ten times is a person, not a loop. If a client
ever polls a round with thousands of replacements, the cap belongs where
`MESSAGE_CAP` is.

## Decisions and rationale

**One function, returning what it cleared.** The button, `?fresh` and the tests
all call `forgetThisBrowser`, and it answers a list rather than nothing so the
caller can say what happened and a test can pin it exactly rather than by
inspecting a store afterwards.

**The line is a `<button>` styled as text.** It is an action, not a link, and a
button is what a keyboard reaches and what a screen reader announces correctly.

**`remembersAnything` asks the same question `readDraft` does.** Two different
answers to "is there a flat here" would eventually disagree, and the disagreement
would show as a line offering to forget something that is not there.

**The superseded votes are copied before the filter.** One expression, in the
same write, so a replacement that is kept and a `votes` list that is filtered
cannot come apart.

## Deviations from the prompt

**None of substance.** The line stayed outside the shared fragment as asked,
and the shared files were not touched.

**One thing the prompt did not name.** `roundView` gives `replaced` a default
empty list on the wire, at `src/session/store.ts:360`. The prompt says the
polled state carries `replaced`; without the default it would carry it only on
rounds that had one.

## Blocked / did not do

**A `netlify dev` is running on port 8888**, left from run 0039 and used by this
one. It should be stopped by whoever finishes with this working tree.

## Open questions for you

1. **Should starting again offer to take the flat out of the group too?** The
   question says plainly that the sent flat stays, and the brief settles that
   removing it is done from the group screen. That is right as a rule and it
   may still be wrong as an experience: somebody who says "start again" on the
   laptop probably means it about the whole thing, and the group screen is in
   the other app. The store has had `DELETE .../residents/{name}` since run
   0035, so offering it here is possible; whether a person should be able to
   leave a group from the flat app at all is the question.

2. **What should `?fresh` do to a group the operator is standing in?** It
   forgets the browser and nothing else, which is right for restarting the flat
   app between demonstrations. It does not touch the group, so a fifth demo
   leaves five flats in one room under one name. The fill command from run 0038
   refuses a group holding flats without `--replace`; there is no matching way
   to empty one, and during a live session that may be what the operator
   actually wants.

3. **Does `replaced` want to record what changed, or only that something did?**
   It holds whole votes, so the pick and the reasons are both recoverable and a
   reader can see that somebody moved from "light" to "cost". What it cannot
   show is WHY, and the interesting version of the thesis finding is probably
   "people changed their minds after seeing the count" rather than "people
   changed their minds". Recording what the count was when each vote was cast
   would answer that, and it is a field on the vote rather than a new list.

## Suggested next prompt

**The building app counts the vote and shows it.** Everything it needs is in
the store: `PUT /api/session/{code}/round` opens a round of pairs,
`POST .../rounds/{n}/votes` casts one vote per person per pair,
`replaced` keeps the ones people changed, the polled state carries `round` and
`lastRound` with per-pair counts, and `/export` carries every round. All of it
is in `docs/store.md` with examples.

Run 0064 in `bottom-up-design` should build the vote screen the brief
describes and do the counting the store deliberately does not: which building
won each pair, whether three quarters of those who voted chose the same one,
and what the ticked reasons do to the five weights the next round is built
with. It should say what it shows a resident who has already voted, what it
shows between the last vote and the next round going up, and whether it uses
`replaced` for anything, since a line reading "3 people changed their minds
after seeing the count" is available to it and nothing else in either app can
say that. It should also report whether it met the 403-becomes-404 behaviour
run 0039 recorded, because it is the only caller and will.
