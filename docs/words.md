# Every word a person reads in this app

Written in run 0042. This is the inventory: every string a person can read on
screen, where it lives, and what kind of thing it is. It is grouped by the
screen a person is looking at when they read it.

The measure is two documents. `_cowork/design/DESIGN-BRIEF-3sep.md`, section
"How the app talks", says what the app sounds like: short natural sentences
that explain rather than announce, written as if explaining to a clever person
who has never seen this, kindly and without hurrying. Say what a number means
in something a person can picture. Say what is about to happen before it
happens and what happened after. `_cowork/design/WRITING-GUIDE.md` says how
Shrey writes: short sentences, plain words, no slogans, no punchlines, no
metaphors, nothing that sells, no contrast constructions of the "x, not y"
shape, no em dashes gluing clauses together, no filler words, hedges inside the
sentence.

Two things are marked rather than rewritten. **Operator** marks a string only
the person running the app or the store reads, in a terminal or a developer
console; those are exact on purpose. **Shared** marks the landing fragment's own
words, which live in `_cowork/design/landing/landing.html` and belong to both
apps at once; they change at the source in the Context folder or not at all.

The "after" column and the notes per group were added in the same run, once the
rewrite landed. A string with the same text in both columns was left alone, and
the reason is in the group's note.

## 1. The top bar

Read on every screen.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:36` | label | `0.6 m grid` | |
| `index.html:42` | tooltip | `Your group code` | |
| `index.html:49` | tab | `01 Draw your flat` | |
| `index.html:52` | tab | `02 Send it` | |
| `index.html:61` | label under a number | `area` | |
| `index.html:65` | label under a number | `storey(s)` | |
| `index.html:69` | label under a number | `glazing` | |
| `index.html:71` | tooltip | `Open the layout report` | |
| `index.html:75` | state, with tooltip `Set under step 02` | `No group` | |
| `src/session/session.ts:244` | state | `No group · {name}` | |
| `src/session/session.ts:245` | state | `Group {code} · {name}`, or `Group {code}` | |
| `index.html:77-79` | view buttons | `Model`, `Plan`, `Diagram` | |
| `index.html:81` | button | `Units` | |
| `index.html:84` | menu button | `Open` | |
| `index.html:87` | menu item | `Open project` | |
| `index.html:88` | menu item | `Start over` | |
| `index.html:91` | tooltip | `Keyboard shortcuts` | |
| `src/main.ts:1321` | check chip | `{n} must fix`, or `All checks pass` | |
| `src/main.ts:1323` | check chip tooltip | `{first fault} — open the layout report`, or `Open the layout report` | |

## 2. The landing, this app's own parts

The doors, the headline, the aside and the journey dots are **shared** and are
not listed here. What follows is what this app writes into the fragment.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/main.ts:1464` | first door's label | `Start a flat`, or `Back to your flat` | |
| `src/core/draft.ts:117` | the way out | `Start again with a new flat.` | |
| `src/core/draft.ts:124` | confirm | `This forgets the flat and the name on this browser. The flat you sent stays in your group. Start again?` | |
| `index.html:374` | field label | `Your group` | |
| `index.html:375` | placeholder | `room-42` | |
| `index.html:377` | field label | `Your name` | |
| `index.html:378` | placeholder | `who is sending` | |
| `index.html:383` | button | `Join` | |
| `index.html:385` | button | `back` | |
| `index.html:388` | label | `Your group code` | |
| `index.html:391` | sentence | `Pass this to the others so they can join.` | |
| `index.html:398` | button | `Start drawing` | |
| `src/session/session.ts:279` | recall line | `Picking up where you left off, {as X}{in Y}. Change {which} if that is not you.` | |
| `src/session/session.ts:172` | refusal | `No group called {code}. Check the code for a typo, or ask whoever started the group for it.` | |
| `src/session/session.ts:127` | refusal | `The group needs the store, which is not running. Start it with {command} and open {address}.` | |
| `src/main.ts:1555` | refusal | `Could not reach the store to start a group. Try again in a moment.` | |
| `src/main.ts:1612` | refusal | `The store could not answer for {code}. Try again in a moment.` | |
| `src/main.ts:1554` | code placeholder after a failure | `—` | |

