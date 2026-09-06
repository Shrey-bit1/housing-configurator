---
id: "0036"
title: Sending is one press, and the store says who left
source: 0036-sending-is-one-press.md
status: complete
branch: run/0036
commit: ceb58c9
completed: 2026-09-06
---

## Summary

Pressing the red button now publishes the flat and does nothing else. It used
to download a project file, download a unit file, write a library entry and
publish, with all four ticked by default and a browser dialog before them when
the layout check had anything to say. What a resident may still want written
lives folded under More as three named presses. Step 02 no longer asks again
who is sending and where to, and the drawing now survives a reload, which it
did not before. The store writes one line into a group's chat when somebody
leaves. All eight tasks landed on `run/0036`, which branched from `main` at
`880b722` and ends at `ceb58c9`.

## What I did

Seven commits for eight tasks; tasks 4 and 5 share one, for the reason under
**Deviations**. The branch state found on `main` was `880b722`, "Merge
run/0035: leaving takes the flat, renaming keeps it, and the library counts
from one", with nothing on `main` touched.

`df32bac` **editor: the flat is kept as you draw**, four files, 272 insertions
and 4 deletions. `src/core/draft.ts` is new at 97 lines; `src/core/draft.test.ts`
new at 135 lines, 16 cases. `src/core/history.ts:59-70` makes `commit` return
its snapshot. `src/main.ts:163-168` writes the draft, `src/main.ts:2349` writes
it after an undo, and `src/main.ts:2427-2436` restores it on load.

`5011922` **ui: as you, to your group**, four files, 77 insertions and 1
deletion. `src/session/session.ts:221-239` is `whoLine`. `index.html:266-283`
is the line and the folded fields, `#save-who` at `index.html:273`;
`src/style.css` styles them; `src/main.ts` holds the refs, the sync and the
"change" handler.

`3f33b68` **ui: send is one press**, five files, 124 insertions and 110
deletions. `src/core/flatState.ts:104-131` is `sendButton` and its
`SendButton` shape. `src/main.ts:1697-1700` reads it.
`src/core/savePlan.ts:63-68` is where `needsRuleConfirm` was.

`4103be7` **ui: sending writes nothing to your computer, and more holds three
things**, three files, 218 insertions and 233 deletions.
`src/main.ts:1811-1874` is `runSend`; `src/main.ts:1958-1997` are the three
More presses, and `src/main.ts:1584-1585` hides two of them outside the dev
build. `index.html:302-327` is the new More body; `src/style.css` styles it.

`f2257c9` **store: the store says who left**, three files, 45 insertions.
`src/session/store.ts:163-175` is `leftMessage`; `src/session/store.ts:467-471`
appends it. `docs/store.md:346-355` documents it.
`scripts/store-roundtrip.mjs:246-260` exercises it.

`630b77c` **ui: tests for 0036**, three files, 177 insertions.

`ceb58c9` **docs: PROJECT_STATE for run 0036**, one file, 90 insertions and 1
deletion.

## Findings

**The drawing did not survive a reload, and assumption 6 asked.** Nothing wrote
the project anywhere but a download. Measured on 6 September against
`netlify dev`, before any change: loading a flat through
`?project=tmp0036.json`, then navigating to the bare address, left
`localStorage` holding only `["reconfigure.session"]` and the flat's area
reading `—` where it had read `70`. A refresh, a closed tab or a crash cost the
work.

**The fix borrows the undo history's own string rather than adding a second
serialization.** The history already takes
`JSON.stringify(serializeProject(...))` on every mutating action.
`History.commit` at `src/core/history.ts:59` now returns that string, or `null`
when it took none, so the draft is written from what the history just took.
The app serializes once per action rather than twice, and the draft cannot
drift from what undo restores. An undo needed its own write, because `commit`
is deliberately a no-op while restoring; `restoreState` already holds the
string, so that costs nothing either (`src/main.ts:2349`).

**There is no `clearDraft`.** A resident who empties their grid writes an empty
draft like any other edit, and `readDraft` refuses to restore one with no rooms
in it, so the draft clears itself. Nothing in the app deliberately throws a
flat away: "Start over" at `src/main.ts:691-699` goes back to the landing and
leaves the drawing where it was.

**A URL naming a group is not a reason to refuse a draft.** `readDraft` at
`src/core/draft.ts:87` says no for three reasons: no store, a URL that already
names a `project`, or a draft with no rooms. A `session` in the URL names a
group, not a flat, so a resident following a group link still gets their own
drawing back.

