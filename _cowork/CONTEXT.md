# Repo context for the planning session

## Read this first

You are the planning session. Before writing any prompt, read
`.claude/bridge/PROTOCOL.md` — it holds the numbering rule, the slug rule, the
prompt front-matter schema. There is no mode field and no read-only fallback: what a
run may touch is set in the desktop app at the moment it runs. A prompt that must
leave something alone says so in its own Constraints section.

Prompts go in `_cowork/inbox/`. Reports come back in `_cowork/outbox/`. The running
index is `_cowork/LOG.md`; past prompts are in `_cowork/done/`.

## How I want you to work

**Never write a prompt file without showing it to me first.** When I ask you to
queue something, draft the full prompt — front matter and all — and show it in the
chat. Then stop and wait. I will either edit it or tell you to send it. Only when I
say send do you write the file into `_cowork/inbox/`.

Writing straight to the inbox is the one thing that would break this workflow: I run
these against my thesis repo, and I want to read a prompt before it exists as a
queued instruction.

When I say send, write the file and confirm with one line: the path and the id.
Nothing else.

**Absolute path:** recorded in `_cowork/CONTEXT.local.md`, which git ignores, so a fresh clone has to write that file by hand.
**Branch:** the working tree is on `main`, and everything is merged. Runs 0018,
0019, 0020 and 0021 were each built on their own `run/NNNN` branch and merged
into `main`; every branch record still exists on the remote with all of its
commits already in `main`'s history. `main` holds
both the "Paper studio" reskin from runs 0016/0017 (paper ground and ink
rules, a 52px top bar with a MODEL / PLAN / DIAGRAM segmented control, a
resizable PLACE / FLOORS / BRIEF palette, three viewport overlay clusters,
the layout check as a 256px bottom sheet — PROJECT_STATE §2s) and run 0018's
unit library: `public/units/` (dwelling-unit JSON + JPEG preview per unit
under a validated `index.json` manifest), `src/library/` (self-contained
browser module + manifest/id logic, documented in `docs/library-format.md`),
a Units top-bar button, and a Save to library action in the export dialog
backed by a dev-only Vite endpoint. PROJECT_STATE §10 describes it.

Run 0019 (on `run/0019`) then collapsed saving into ONE dialog. Save / Open
now holds just `Save…` and `Open project`; the separate Export project, Export
unit and Save to library actions are gone. The dialog takes a DESIGN NUMBER
and three checkboxes, writing `Flat n` (project file), `Unit n` (unit file)
and the library entry in any combination, reporting one result line per output
inside itself. Names follow Shrey's convention, a capitalised word and a
number, one number per design across both kinds, and the dialog opens on the
next free number read from the library manifest. Library entries can now be
replaced instead of silently duplicated, and renamed from their card.
PROJECT_STATE §11 describes it.

Run 0020 replaced the stairs and added bathrooms. The old 0.6 m-wide stair is
retired from the palette, kept in `MODULE_DEFS` so pre-0020 files still load.
Five palette entries now: straight 2×8, dogleg 3×6 (the default, 1.8 m tight),
dogleg generous 4×6, spiral 4×4, C of three flights 4×6. All proportions derive
from the storey height in `src/core/stairSpec.ts` (pure, tested), at riser
target 170 mm and tread 270 mm, and stairs are BUILT at the floor's true height
rather than scaled; each flight is a raking slab with a soffit. Three new wet
rooms: `wc` 2×3, `bathroom_full` 4×4, `bathroom_full_compact` 3×4. An inactive
floor renders TRANSLUCENT rather than flat grey, its furniture is hidden, and
the shadow-catcher ground plane no longer writes depth, which was making lower
storeys blink out as the camera orbited. PROJECT_STATE §2a and §2t.
**The storey height is derived, not configured**: (tallest room, min 4 cells,
+ 1 clearance cell) × 0.6 m, so 3.0 m by default.

Run 0021 added DOUBLE-HEIGHT ROOMS. A placed room can be marked to take the
volume of the storey above its own footprint: the mark lives on the room below,
the footprint becomes a hole on the floor above through the same
`FloorManager.voidCells` list stairwells use, the walls rise through both
storeys, marking CREATES the storey above when there is none, and it is REFUSED
with the obstructing cells named when something is already up there. The
derived storey height is deliberately unchanged. The control is a tool in
Structure & Access beside Entrance and Doorway. It crosses the bridge as
`storeys[i].openCeilings`, a per-cell list of the seams that carry no floor,
additive and still v1 (`docs/bridge-format.md`). PROJECT_STATE §2u. A sample
export for the building repo is committed at
`_cowork/outbox/0021-double-height-unit.json`.