## 3. Step 01, drawing

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:113` | empty state, on the grid | `Drop a room here` | |
| `src/core/flatState.ts:64` | empty state, in the palette | `Drag a room onto the grid to start. Nothing is checked until you do.` | |
| `src/main.ts:499` | selection read-out | `Entrance · Floor 0` | |
| `src/main.ts:501` | selection read-out | `Door · Floor {n}` | |
| `index.html:129` | button | `Re-layout` | |
| `index.html:133` | legend | `Door — connected` | |
| `index.html:134` | legend | `Touching — no door` | |
| `index.html:136-138` | legend | `Must fix`, `Worth a look`, `Note` | |
| `index.html:140` | legend | `ENTRY — entrance` | |
| `index.html:142` | toggle | `Show touching` | |
| `index.html:143` | toggle | `Show depth` | |
| `index.html:149` | panel title | `Shortcuts` | |
| `index.html:153-163` | shortcut rows | `Select a placed module`, `Move the selection`, `Rotate selection`, `Mirror selection`, `Cycle door swing (with a door selected)`, `Delete selection`, `+ Click — add/remove from selection`, `Duplicate selection (or Shift D)`, `Undo`, `Redo (or Ctrl/Cmd Y)`, `Cancel gesture / clear selection / exit plan view` | |
| `index.html:164` | shortcut note | `Reset View & Top View are buttons only — no shortcut.` | |
| `index.html:173-174` | tooltips | `Undo (Ctrl+Z)`, `Redo (Ctrl+Shift+Z / Ctrl+Y)` | |
| `index.html:195` | the one way forward | `Send it to your group` | |
| `src/core/flatState.ts:164` | why it is asleep | `Place an entrance to send the flat to the group.` | |
| `index.html:206` | display summary | `Cutaway`, or the layers joined by ` · `, or `all off` | |
| `index.html:210-218` | display buttons and tooltips | `Cutaway` / `Dollhouse cutaway: hide the walls facing the camera`; `Seeds` / `Outline each elastic room's authored seed rectangle`; `Structure` / `The fixed layer: wet rooms and stairs as built, everything else a bare plate`; `Interface` / `The binding level: perimeter, wet cells, stair, balconies, entrance — the rest as one open plate`; `Frame` / `Frame the whole flat in the view` | |
| `index.html:232` | compass | `North {n}°` | |
| `index.html:233` | compass hint | `drag to set · moves glazing` | |
| `index.html:240` | drop overlay | `Drop project file to import` | |
| `src/main.ts:340` | refusal | `That boundary is already a french window onto the balcony.` | |
| `src/main.ts:522` | refusal | `Cannot open this room upward: the floor above already holds something over {it}` | |
| `src/main.ts:527` | refusal | `This room cannot be made double height.` | |
| `src/main.ts:378` | after a resize | `Floor resized to {c}x{r}; removed {n} item(s) that no longer fit.` | |
| `src/main.ts:403` | confirm | `Delete this floor and everything on it?` | |

## 4. The palette

| Where | Kind | Before | After |
|---|---|---|---|
| `src/ui/palette.ts:59` | section heading | `Place` | |
| `src/ui/palette.ts:64` | caption | `Drag a tile onto the grid to place it. Press ? for every shortcut.` | |
| `src/ui/palette.ts:65` | group title | `Rooms` | |
| `src/ui/palette.ts:67` | group title | `Circulation & Outdoor` | |
| `src/ui/palette.ts:106` | group title | `Structure & Access` | |
| `src/ui/palette.ts:119` | tool | `Entrance` / `exterior edge` | |
| `src/ui/palette.ts:124` | tool | `Doorway` / `interior wall` | |
| `src/ui/palette.ts:130` | tool | `Double height` / `room into the storey above` | |
| `src/ui/palette.ts:71` | section heading | `Brief` | |
| `src/ui/palette.ts:192` | section heading | `Floors` | |

## 5. The layout report

The report lists findings. Each carries one of the 42 rules' advisory lines,
which are in `src/core/rules.ts` and are listed in group 9 below.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/main.ts:1846` | finding kind | the output labels for `hard`, `soft` and `note` | |
| `src/main.ts:1849` | finding detail | the rule's own line, or a line the rule builds with the room's name | |

## 6. Step 02, sending

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:119` | caption | `Your flat, as your neighbours will see it` | |
| `index.html:121` | flat name when there is none | `Untitled` (`src/core/flatState.ts:58`) | |
| `index.html:125` | label under a number | `rooms` | |
| `index.html:257` | headline | `Send it to your group.` | |
| `src/session/session.ts:235-238` | who is sending | `As {name}, to {code}.` / `You have not said who you are or which group.` / `To {code}, but you have not said who you are.` / `As {name}, but you have not joined a group.` | |
| `index.html:275` | button | `change` | |
| `index.html:279` | placeholder | `room-42` | |
| `index.html:282` | placeholder | `who is sending` | |
| `src/core/flatState.ts:90` | send button | `Send it` | |
| `src/core/flatState.ts:91` | send button | `Go to your group` | |
| `src/core/flatState.ts:145` | send button | `Send anyway · {n} thing(s) to look at` | |
| `src/core/flatState.ts:94` | notice | `Your group is looking at an older flat. Send again when you are ready.` | |
| `index.html:300` | hint | `Your neighbours see it within seconds.` | |
| `src/main.ts:1751` | what the send will be called | `It becomes {name}` | |
| `src/main.ts:1903` | after a send | `Sent to {code} as {label}` | |
| `src/session/session.ts:283` | confirm | `This flat belongs to {owner}. Take it over?` | |
| `src/session/session.ts:374` | after declining | `not published — you chose not to take over {owner}'s flat` | |