**The design number drifted between the send and a saved copy.** Found live: a
flat was sent as "Unit 31" and then "Save a copy to my computer" wrote
`flat-32.json`. Opening More calls `openSaveDialog` to refresh the proposed
number, and the send had just taken 31, so the next free one was 32. Once a
flat has gone to the group it IS that number, so `openSaveDialog` now returns
early unless `sendState` is `never`. Re-measured: sent as Unit 32, copy saved
as `flat-32.json`.

**One boolean was not enough for the button, and neither were three rules.**
Run 0035 had `sendButtonLabel` and `staleNotice` as separate functions with
main.ts deciding the enabled state on its own. `sendButton` at
`src/core/flatState.ts:123` answers all three from the three facts at once, so
the button cannot say one thing and do another.

**The advisory dialog asked a question a resident could not answer.** It read
"Check Layout reports N MUST FIX issue(s) in this dwelling. The unit will be
written anyway (rules are advisory). Continue?" It appeared AFTER the press, it
covered the flat, and it named no issue. The button now says the same thing
before the press and the check chip in the bar is one press from the report
that lists them. `needsRuleConfirm` is deleted from `src/core/savePlan.ts` with
its four cases.

**`?replace=1` was already unnecessary for a resident's own flat.** The store
accepts a republish under the same name by `sameResident`
(`src/session/store.ts:371`), so replacing one's own earlier flat needed no
change at all: only the Replace tick and the takeover confirm had to go.

## Evidence

Everything below was executed. Nothing is estimated.

**Whether the drawing survived a reload, before and after.** Read from the DOM
and from `localStorage` in the browser pane, against `netlify dev`.

| moment | `#fig-area` | `localStorage` keys |
|---|---|---|
| a flat loaded, before the change | `70` | `["reconfigure.session"]` |
| after reloading, before the change | `—` | `["reconfigure.session"]` |
| a flat loaded, after the change | `70` | `["reconfigure.draft", "reconfigure.session"]`, the draft 3593 bytes |
| after reloading, after the change | `70`, 7 rooms | both |

After the reload the landing's primary door reads "Back to your flat" rather
than "Start a flat", and `#toast` reads "Your flat is as you left it.".

**Step 02 before and after, element by element.**

Before this run the panel held, in order: the headline "Send it to your
group."; a card with two open text fields labelled "Your group" and "Your
name"; the red button reading "Send it"; the run 0035 line under it; a line
reading "It becomes Flat N and Unit N, next free in the library and in
<code>"; the sentence "Your neighbours see it within seconds."; the result
lines; and a folded "More" holding a "Design number" number field, a "Colour"
picker, a fieldset legended "What to write" with four ticked checkboxes
("Project file", "Unit file", "Library entry", "Send to group") and a fifth,
unticked, "Replace".

After it, the panel holds: the same headline; one line reading "As Ana, to
hall-14." with a small "change" beside it, and the two fields folded behind it;
the red button; the run 0035 line under it; a line reading "It becomes Unit 32,
the next free number in the library and in hall-14"; "Your neighbours see it
within seconds."; the result lines; and a folded "More" holding "Colour", "Save
a copy to my computer" with the note "the whole design, the only thing that
reopens for editing", and in the dev build only "Add to the library" ("the unit
plus a picture, browsable under Units") and "Save the unit file" ("the contract
with the building").

The who line's four sentences, quoted in full: "As Ana, to hall-14." / "To
hall-14, but you have not said who you are." / "As Ana, but you have not joined
a group." / "You have not said who you are or which group."

Measured live: with both answers, `#save-who-change` is visible and
`#save-session-fields` is hidden; pressing "change" leaves the fields visible.
With a group and no name, the change control is hidden and the fields are
already open.

**The button rule, as a table.** `NO_WAY_IN` is "Place an entrance to send the
flat to the group." and `GROUP_HAS_OLDER` is "Your group still has this flat as
you sent it. Sending again replaces it."

| ready | sent yet | edited since | label | notice | awake |
|---|---|---|---|---|---|
| no | either | either | Send it | NO_WAY_IN | no |
| yes | no | no | Send it | none | yes |
| yes | no | no, n complaints | Send anyway · n things to look at | none | yes |
| yes | yes | no | Go to your group | none | yes |
| yes | yes | yes | Send it | GROUP_HAS_OLDER | yes |
| yes | yes | yes, n complaints | Send anyway · n things to look at | GROUP_HAS_OLDER | yes |