**The Netlify site is `reconfigure-flat`**, so
a branch deploy is `https://run-NNNN--reconfigure-flat.netlify.app`; it is
password-protected, so an unauthenticated check gets 401 rather than 200, and
404 means the build has not finished.
Run 0022 built THE SESSION STORE and nothing visible: a Netlify Function at
`netlify/functions/session.mts` whose whole handler is `src/session/store.ts`,
routed under `/api/session/{code}` (whole session as summaries, one flat
verbatim, publish a flat, a resident's counts/share/ballot with partial merge,
the last building run whose write clears `changed`), backed by Netlify Blobs
(store `sessions`, one index blob per session plus one blob per flat, index
writes under the blob's ETag). `@netlify/blobs` is the one new dependency;
`tsconfig.json` now includes `netlify/`. `scripts/store-roundtrip.mjs
<base-url>` proves it from the shell (22 checks) and passed against `npx
netlify dev --port 8888`. `docs/store.md` is the contract. PROJECT_STATE §12.
**The deployed store is unreachable while the site password is on**: the
`reconfigure-flat` gate answers 401 to `/api/session/*` and even to an OPTIONS
preflight, so run 0023 and the building side cannot call it until that changes.

Run 0023 CONNECTED THE APP TO THE STORE. The save dialog has two fields at the
top, resident name and session code (localStorage key `reconfigure.session`,
`?session=room-42` in the URL wins and is stored, codes lowercased), a top-bar
line shows the session, and a fourth checkbox, Publish to session, PUTs the
unit download's exact bytes to `/api/session/<code>/flats/unit-<n>` on the same
origin and reports "Published as Unit 6 to room-42, version 2". A failed
publish never cancels a file. The Units panel lists the session's flats in a
group ABOVE the library (resident, version, storeys, area, a changed mark),
each openable as a copy. `GET /api/session/<code>/export` returns the state
plus every flat body as a string. **The site password is off since 2 September
2026** and the deployed round trip passes 26/26. PROJECT_STATE §10, §11, §12.
Dev needs `netlify dev` (port 8888) for the store; plain `vite` has no function.

Run 0024 fixed the DESIGN NUMBER for a room and gave every flat ONE PICTURE.
With a session set, the save dialog proposes the lowest number free in BOTH
the library manifest and the session's own flats (nextFreeNumber now takes
any number of lists), so two residents in the same room are no longer both
offered the same number. Publishing over a flat another resident owns now
answers 409 with their name; the dialog shows it on the Session result line
and offers a Replace checkbox, off by default, that sends ?replace=1. Every
flat, published or saved to the library, gets the SAME axonometric
(captureFlatPreview in main.ts, framed by the pure axoFrame in
src/core/previewFrame.ts): every floor visible and un-dimmed, cutaway and
the view overlays off, a fixed 800x600, camera and view state restored
exactly after. GET/PUT /api/session/{code}/flats/{id}/preview carries the
JPEG; a flat's summary gains preview: true. The picture travels as a
SIBLING of the flat's own storage key, never a child of it — the first key
shape hung every write under netlify dev, since Netlify Blobs' local
sandbox maps keys onto a real filesystem path and the flat's key was
already a file where the child shape needed it to be a directory. All
seven committed library JPEGs were re-rendered through the same function.
PROJECT_STATE §10, §11, §12.

Run 0025 answered whose flat is whose and made a takeover ask first. Every
session card shows its owner on its own line, at normal card size; a match
with the save dialog's own name gets a filled Yours badge and a heavier
border, and the group sorts that resident's own flats first (isMine,
sortMineFirst, pure, in src/library/unitBrowser.ts, since the project has
no DOM test environment to exercise the module's DOM-building code).
Replace no longer sends replace=1 on the first attempt: only a 409 with
Replace ticked raises a confirm naming the current owner
(takeoverConfirmText), and decideTakeover (session.ts) turns the answer
into a retry, a skipped result line, or no change, pulled out pure so the
decision is testable without driving window.confirm. A small UX pass
against _cowork/ux-guidelines.md folded the session fields into one line
once both are set, grouped the five checkboxes as Files and Session, and
added a next-step hint to a successful publish's result line; one CSS bug
(a `display` rule tying and beating the default `[hidden]` rule) was found
and fixed in the process. PROJECT_STATE §10, §11.