## 7. Step 02, More

Everything in this group is a deliberate extra. Nothing here is needed to send.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:306` | heading | `More` | |
| `index.html:316` | label | `Colour` | |
| `index.html:320` | button | `Save a copy to my computer` / `the whole design, the only thing that reopens for editing` | |
| `index.html:324` | button | `Add to the library` / `the unit plus a picture, browsable under Units` | |
| `index.html:328` | button | `Save the unit file` / `the contract with the building` | |

## 8. Toasts and confirms

| Where | Kind | Before | After |
|---|---|---|---|
| `src/core/draft.ts:113` | toast | `Your flat is as you left it.` | |
| `src/main.ts:2115` | toast | `Import failed: {message}` | |
| `src/main.ts:2150` | toast | `Import failed while loading — the file may be corrupt.` | |
| `src/main.ts:2156` | toast | `{n} room(s) could not be placed.` | |
| `src/main.ts:2161` | toast | `This file was made with an older version (v{n}) and has been loaded successfully.` | |
| `src/main.ts:2166` | toast | `Loaded a newer-version (v{n}) file on an older app (v{m}). Some elements may be missing.` | |
| `src/main.ts:2168` | toast | `Project imported.` | |
| `src/main.ts:2181` | toast | `Could not read that file.` | |
| `src/main.ts:2114` | toast | `Could not read this file.` | |
| `src/main.ts:2227` | toast | `Renamed {id} to "{name}".` | |
| `src/main.ts:2242` | toast | `Deleted "{name}" and {n} of its files.` | |
| `src/main.ts:2258` | toast | `{file} carries no sourceProject — cannot open a copy.` | |
| `src/main.ts:2272` | toast | `Could not read {file}: {message}` | |
| `src/main.ts:2343` | toast, **operator** | `?project= could not load {url}: {message}` | |
| `src/main.ts:2129` | confirm | `This will replace your current layout. Continue?` | |
| `src/main.ts:2130` | confirm | `Load this project?` | |
| `src/main.ts:2133` | confirm | `This file was created with a newer version (v{n}) of the app …` | |
| `src/main.ts:1991` | confirm | `The library already holds "{name}" ({id}, saved {date}). OK replaces that entry. Cancel keeps it and adds a second one under a new id.` | |

## 9. The 42 rules' advisory lines

Read in the layout report, one line per finding.
`hard` is shown as **Must fix**, `soft` as **Worth a look**, `note` as **Note**.

| Rule | Severity | Before | After |
|---|---|---|---|
| E1 | hard | No entrance defined — the entrance is the unit's interface to the building. | |
| E1 (blocked) | hard | All entrances are blocked — none currently open to the outside. Reachability can't be validated. | |
| E2 | hard | Entrance is blocked — its edge no longer faces outside. | |
| DR1 | note | No doors placed — reachability requires doors. | |
| DR2 | note | Bedroom has an unusual number of doors for a private room. | |
| P1 | hard | A dwelling needs a bathroom. | |
| P2 | hard | A dwelling needs a kitchen. | |
| P3 | note | More than one kitchen — atypical, but not a problem. | |
| P4 | hard | A dwelling needs a bedroom — place one so the flat has somewhere to sleep. | |
| MB1 | soft | A floor has bedrooms but no bathroom. | |
| H1 | hard | Orphaned room — no path of adjacencies (including stairs) reaches an entrance. | |
| H2 | hard | A room or stair reachable from an entrance only by passing through a bathroom. | |
| H3 | hard | A room or stair reachable from an entrance only by passing through a bedroom. | |
| H4 | hard | Direct door between a bathroom and a kitchen — food prep opening onto a toilet. | |
| S6 | note | Shared wet wall between kitchen and bathroom — efficient services. | |
| H6 | hard | A room or stair reachable from an entrance only by passing through an outdoor space. | |
| C1 | soft | Orphaned corridor — a circulation space connected to nothing (dead space). | |
| C2 | soft | Under-used corridor — connects to only one space, so it doesn't circulate. | |
| A1 | soft | Circulation narrower than 1.2 m (below accessible width). | |
| O1 | soft | Outdoor space is unconnected — nothing opens onto it. | |
| OD1 | hard | Outdoor space is not reachable from the dwelling. | |
| ST3 | hard | A floor is not reachable by stairs from the entrance floor. | |
| ST1 | soft | Stair connects to nothing on one or both floors it should link. | |
| ST2 | hard | Stair not reachable from any entrance. | |
| D1 | hard | Room has no exterior wall — no daylight possible. | |
| D2 | soft | Kitchen has no exterior wall — no natural ventilation. | |
| W1 | soft | Room's glazing is below its daylight target. | |
| OR1 | soft | Room is lit only from the north (no direct sun). | |
| OR2 | soft | Room's glazing faces only the orientation this project asks to avoid. | |
| G1 | soft | No bathroom is reachable without passing through a bedroom (guest access). | |
| G2 | soft | Entrance opens directly into a private room. | |
| S1 | soft | Outdoor / balcony over-connected (more than two doors) — usually a leaf space. | |
| S2 | soft | Living room under-connected (one or no doors) — typically a social hub. | |
| S3 | soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access). | |
| AC1 | soft | Bedroom shares a wall with a stair — stair noise against a sleeping room. | |
| S5 | note | Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation. | |
| S7 | note | En-suite bathroom (accessed via bedroom). | |
| DP1 | soft | Room is unusually deep in the layout (≥5 hops from the entrance). | |
| N1 | soft | Circulation-heavy layout — too much of the interior is circulation. | |
| PG1 | soft | Inverted privacy gradient — bedrooms are shallower than living spaces. | |
| F1 | soft | Room is far from any exit (more than 4 hops from the nearest entrance or stair). | |
| WET1 | soft | Wet rooms (bathrooms, kitchen) are split across separate groups on a floor. Split wet areas mean long installation runs and shafts that cannot bundle to the next storey. | |
| FAC1 | hard | Habitable room has no facade — it touches neither open sky nor a balcony. (PBG LS 700.1 § 302: every habitable room needs a facade window) | |

Some rules also build a line naming the room, for example
`src/core/rules.ts:552` writes `Bedroom has {n} doors — unusual for a private
room.` and `src/core/rules.ts:619` writes `Floor {n} has bedrooms but no
bathroom.` Those are listed with their rule above.

## 10. The store's refusals

**Operator** unless marked otherwise. The store answers a program, and its
words reach a person only when the other app shows them. The ones a person can
reach are marked.

| Where | Status | Before | After |
|---|---|---|---|
| `src/session/store.ts:492` | 404 | `no such route; see docs/store.md` | |
| `src/session/store.ts:495` | 400 | `session code must be 1-32 of a-z, 0-9, - and _` | |
| `src/session/store.ts:405` | 400 | `resident name must be 1-64 printable characters` | |
| `src/session/store.ts:513` | 409, **person** | `group "{code}" has already been started` | |
| `src/session/store.ts:522` | 400 | `flat id must be 1-64 of a-z, 0-9, - and _` | |
| `src/session/store.ts:532` | 404, **person** | `no flat "{id}" in session "{code}"` | |
| `src/session/store.ts:539` | 400 | `?resident= is required: who is publishing` | |
| `src/session/store.ts:594` | 400 | `body must be JSON` | |
| `src/session/store.ts:603` | 404, **person** | `no resident "{who}" in session "{code}"` | |
| `src/session/store.ts:611` | 409, **person** | `"{to}" is already at the table in session "{code}"` | |
| `src/session/store.ts:692` | 400 | `text must be 1-{n} characters` | |
| `src/session/store.ts:723` | 409, **person** | `round {n} in session "{code}" is still open` | |
| `src/session/store.ts:728` | 409, **person** | `next round in session "{code}" is {n}, not {m}` | |
| `src/session/store.ts:764` | 400 | `no pair "{id}" in round {n}` | |
| `src/session/store.ts:769` | 403, **person** | `"{who}" is not in session "{code}"` | |
| `src/session/store.ts:773` | 409, **person** | `round {n} in session "{code}" is closed` | |
| `src/session/store.ts:773` | 409, **person** | `no open round {n} in session "{code}"` | |
| various | 405 | `GET or POST only`, `PUT only`, `POST only`, `GET or PUT only`, `PUT, DELETE or POST .../rename only` | |