"thing" is singular at one and "things" otherwise. A count below zero or
fractional is floored and clamped, so a nonsense number cannot reach a label.
Every row is driven in `src/core/flatState.test.ts:138-196`.

**Proof that a send writes nothing to disk.** `URL.createObjectURL` was
replaced with a counting wrapper before the press and read after it. Both
downloads go through it, at `src/main.ts:1966` and `src/main.ts:1979`.

| press | object URLs created | what was written |
|---|---|---|
| the red button, sending | 0 | "Sent to hall-14 as Unit 32 · open Units to see your group." |
| "Save a copy to my computer" | 1 | `flat-32.json saved — 1 floor(s), 7507 bytes` |
| "Save the unit file" | 1 | `unit-32.json saved — 1 storey(s), 35332 bytes` |

What the same press used to trigger, in order, from the function it called:
one `window.confirm` when the check had complaints, then a project download,
then a unit download, then a library write, then the publish, with all four
selected by default. What it triggers now, from `runSend` at
`src/main.ts:1811`: `buildUnitExport`, `publishUnit`, `captureFlatPreview` and
`publishPreview`, and nothing else.
`src/chromeWiring.test.ts:90-118` pins that by reading the function's source and
asserting `downloadAs`, `createObjectURL`, `saveLibraryEntry` and
`window.confirm` are absent from it.

**The leave line, raw from the chat.** From the round trip against a live
store, session `rt-mtq1mh8g`:

```
  the line the store wrote: {"who":"","text":"Ben left the group.","at":"2026-09-06T16:45:55.852Z"}
```

The chat after it, whole:

```json
[{"who":"Ana","text":"shall we put the terrace on the south side?","at":"2026-09-06T16:45:51.095Z"},
 {"who":"Ben","text":"  yes, and keep the workshop  ","at":"2026-09-06T16:45:51.432Z"},
 {"who":"","text":"Ben left the group.","at":"2026-09-06T16:45:55.852Z"}]
```

Two people said two things and the store said one, so the chat holds three, and
the store's is the only message with an empty `who`. A message from a person
with an empty `who` is refused with `400`, which is what makes the empty one
readable as the store's own voice.
`node scripts/store-roundtrip.mjs http://localhost:8899` exits 0 with `all
checks passed`, at 70 checks, up from 64.

**Test counts.**

| suite | on `main` (`880b722`) | on `run/0036` |
|---|---|---|
| fast | 338 in 20 files | 374 in 21 files |
| slow | 58 passed, 1 expected fail, in 4 files | 58 passed, 1 expected fail, in 4 files |

The 36 new fast cases are 16 in the new `src/core/draft.test.ts`, 5 in
`src/session/session.test.ts`, 7 in `src/session/store.test.ts`, 11 in
`src/chromeWiring.test.ts`, and a net of 1 across
`src/core/flatState.test.ts` and `src/core/savePlan.test.ts`, where 4
`needsRuleConfirm` cases retired and the button rule's cases replaced the two
retired functions'.

**Both fixture baselines are unchanged at 12 and 7**, asserted inside the slow
suite, which passes.

**The three downloads are byte-identical.** `git diff --stat main HEAD` over
`src/core/saveFiles.ts`, `src/core/projectIO.ts`, `src/core/unitExport.ts`,
`src/library/naming.ts`, `docs/bridge-format.md` and `testflats/` returns
nothing at all, so every byte of a project file, a unit file and a library
entry is produced by unchanged code. The bytes a resident saves under More are
also the bytes that go to the group: `runSend` and the unit-file press each
call `buildUnitExport(floors, unitNameFor(n), saveColorInput.value)` with the
same two arguments.

**`npx tsc --noEmit` exits 0. `npm run build` succeeds in 10.09 s**, 84
modules, `dist/index.html` 25.09 kB, CSS 42.02 kB, JS 3428.99 kB.

## Artifacts produced

- `_cowork/outbox/0036-sending-is-one-press.report.md` — this file.
- `src/core/draft.ts` — new, 97 lines.
- `src/core/draft.test.ts` — new, 135 lines, 16 cases.
- `docs/store.md` — the leave line documented beside the leave call.
- `scripts/store-roundtrip.mjs` — 70 checks.
- `PROJECT_STATE.md` — new §17.
- `_cowork/CONTEXT.md` — one paragraph for run 0036, **Last updated** 2026-09-06.

## Skills read from disk