Run 0026 put the flat app in the brief's skin
(`_cowork/design/DESIGN-BRIEF-3sep.md`, from the wireframe Shrey approved 3
September, `_cowork/design/wireframe/`) and did two small fixes from run
0025's own open questions: the store's building run carries an opaque
`plot` object now (genome/summary's own treatment — stored, never read),
and resident names compare trimmed and case-insensitive everywhere two
meet (`sameResident`, store.ts; restated, not imported, in unitBrowser.ts's
`isMine`, which stays self-contained on purpose). The big piece: the save
dialog is gone. `#save-column`, always visible over the viewport's right
edge (absolutely positioned, like the Units panel — no resize/camera code
touched), holds three cards in the brief's order — "Your flat" (name,
LIVE area/storeys/glazing numbers and a check line, all read off
`buildUnitExport` the same way a save itself would, refreshed on every
`commitHistory`), "Your group" (the existing fold, one red "Send it to
your group" button — the SAME `runSave`/`savePlan.ts` under a new label),
and a folded "More" holding the design number, colour and five checkboxes
that used to be the whole dialog. Every word a resident reads now says
"group", never "session" or "room" (the code — `SessionSettings`,
`?session=`, `/api/session/…` — keeps its names). New tokens/fonts/grain
across `style.css` (Big Shoulders Display, Jost, JetBrains Mono, one Google
Fonts link; `--accent` #d6341c, `--bg` #ece6d8, plus `--blue`/`--yellow`/
`--dim`/`--card`), a `.card` look (3px ink rule on top, nothing else) and
`.chip` pill used by the save column and restated by the Units panel,
whose "Yours" badge is red now, not ink, and whose cards animate in.
PROJECT_STATE §2, §10, §11, §12, new §13.

Run 0027 gave the flat app a landing screen and split the editor into the
two steps the bar already named. The landing (built to
`_cowork/design/wireframe/Landing.dc.html`) carries the headline, three
doors and the six-step journey; it covers the editor rather than replacing
it, and it is skipped when the URL already names a project or a group. Join
a group asks for a code and a name inline and writes them through the same
`writeSession` the send panel uses. Go to your group links to
`BUILDING_APP_URL` (one constant in main.ts) carrying `?session=<code>`,
which is the only handoff a resident drives between the two apps. The
editor is now one panel at a time: step 01 has the palette, the drawing and
the flat's three numbers plus its check chip as a strip in the top bar,
with no right-hand panel at all; step 02 has no palette, the flat framed
whole with its figures beneath it, and the send panel at the right. Step 02
stays shut until the flat has a way in and says why when pressed. Before
anything is placed the numbers read dashes, the name reads "Untitled", the
check line is a hint rather than a fault and one ghost tile sits on the
grid. Two new pure modules carry the rules and the model:
`src/core/flatState.ts` (the phase every part of the chrome reads, and the
landing's skip decision) and `src/core/journey.ts` (the six steps, exported
for the building app to render too). The redundancy cull: Save / Open is
now Open, Check Layout moved into the check chip, Frame View joined the
view cluster in the corner, and the panel's Save toggle is a chevron.
Nothing was deleted. PROJECT_STATE §2, §11, new §14.

Run 0034 handed the resident onward and gave the landing an order to
arrive in. Step 01 now ends with one button at the bottom centre of the
viewport reading "Send it to your group", asleep with one sentence while the
flat has no way in and waking on the same `canSend` call that wakes step 02
in the bar; `syncStepTabs` in main.ts makes that call once and hands the
answer to both, and `src/chromeWiring.test.ts` pins that shape because this
project has no jsdom. Step 02's one red button now has two moments: it is
the send button until a publish succeeds, then it reads "Go to your group"
and opens the building app on this resident's group, and any edit to the
flat puts it back. The journey strip dropped done/ahead for three tones that
say which app owns a step, so this app's two dots are ink, the building
app's four are dim and the current one is red; `journeyTones(currentId,
thisApp)` in `src/core/journey.ts` serves both apps and replaced
`journeyMarks`. The landing arrives in CSS on a fixed clock: a second of
nothing, the two discs out of their own corners over 600 ms, the headline
line by line at 1600, 1750 and 1900 ms, the paragraph at 2200, the doors at
2500 to 2900 and the strip at 3200, each lasting 300 ms; every keyframe has
a `from` and no `to`, so nothing is missing if the animation never runs.
Nothing about the repo's shape changed: no new directory, no new entry
point, no new dependency and no new run step. PROJECT_STATE §14.

Run 0035 gave the store two calls it did not have and renamed the whole
library. A person can now leave a group, and their flats leave with them:
`DELETE /api/session/{code}/residents/{name}` removes the row and every flat
that person owns, each flat's picture with it. A person can rename and keep
their flat: `POST .../residents/{name}/rename` moves the row and retags the
flats in one write, so nobody is at the table twice while the building app
polls. Both refuse by the same one ownership rule the publish check has used
since run 0026. `OPTIONS` now names DELETE, without which a browser never
sends the call at all. The library counts from one: every entry reads Flat 1
to Flat 30, in the manifest and in each file, while ids and filenames stay
exactly as they were because the live store links by id. The descriptors are
gone, since a manifest row has nowhere to put a second line; every old name is
in the run's report. Step 02 now says when the group is looking at an older
flat than the one on the screen. The store contract changed only by those two
calls and the CORS line; no new directory, no new entry point, no new
dependency and no new run step. PROJECT_STATE new §16, and docs/store.md is
still the contract's source of truth.

Run 0036 cut sending down to one press. Pressing the red button used to
download a project file, download a unit file, write a library entry and
publish, with all four ticked by default and a browser dialog before them if
the layout check had anything to say. It now publishes and does nothing else,
and the dialog is gone: the button itself reads "Send anyway · N things to look
at" before the press. What a resident may still want written lives folded under
More as three named presses, two of them dev-only, alongside the colour; the
design number left the screen and is chosen automatically. Step 02 no longer
asks again who is sending and where to, showing "As Ana, to hall-14." with a
"change" instead. The flat is now kept in the browser as a resident draws and
restored on load, which it was not before: a refresh used to cost the drawing.
And the store writes one line into a group's chat when somebody leaves, with an
empty `who` so its own voice is distinguishable from a person's. No new
directory, no new entry point, no new dependency and no new run step; the store
contract changed only by that line. PROJECT_STATE new §17.

Run 0037 made the landing ONE FILE that both repositories render. The two had
drifted: put side by side on 7 September the doors sat at the far right edge in
one app and in the middle in the other, the columns were different widths, and
the flat app had a brand and a red rule the other lacked. There is now a
`landing/` folder in the Context directory beside the brief, holding
`landing.html` and `landing.css`, and each app carries a byte-for-byte copy and
a test that hashes it against a LANDING FINGERPRINT line in the brief. One
attribute on the root, `data-app="flat"` or `"building"`, picks the doors and
the six dots' tones, and nothing else about the landing may differ. To change
the landing you change the Context copy, copy it into each app, and update that
line. This app now inlines the fragment at build time instead of carrying the
markup in index.html and 9046 bytes of rules in style.css. That is a new shared
directory outside either repository, which is the first thing the two apps have
in common besides docs/store.md. PROJECT_STATE new §18.

Run 0038 added a command that fills a group.
`node scripts/fill-group.mjs <store> <code>` publishes the library's twenty
designed flats under twenty different resident names, each with its picture and
that resident's square-metre figure, ballot and three wishes, and says three
things in the chat. It writes only through the store's public calls, so a group
it filled cannot be told from one twenty people filled, and the twenty are a
fixed table so two runs give the same room. It refuses a group that already
holds flats unless `--replace` is given. That is how the whole journey gets
walked: fill a code, then join it from the landing as the twenty-first. The run
also put the layout check's faults under step 02's button, one line each in the
rules' own words, where before the button carried only their number and the
lines were behind the check chip in another corner. That is a new run step and
a new script; nothing else about the repo's shape changed. PROJECT_STATE new
§19.

Run 0039 gave the store the vote. It held one building, no rounds and no votes;
it now holds rounds of pairs and one vote per person per pair. `PUT
/api/session/{code}/round` opens a round, whose number must be one more than
the last and which is refused while another is open, both checks inside the
same write so two clients racing cannot both win. `POST
.../rounds/{n}/votes` casts a vote, refusing anyone the store does not read as
being in the group, which it works out from its own index: somebody who joined
or who owns a flat. The store closes a round itself in the same write that
records its last expected vote. Five reasons, copied word for word from the
brief, are the only ones it accepts. The polled state gains `round` and
`lastRound`; only `/export` carries the history. The store contract changed by
those three calls and nothing else, and `building` keeps its shape. The
building app's run 0063 builds the screens on top. PROJECT_STATE new §20.

Run 0040 added two small things. The landing gained a written way out: one
line under the doors, "Start again with a new flat.", shown only when this
browser remembers something worth starting again from, asking once and then
clearing the flat and the name it holds while the flat already sent stays in
the group. `?fresh` in the address does the same with no question, for the
operator. One function in src/core/draft.ts decides what "forget this browser"
clears, and the line, the address and the tests all call it. The line is this
app's own element placed inside the shared landing fragment's doors column, so
the shared files and their fingerprint are untouched. And the store now keeps a
vote somebody changed: `replaced` on the round holds every superseded vote with
its own time, while `votes` keeps its meaning and shape so anything counting
from it sees no change. Nothing about the repo's shape moved: no new directory,
entry point, dependency or run step. PROJECT_STATE new §21.

Run 0041 added the second half of the fill command.
`node scripts/vote-group.mjs <store> <code>` reads whichever round is open and
has the same twenty cast one vote per person per pair, so a walked vote has a
real count instead of "1 of 1". It writes through the store's public calls
only. The pick comes from one pure rule over the fixed table: a pair names one
dial, and a person whose top two cares include that dial picks the challenger
and ticks it, otherwise they keep the building they had and tick their own
first care. Over the twenty that splits every pair 8 to 12, and which eight it
is changes with the dial. The table gained a `cares` column for it, because a
ballot ranks the five kinds of shared space while a pair's dial is one of the
five reasons, so a ballot cannot answer the rule's question. Four named people
change their mind once on the first pair, so a round of five pairs ends with
104 votes cast, 100 current and 4 in run 0040's `replaced`. That is one new run
step and one new script; nothing else about the repo's shape changed.
PROJECT_STATE new §22.

Run 0042 rewrote every word a person reads in this app. They were spread over
nine files and written run by run over three months, and they did not sound
like one app. They are now in one file, `src/core/words.ts`, as named constants
and small pure functions, measured against the brief's "How the app talks" and
`_cowork/design/WRITING-GUIDE.md`, which is in this repository at that path.
`docs/words.md` lists every string with what it said and what it says, grouped
by screen. `src/core/words.test.ts` reads all of them and fails on seven of the
guide's tells, so a string added later by a session that has not read the guide
fails on the way in. No layout, no logic, no thresholds. The 42 rules keep their
checks and take their advisory lines from the same file. One thing is left and
named: the twenty room names carry em dashes and cannot change while
`src/core/unitExport.ts` writes them into the unit file. That is one new module
and one new document; nothing else about the repo's shape changed.
PROJECT_STATE new §23.

Run 0043 did three small things from runs 0041 and 0042's questions. The library
entry saved from the app on 8 September read "Unit 31" and now reads "Flat 31";
the path that let it through is closed by naming a library entry and filing it
separately, `Flat N` to read and `unit-N` to file, because deriving the id from
the name made the two rules unsatisfiable. Every screen now shows a plain room
name, "Small bedroom" for the stored "Bedroom — Small", through one table in
`src/core/words.ts` that no file ever reads; the stored names cannot change
because they travel into every flat file's `roomTypes`, which the building app
reads. `_cowork/design/room-names.md` holds the same table for the building app
to copy, and that app has not had it yet. A group filled by
`scripts/fill-group.mjs` now says so in its last message, under the name "The
app" rather than in the store's own voice, because `POST /messages` refuses an
empty `who`. Nothing about the repo's shape changed. PROJECT_STATE new §24.

Run 0044 made the walked vote settle and wrote the line-ending convention
down. `scripts/vote-group.mjs` gave 8 of 20 for the challenger on every pair of
every round, so four rounds decided nothing; the pick rule takes the round now.
Round 1 is what people want and still splits 8 to 12, and from round 2 whoever
wanted the challenger comes across, six times in ten in round 2 and nine in
round 3. One draw per person per dial, seeded by the group code and held for
the whole vote, so a settled group stays settled and the same group votes the
same way every time. Walked live: 12/8 in round 1, 14 to 18 of 20 in round 2,
18 to 20 in round 3.

A `.gitattributes` now says `* text=auto eol=crlf`, which is what
`git ls-files --eol` already showed, so no file moved. It matters because the
convention stopped depending on each clone's `core.autocrlf`. The line-ending
damage runs 0042 and 0043 reported was NOT what those runs said: no blob in
this repository has ever held CRLF. Their edit scripts converted newlines in
text that already carried CRLF, so each line ended CR CR LF and the blob came
out with a stray CR per line. Join lines with the ending a file already has;
never convert twice. PROJECT_STATE.md also held one NUL byte from run 0042,
which is why git read it as binary, and that is out. PROJECT_STATE new §25.

Run 0045 made the walked vote choose a NEW building. Run 0044's vote settled on
the building it started with every time, because every challenger took 8 of 20
on every dial and never won a pair. The `cares` column is rebalanced so shared
space is a top-two care for twelve of the twenty and each other reason for
seven, so round 1 gives the shared-space challenger 12 of 20 and it wins its
pair. Twelve and eight was asked for and does not exist: twenty people have
forty top-two places and 12+8+8+8+8 is forty-four. The following rule had to
learn who won, because run 0044 assumed the loser was always the challenger;
`roundOneWinner` counts round 1 from the table and the losing side follows
whichever side won. The four who change their mind now do it in round 1 only.
Walked live: the group settles on the shared-space challenger, 12 of 20 in
round 1, 19 in round 2 and 20 in round 3, on a genome that differs from the one
it started with. Nothing outside `scripts/` changed. PROJECT_STATE new §26.

**Last updated:** 2026-09-09

## What this project is

A browser-based 3D flat configurator, built with TypeScript + three.js and bundled
with Vite. The user places modular rooms, furniture and stairs on a 0.6 m grid
across multiple floors, authors entrances and interior doors, and gets an advisory
layout-rules check plus a bubble diagram of room adjacency. It is a thesis
instrument, not a product: it exists to author single dwellings that a second repo
then aggregates into buildings. Work in progress and openly messy in places — the
rules engine and the export format are the mature parts, the UI is not.

## Layout

- `src/core/` — the model and all logic: grid and occupancy, room-type presets,
  floors, doors, entrances, the adjacency graph, the rules engine, window generation,
  save/load, and the flat export. It does import three.js; see Non-obvious things.
- `src/scene/` — three.js geometry builders: room shells, walls and glazing, stairs,
  door and entrance markers, the camera-aware cutaway, voxel furniture.
- `src/interaction/` — pointer and keyboard controllers: palette drag-drop,
  selection and group ops, door and entrance placement, raycast picking.
- `src/ui/` — DOM panels: palette, validation report, bubble diagram, compass dial,
  toasts.
- `docs/` — the flat→building JSON spec, the rules reference (HTML only since run
  0013), and the analysis behind the two-repo split. The built PDFs were removed from
  the repo in commit 6d214ad and live on the Drive; `docs/build-pdf.py` regenerates
  them from the HTML on demand and `.gitignore` now keeps them from coming back.
- `dist/`, `node_modules/` — build output and dependencies, both gitignored.
- `.claude/` — dev-server launch configs, and this bridge. **Gitignored** (see
  Non-obvious things).
- `testflats/` — three example project files (`flat-configurator-project` v1) added in
  run 0009: `flat-1-two-storey.json` (2 floors, a corridor against a balcony on the
  upper one), `flat-2-single-storey.json`, `flat-3-terrace.json`. Open one with IMPORT
  to get a finished layout instead of an empty grid. In DEV, `?project=<name>` loads one
  straight from the URL (a bare name resolves against `testflats/`), so a run can set up
  any layout it wants without a human. Run 0009 reported the opposite; the cause was
  `importProjectText`'s unconditional `window.confirm`, which run 0010 made conditional
  on there being something to replace.
- `captures/` — rendered PNGs of views, written by the app itself through the dev
  server (see How to work with it). New in run 0013 and untracked, so it never shows
  up in a clone; the first capture creates it.
- `design/` — the Re_Configure design system as standalone HTML pages (tokens,
  motion, buttons, toggles, palette, toast, validation, and the interface-dissolve
  moment). `.design-sync/` beside it holds the config and conventions the sync runs
  against. Both are SOURCE and both are committed; `ds-bundle/` is generated from
  them and is gitignored. Added by A0001, committed in run 0015. This is where the
  values in `src/style.css`'s new `--ink` / `--dur-*` / `--ease-*` tokens come from.
- `netlify/functions/` — the one Netlify Function, `session.mts`, the entry of
  the session store (run 0022). Netlify finds the folder by default; there is
  still no `netlify.toml`. `.netlify/` (created by `netlify dev`) is gitignored.
- `scripts/` — shell-run scripts. `store-roundtrip.mjs` drives the session store
  against a base URL and exits 1 on any failed check. `fill-group.mjs` (run
  0038) fills a group with twenty residents and `vote-group.mjs` (run 0041) has
  them vote on the open round, both over the fixed table in
  `fillGroupTable.mjs`, which `fillGroupTable.test.ts` checks in the fast suite
  without running either. `gen-flat.mjs` plus
  `flatLayout.ts` are the flat generator added in run 0028: they take a bubble
  diagram from `scripts/flats/*.flat.json` and write a `dwelling-unit` file,
  then load it through a real FloorManager and run the app's own `validate()`,
  exiting non-zero on any must-fix. It needs no runner dependency because it
  boots the project's own Vite in middleware mode to reach `src/`. Output goes
  to `build/`, which is gitignored; a flat enters the library by a deliberate
  copy. `scripts/flats/` holds twenty diagrams as of run 0029. See
  PROJECT_STATE §15.
- `_cowork/` — the bridge traffic. Tracked in git on purpose.
- `_cowork/design/` — the approved 3 September design brief
  (`DESIGN-BRIEF-3sep.md`) and its wireframe (`wireframe/`, seven `.dc.html`
  screens plus `generate.py`), the source both `Re_Configure` apps' skins
  read from (run 0026 applied it to this one). Added ahead of run 0026,
  tracked like the rest of `_cowork/`.

## Entry points

- `index.html` — the page itself; the app is a single canvas plus DOM panels.
- `src/main.ts` — wires the whole app together. Start here to trace anything.
- `PROJECT_STATE.md` — the real orientation document, ~2500 lines, section-numbered
  and kept current. Far more accurate than the README. Read this before assuming
  anything about how a system works.
- `README.md` — feature overview and the full layout-rules tables.
- `src/core/rules.ts` — every layout rule, as data in a `RULES` array.
- `docs/bridge-format.md` — the `dwelling-unit` JSON contract with the other repo.

## How to work with it

- **`npm run dev` starts Netlify's dev server on port 8888 as of run 0033**, which
  serves the app AND the session store. That is the address to open and the one
  the building app's Store field must point at. `npm run dev:vite` is plain Vite
  on 5173 with no store, for working on the editor alone; a call to
  `/api/session/...` there falls through to the SPA fallback, and the app now
  says so in a sentence rather than printing the parser's complaint.
  `netlify-cli` is a pinned dev dependency (27.5.0) so nothing is installed by
  hand, and `netlify.toml` pins the command, the port and both directories.
  `npm run build` runs `tsc && vite build` and is unaffected.
- **Node is on PATH on the current machine** (macOS, `/usr/local/bin/node`,
  v24.19.0 as of run 0019) and `npm`/`npx` resolve without help. The earlier
  note here described a Windows machine where node lived at
  `C:\Program Files\nodejs` and had to be prepended, which `.claude/dev.cmd`
  worked around; that is history unless the repo moves back to that machine.
- **There are TWO test suites as of run 0014.** `npm test` is the fast one, under
  a second over 298 cases in eighteen files as of run 0033 (eleven in
  `session.test.ts` for the store-absent rule, less three retired with
  `groupIsStarted`); 290 in eighteen as of run 0032 (nine in
  `store.test.ts` for starting a group and `exists`, six in `session.test.ts` for
  the code generator and the join refusal); 275 in eighteen as of run 0031 (ten more in
  `store.test.ts` for the wishes and the messages, four in `session.test.ts` for
  the landing rule); 261 in eighteen as of run 0030; 256 in eighteen as of run 0029 (P4's four in
  `rules.test.ts`, six for the delete helpers in `unitBrowser.test.ts`, and two
  more in `scripts/flatLayout.test.ts`); 244 in eighteen as of run 0028 (the new
  `scripts/flatLayout.test.ts` at 21); 223 in seventeen as of run 0027 (the new
  `flatState.test.ts` at 17 and `journey.test.ts` at 6, plus 2 in
  `session.test.ts` for the landing's join); 198 in fifteen as of run 0026 (`store.test.ts` 18 to
  21, `sameResident` and the plot round trip; `unitBrowser.test.ts` 6 to 7; the
  new `unitStats.test.ts` at 4, the save column's live numbers, pure); 190 in
  fourteen as of run 0025 (177 in thirteen as
  of run 0024, plus 7 in session.test.ts for takeoverConfirmText and
  decideTakeover, and the new unitBrowser.test.ts at 6, isMine/sortMineFirst
  only; 153 in twelve as of run 0023, plus 4 in naming.test.ts for a second
  list, 9 in store.test.ts for the ownership refusal and the preview round
  trip, 6 in session.test.ts for ownerResident and publishPreview, and the
  new previewFrame.test.ts at 5;
  134 in eleven as of run 0022, plus `src/session/session.test.ts` 15, the
  session settings and the publish call; 126 in ten as of run 0021, plus
  `src/session/store.test.ts` 9, the session store through an in-memory KV)
  (84 in eight before run 0020,
  plus `src/core/stairSpec.test.ts` 23, the stair proportions and the spiral's
  miss, and `src/scene/props/bathroomFit.test.ts` 19, the bathroom fixture fit).
  The eight older files are:
  `src/core/rules.test.ts` (25, over HAND-BUILT `DwellingGraph` objects),
  `src/library/naming.test.ts` (14, the `Flat n` / `Unit n` convention and the
  number the save dialog proposes), `src/core/savePlan.test.ts` (14, all eight
  save-checkbox combinations and the rule that a failed unit never cancels the
  project file), `src/library/manifest.test.ts` (9, manifest schema plus the
  committed library validated through the browser's own parser),
  `src/core/saveFiles.test.ts` (8, the byte-identity guarantee for both
  downloads), `src/library/ids.test.ts` (6, id slugs and collisions),
  `src/core/exteriorEdges.test.ts` (5, over `isFacadeEdge`), and
  `src/core/unitExport.test.ts` (3 pure cases over the export glazing
  invariant, whose header explains that it deliberately does not call
  `buildUnitExport`).
  `npm run test:slow` is the second, about 3.6 s, holding anything named
  `*.slow.test.ts` — files that drive a real `FloorManager` through a stubbed
  `FloorDeps` (`unitExport.slow.test.ts`, run 0018's
  `libraryRoundTrip.slow.test.ts`, and run 0028's `libraryClean.slow.test.ts`,
  which walks every file in `public/units/` and asserts zero must-fix, and names
  the twenty flats runs 0028 and 0029 designed so a deleted one cannot go
  unnoticed). The
  split exists because that import graph
  pulls in three.js; it is written in exactly two places, `test.exclude` in
  `vite.config.ts` and `include` in `vitest.slow.config.ts`.
- **`npm run test:slow` currently reports `57 passed | 1 expected fail` as of run
  0029 (41 plus the one as of run 0028, 26 as of run 0027), and the expected fail
  is deliberate.** French-window edges are built but never exported
  (`unitExport.ts:311` enumerates the envelope with the strict open-sky test, which
  skips edges whose neighbour cell is occupied, and a balcony cell is occupied). It is
  recorded as an `it.fails` case so the suite stays green and turns RED the day someone
  fixes the export. Do not "fix" the red by deleting the test. Everything else is still verified the old way: `tsc`
  clean, `npm run build` clean, and driving the app in a real browser. Since run 0010 the
  Check Layout panel is fully scriptable: write a fixture into `testflats/`, open
  `?project=<name>`, and read `#validation-panel` from the DOM. That works even with the
  Browser pane hidden, because the panel is DOM rather than pixels.
- **Geometry is scriptable too, since run 0013.** In DEV the app exposes
  `window.__app` with the floor manager, camera, scene, controls, renderer, the
  plan-mode entry points, and `capture(name)`, which renders one frame and POSTs the
  canvas to `/__capture?name=…`; the `capture-sink` plugin in `vite.config.ts` writes it
  under `captures/`. So a check can read a mesh's real dimensions rather than describe a
  screenshot, and can leave a rendered plan behind as a file. Both are behind
  `import.meta.env.DEV` and `apply: "serve"`, so neither ships.
- **Check that a capture is not 0 bytes before trusting it.**
  `window.__app.capture(name)` returns `{ok: true}` and creates the file even when
  the Browser pane is HIDDEN, but the PNG is empty, because `canvas.toDataURL()`
  gives nothing back when the page is not compositing. With the pane visible the
  same call wrote 33445 bytes. Note also that a capture records the WebGL canvas
  ONLY: DOM overlays such as the drag chip and the validity label never appear in
  one, and need the pane's own screenshot instead.
- **Restart the dev server at the start of a session.** Run 0013 found one that had
  been running for four hours and was serving a transform of `src/scene/clusterShells.ts`
  from before run 0011 edited it, which threw on every page load while the source in the
  repo was fine. A long-lived server is not a trustworthy one; `rm -rf node_modules/.vite`
  clears the cache if a restart alone does not.
- Python is needed for exactly one thing: `docs/build-pdf.py`, which regenerates the
  rules PDF when `rules.ts` changes.
- `CLAUDE.md` requires that `PROJECT_STATE.md` be updated before any feature is
  reported as done. Assume that is part of the cost of every prompt.

## Non-obvious things

0. **`src/core/` DOES import three.js**, despite what an earlier version of this file
   said. `src/core/grid.ts:1` is `import * as THREE from "three"`, and `src/core/floor.ts`
   additionally imports from `../scene/`. The separation is about responsibility rather
   than about dependencies: `core/` owns the model and the logic, `scene/` owns the
   geometry builders. It matters when writing a headless test, because constructing a
   `Floor` pulls the render layer in, while the pure predicates and `Grid` are fine
   under Node.

1. **This is one of two repos, and you can only reach this one.** This repo authors
   a *single flat*. A separate repo, `bottom-up-design`, packs many flats into a
   *building* — that is where massing, aggregation, evolution and section drawings
   live. The two share no code at all, only a JSON file described in
   `docs/bridge-format.md`. A prompt about buildings, facades at building scale,
   packing or section cuts cannot be run here, and will come back blocked.

2. **"Derive, don't store" is a hard architectural rule.** Cluster shells, stair
   holes, the adjacency graph, generated windows and wall heights are all recomputed
   from placement data on every change and are never serialized. A prompt that asks
   to cache, persist or hand-edit any of them contradicts a standing convention in
   `CLAUDE.md` and will be pushed back on.

3. **`.claude/` is mostly gitignored, but the bridge is deliberately exempt.** A
   pre-existing rule ignores `.claude/` wholesale; four negation rules at
   `.gitignore:28-31` carve `.claude/bridge/` and `.claude/skills/` back out, so the
   protocol and the three skills are versioned alongside the records they produce.
   Everything else directly under `.claude/` — `settings.local.json`, `launch.json` —
   stays ignored as machine-local.

4. **Three.js is Y-up, so the plan is the X/Z plane, not X/Y.** `CELL_SIZE` is
   0.6 m, floor height is derived rather than configured, and rooms are hollow
   shells (floor plate plus perimeter walls) rather than solids. Prompts written
   with an X/Y plan in mind read as correct and are subtly wrong throughout.