Two, from
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\f1d881be-0a13-45d3-acab-472cf2886dae\c2d4eab5-d7ca-4602-ba94-9758ddd63e18\skills\`.

`design-automation/SKILL.md`, 45081 bytes. Its section 2.1 on production rules
is the whole shape of the button: one rule stated once and read by every
consumer cannot be inconsistent, and a rule restated at each consumer
eventually is. That is why `sendButton` answers the label, the notice and the
awake state together rather than leaving main.ts to decide the third. Its
section 2.6 on conflict resolution, that a more specific rule overrides a
general one, is the order inside the function: the not-ready case answers
first and everything else is read only after it. Its section 1.4 on hard
against soft rules is why complaints never stop a send: they are soft, they
score rather than forbid, and the button says so in words instead of blocking.

Rejected from it: sections 3 to 7, constraint satisfaction, space planning,
layout generation, drawing automation and code compliance. This run placed no
rooms and changed no rule in `src/core/rules.ts`.

`explain-code/SKILL.md`, 2515 bytes. It is a skill about explaining code to a
reader, and the prompt asked for it on `runSave` before touching it, which is a
fair use of it: its section 3 says to walk each step and give the WHY as well as
the WHAT. Doing that on `runSave` is what produced the finding that its five
steps were not five equals. The confirm gated three of the four outputs but not
the project file, and the project file was written first precisely so a
declined confirm cost only the unit-derived outputs, which is a design decision
recorded in the function's own header. Reading for the why is what made it safe
to remove the confirm without disturbing that ordering: the ordering existed to
protect against the confirm, so removing the confirm removed the reason for it.
Its section 4, end on a gotcha, matched what the run then hit live: the design
number is proposed asynchronously and moves when the group's contents change,
which is exactly the drift between "Unit 31" and `flat-32.json`.

Rejected from it: sections 1 and 2, the analogy and the ASCII diagram. They are
for explaining code to a person who is learning, and nothing in this run's
output is addressed to such a reader; a diagram of `runSave` in a commit
message would be decoration.

## The Assumptions, checked

**Assumption 1 holds.** `runSave` did the five things in that order: the
advisory confirm, the project download, the unit download, the library entry,
the publish. The confirm sat after the unit was built, because it only asked
when a unit was actually being written. The controls were `#save-what-project`,
`#save-what-unit`, `#save-what-library`, `#save-what-publish`, `#save-number`,
`#save-color` and `#save-replace`, all under `#more-card`.

**Assumption 2 holds.** The group code and the name are in `localStorage` under
`reconfigure.session`, and step 02 showed them again as `#save-session` and
`#save-resident`, open.

**Assumption 3 holds and is now out of date in form.** `sendState` was
`never | sent | edited` and `sendButtonLabel` and `staleNotice` read it. Both
are replaced by `sendButton`, which reads the same value plus two more facts.

**Assumption 4 holds.** The store refuses another name's flat without
`?replace=1` and accepts a republish by the same person through `sameResident`.

**Assumption 5 holds.** The library write and the library's delete and rename
are `import.meta.env.DEV` only. The two new More presses that depend on that
endpoint are hidden the same way, at `src/main.ts:1584-1585`.

**Assumption 6 was the question, and the answer is no.** The drawing did not
survive a reload. The measurement is under **Evidence**.

**Assumption 7 holds.** Leaving is `DELETE .../residents/{name}` and messages
are append-only `{ who, text, at }`.

**My own assumptions, and what each costs if it is wrong.**

*That a draft should not survive into a `?project=` link.* A URL naming a
particular flat wins over whatever was drawn last, because following a link to
a flat is a request for that flat. If a resident should be warned rather than
overridden, the check is one line at `src/core/draft.ts:89`.

*That the draft is per browser and not per group.* One key, one flat. A
resident who works on two flats in two groups from one browser has one draft
and the second overwrites the first. Keying it by group code would fix that and
would mean deciding what happens to a draft when somebody changes group, which
is more than this run was asked for.

*That the design number should freeze once a flat is sent.* It follows from the
flat being that number in the group. If a resident should be able to send the
same drawing again as a NEW number, that is a different feature and the freeze
is what would have to go.

*That "N things to look at" counts hard violations only.* It is the same count
the check chip shows, taken from the same place at
`src/main.ts:1279`, so the two cannot disagree. Counting soft ones as well would make the button's number
differ from the chip's.

*That the result lines belong under More.* They moved with the writing they
report on, and the send's own line stayed beside the button as `#send-results`.
A resident who never opens More still sees what their send did.

## Decisions and rationale

**The draft is the history's own string.** The alternative was a second
`serializeProject` call per action. Borrowing the snapshot costs one changed
return type and guarantees the draft and undo agree.

**`whoLine` says which half is missing rather than a single generic sentence.**
"You have not joined a group" and "you have not said who you are" send a
resident to different fields, and the fields are open in both cases.

**The button is `disabled` rather than `aria-disabled` here.** Step 01's
forward button uses `aria-disabled` so a press can answer, which run 0034
found live. On step 02 the reason is already on the screen, in the notice line
directly under the button, so a press has nothing to add.

**The advisory count never blocks.** The rules are advisory by design, the
building will take the flat either way, and a resident who cannot send is a
resident who cannot take part.

## Deviations from the prompt

**Tasks 4 and 5 share one commit, `4103be7`.** Task 4 removes the only caller
of the file-writing code and task 5 gives it new callers. Under this project's
`noUnusedLocals`, task 4 alone does not compile: `runSave`, `saveLibraryEntry`,
`projectFileText`, `projectFileName` and `unitFileName` all become unreachable.
Splitting them would have meant deleting those in one commit and restoring them
in the next, which describes two states that never existed. The commit message
carries both descriptions.

**One thing outside the eight tasks: the design number freeze.** It was found
while verifying task 5 and is described under **Findings**. Leaving it would
have shipped a resident a copy of their flat under a different name from the
one their neighbours see.

**`_cowork/CONTEXT.md` was updated although the repo's shape did not change.**
Task 8 asked for it by name. The paragraph says plainly that nothing structural
moved.

## Blocked / did not do

**The "Send anyway · N things to look at" label was not seen live.** Every
combination is driven in `src/core/flatState.test.ts`, and the count comes from
the same variable the check chip prints, but producing a flat that is buildable
AND breaks a hard rule takes drawing one by hand and this run did not. The
label's text is therefore evidenced by the test and by the chip sharing the
count, not by a screenshot.

**A second dev server is still running on port 8899**, with Vite on 5199,
started in run 0035 because the one on 8888 was not mine to restart. It should
be stopped by whoever finishes with this working tree.

**The live checks left groups in the local Blobs store**: `hall-14`, holding
"Unit 31" and "Unit 32" published by "Ana", and one `rt-…` group per
round-trip run. None of them is in the repository.

## Open questions for you

1. **Should the draft be per group rather than per browser?** One key holds one
   flat. A resident who is in two groups, or who wants to keep a second idea
   alongside the first, has one draft and the newer one overwrites the older.
   The fix is small, keying the draft by group code, but it raises a question
   this run cannot answer: when somebody changes group, does their drawing
   follow them or stay with the group they left? That is the same question run
   0035's leave asked from the other side, and answering both the same way
   would be worth doing deliberately.

2. **What should a resident be able to do about a flat they have already
   sent, other than send it again?** The button becomes "Go to your group" and
   the number freezes, which is right for revising. There is no way to withdraw
   a flat from this screen, though the store has had one since run 0035. A
   resident who wants out has to leave the group entirely, which also takes
   their profile. Whether "take my flat back but stay" is a thing a resident
   should be able to do is a question about how a group is meant to behave.

3. **Does "N things to look at" say enough on its own?** The count is on the
   button and the list is behind the check chip in the bar, which is a
   different corner of the screen in a different step. A resident who reads the
   button and presses it has sent a flat with faults they never saw. Putting
   the first fault's own words under the button would say more, at the cost of
   a longer panel and of implying the first fault matters most, which the rules
   do not claim.

## Suggested next prompt

**The building app's own send, and what it does with a flat that left.** This
app now sends in one press, keeps the drawing across a reload, and the store
writes a line when somebody leaves. The next prompt should be run in
`bottom-up-design` and should do three things. Read the leave line: its chat
view must render a message with an empty `who` as the store's own voice, in the
app's own quiet grey rather than as an anonymous person. Answer run 0035's open
question 3, which this run did not touch: when a flat leaves a group, every
other resident's `counts` may still ask for it, and the building app is where
"want nothing" or "the vote must be re-cast" gets decided; it should say which
it chose and show what a resident sees. And it should report whether its own
screens still ask a resident for anything the store already knows, in the way
step 02 was asking again for a name and a group here, since the same rule of
Shrey's applies on that side: remove or automate anything that does not
specifically need the resident.
