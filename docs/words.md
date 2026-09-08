# Every word a person reads in this app

Written in run 0042. Every string a person can read on screen, where it lives,
what it said before the run and what it says after, grouped by the screen a
person is looking at when they read it.

The measure is two documents. `_cowork/design/DESIGN-BRIEF-3sep.md`, section
"How the app talks", says what the app sounds like: short natural sentences
that explain rather than announce, written as if explaining to a clever person
who has never seen this, kindly and without hurrying. Say what a number means
in something a person can picture. `_cowork/design/WRITING-GUIDE.md` says how
Shrey writes: short sentences, plain words, no slogans, no punchlines, no
metaphors, nothing that sells, no contrast constructions of the "x, not y"
shape, no em dashes gluing clauses together, no filler words, hedges inside the
sentence.

Every string in the After column lives in `src/core/words.ts`. A blank After
cell means the string was left as it was, and the group's note says why.

Two things are marked rather than rewritten. **Operator** marks a string only
the person running the app or the store reads, in a terminal or a developer
console; those are exact on purpose. **Shared** marks the landing fragment's own
words, which live in `_cowork/design/landing/landing.html` and belong to both
apps at once; they change at the source in the Context folder or not at all.

## 1. The top bar

Read on every screen. Almost all of it is the name of a thing, and the brief
asks for a short word when that is what a label is. Two changed. `storey(s)`
carried its plural in brackets, which is not how anybody reads a number. The
check chip counted in the name of a severity: "3 must fix" is not a sentence a
person would say, and the send button beside it already counted in things.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:36` | label | `0.6 m grid` | |
| `index.html:42` | tooltip | `Your group code` | |
| `index.html:49` | tab | `01 Draw your flat` | |
| `index.html:52` | tab | `02 Send it` | |
| `index.html:61` | label | `area` | |
| `index.html:65`, `123` | label | `storey(s)` | `storeys` |
| `index.html:69` | label | `glazing` | |
| `index.html:71` | tooltip | `Open the layout report` | |
| `index.html:75` | state | `No group` | |
| `src/core/words.ts` `sessionLineText` | state | `No group · {name}` / `Group {code} · {name}` | |
| `index.html:77-79` | view buttons | `Model`, `Plan`, `Diagram` | |
| `index.html:81` | button | `Units` | |
| `index.html:84-88` | menu | `Open`, `Open project`, `Start over` | |
| `index.html:91` | tooltip | `Keyboard shortcuts` | |
| `src/core/words.ts` `mustFixLabel` | check chip | `{n} must fix` | `{n} things to fix`, and `1 thing to fix` |
| `src/core/words.ts` `ALL_CHECKS_PASS` | check chip | `All checks pass` | |
| `src/core/words.ts` `checkChipTooltip` | tooltip | `{first fault} — open the layout report` | `{first fault} Open the layout report.` |

## 2. The landing, this app's own parts

The doors, the headline, the aside and the journey dots are **shared**. What
follows is what this app writes into the fragment.

Two changed for the same reason. A placeholder is an example of what to type,
and `who is sending` was an instruction standing where an example goes, under a
label that already asked the question. The recall line opened with "Picking up
where you left off", a phrase people write and nobody says.

The two store refusals name the store, which is this project's word for the
place a group is kept. A resident has never heard it. The brief says to say
what a thing is before naming it, so both sentences now say what the app could
not reach.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/core/words.ts` `START_A_FLAT` | first door | `Start a flat` / `Back to your flat` | |
| `src/core/draft.ts:117` | the way out | `Start again with a new flat.` | |
| `src/core/draft.ts:124` | confirm | `This forgets the flat and the name on this browser. The flat you sent stays in your group. Start again?` | |
| `index.html:374`, `377` | field labels | `Your group`, `Your name` | |
| `index.html:375` | placeholder | `room-42` | |
| `index.html:378`, `282`, `394` | placeholder | `who is sending` | `Ana` |
| `index.html:383`, `385` | buttons | `Join`, `back` | |
| `index.html:388` | label | `Your group code` | |
| `index.html:391` | sentence | `Pass this to the others so they can join.` | |
| `index.html:398` | button | `Start drawing` | |
| `src/core/words.ts` `recallLine` | recall | `Picking up where you left off, as Ana in room-42. Change either if that is not you.` | `You were here before, as Ana in room-42. Change either one if that is not you.` |
| `src/core/words.ts` `noSuchGroup` | refusal | `No group called {code}. Check the code for a typo, or ask whoever started the group for it.` | |
| `src/core/words.ts` `storeNotRunning` | refusal | `The group needs the store, which is not running. Start it with {command} and open {address}.` | `The app cannot reach the place your group is kept. Start it with {command} and open {address}.` |
| `src/core/words.ts` `COULD_NOT_START_GROUP` | refusal | `Could not reach the store to start a group. Try again in a moment.` | `The app could not reach the place groups are kept. Try again in a moment.` |
| `src/core/words.ts` `couldNotAnswer` | refusal | `The store could not answer for {code}. Try again in a moment.` | `The app could not find out whether {code} exists. Try again in a moment.` |

## 3. Step 01, drawing

The legend and the shortcuts panel carried the most punctuation doing a verb's
work: an em dash for "is", a slash for "or", brackets for a plural. Each row now
reads as a sentence a person would say. One shortcut note named two buttons that
have not carried those words since run 0027: it said Reset View and Top View,
and the buttons read Frame and Plan.

The Display card's five tooltips each named the layer rather than saying what a
person will see, and three of them used words from inside the code: dollhouse,
elastic room, authored seed rectangle, the binding level, a bare plate.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:113` | empty state | `Drop a room here` | |
| `src/core/words.ts` `EMPTY_HINT` | empty state | `Drag a room onto the grid to start. Nothing is checked until you do.` | |
| `src/core/words.ts` `selectionEntrance` | read-out | `Entrance · Floor 0` | |
| `src/core/words.ts` `selectionDoor` | read-out | `Door · Floor {n}` | |
| `index.html:129` | button | `Re-layout` | |
| `index.html:133` | legend | `Door — connected` | `A door between them` |
| `index.html:134` | legend | `Touching — no door` | `Touching, with no door` |
| `index.html:136-138` | legend | `Must fix`, `Worth a look`, `Note` | |
| `index.html:140` | legend | `ENTRY — entrance` | `ENTRY, the entrance` |
| `index.html:142-143` | toggles | `Show touching`, `Show depth` | |
| `index.html:149` | panel title | `Shortcuts` | |
| `index.html:153` | shortcut | `Select a placed module` | `Select a placed room` |
| `index.html:154` | shortcut | `Move the selection` | `Move what is selected` |
| `index.html:155` | shortcut | `Rotate selection` | `Rotate what is selected` |
| `index.html:156` | shortcut | `Mirror selection` | `Mirror what is selected` |
| `index.html:157` | shortcut | `Cycle door swing (with a door selected)` | `Change the way a selected door swings` |
| `index.html:158` | shortcut | `Delete selection` | `Delete what is selected` |
| `index.html:159` | shortcut | `+ Click — add/remove from selection` | `Hold and click to add to or remove from the selection` |
| `index.html:160` | shortcut | `Duplicate selection (or Shift D)` | `Duplicate what is selected, or Shift D` |
| `index.html:162` | shortcut | `Redo (or Ctrl/Cmd Y)` | `Redo, or Ctrl/Cmd Y` |
| `index.html:163` | shortcut | `Cancel gesture / clear selection / exit plan view` | `Cancel what you are doing, clear the selection, or leave plan view` |
| `index.html:164` | note | `Reset View & Top View are buttons only — no shortcut.` | `Frame and Plan are buttons only. Neither has a shortcut.` |
| `index.html:173` | tooltip | `Undo (Ctrl+Z)` | `Undo, Ctrl+Z` |
| `index.html:174` | tooltip | `Redo (Ctrl+Shift+Z / Ctrl+Y)` | `Redo, Ctrl+Shift+Z or Ctrl+Y` |
| `index.html:195` | the way forward | `Send it to your group` | |
| `src/core/words.ts` `NO_WAY_IN` | why it is asleep | `Place an entrance to send the flat to the group.` | |
| `src/core/words.ts` `DISPLAY_NOTHING_ON` | display summary | `all off` | `Nothing on` |
| `index.html:210` | tooltip | `Dollhouse cutaway: hide the walls facing the camera` | `Hide the walls facing you so you can see in.` |
| `index.html:211` | tooltip | `Outline each elastic room's authored seed rectangle` | `Outline the rectangle each stretching room was drawn from.` |
| `index.html:212` | tooltip | `The fixed layer: wet rooms and stairs as built, everything else a bare plate` | `Show the wet rooms and the stairs as they are built. Everything else becomes a bare floor.` |
| `index.html:213` | tooltip | `The binding level: perimeter, wet cells, stair, balconies, entrance — the rest as one open plate` | `Show what the building needs from this flat: the outside wall, the wet cells, the stair, the balconies and the entrance. The rest becomes one open floor.` |
| `index.html:218` | tooltip | `Frame the whole flat in the view` | `Fit the whole flat in the view.` |
| `src/core/words.ts` `compassValue` | compass | `North {n}°` | |
| `index.html:233` | compass hint | `drag to set · moves glazing` | `Drag to set. It moves the glazing.` |
| `index.html:240` | drop overlay | `Drop project file to import` | `Drop a project file here to open it.` |
| `src/core/words.ts` `ALREADY_A_FRENCH_WINDOW` | refusal | `That boundary is already a french window onto the balcony.` | |
| `src/core/words.ts` `cannotOpenUpward` | refusal | `Cannot open this room upward: the floor above already holds {what} over it` | `This room cannot open upward. The floor above already holds {what} over it.` |
| `src/core/words.ts` `NOT_DOUBLE_HEIGHT` | refusal | `This room cannot be made double height.` | |
| `src/core/words.ts` `floorResized` | after a resize | `Floor resized to {c}x{r}; removed {n} item(s) that no longer fit.` | `The floor is now {c} by {r} cells. {n} things no longer fitted and were removed.` |
| `src/core/words.ts` `DELETE_FLOOR_CONFIRM` | confirm | `Delete this floor and everything on it?` | |

## 4. The palette

The palette called what you drag a tile; the empty state on the grid beside it
called the same thing a room. Two words for one thing is what the guide means
by no synonyms for things that have a name. The three tools' second lines were
noun phrases; they now say where the tool goes.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/core/words.ts` `PALETTE_PLACE` | heading | `Place` | |
| `src/core/words.ts` `PALETTE_CAPTION` | caption | `Drag a tile onto the grid to place it. Press ? for every shortcut.` | `Drag a room onto the grid to place it. Press ? for every shortcut.` |
| `src/core/words.ts` `PALETTE_ROOMS` | group title | `Rooms` | |
| `src/core/words.ts` `PALETTE_CIRCULATION` | group title | `Circulation & Outdoor` | `Circulation and outdoor` |
| `src/core/words.ts` `PALETTE_STRUCTURE` | group title | `Structure & Access` | `Structure and access` |
| `src/core/words.ts` `TOOL_ENTRANCE_WHERE` | tool | `exterior edge` | `on an outside edge` |
| `src/core/words.ts` `TOOL_DOORWAY_WHERE` | tool | `interior wall` | `in an inside wall` |
| `src/core/words.ts` `TOOL_DOUBLE_HEIGHT_WHERE` | tool | `room into the storey above` | `opens a room into the storey above` |
| `src/core/words.ts` `PALETTE_BRIEF`, `PALETTE_FLOORS` | headings | `Brief`, `Floors` | |

## 5. The layout report

The report's own furniture is three words naming the three tiers, which the
brief allows as names of things. What a person reads in it is the rules' lines,
in group 9.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/core/words.ts` `OUTPUT_*` | what was saved | `Project file`, `Unit file`, `Library entry`, `Group` | |
| `index.html:136-138` | tiers | `Must fix`, `Worth a look`, `Note` | |

## 6. Step 02, sending

Two lines said what happens to a drawing in a voice nobody uses about their own
work. `It becomes Flat 7` names a transformation; a resident wants to know what
the others will see. `Sent to room-42 as Flat 7` reads as one clause with a
preposition doing two jobs.

The decline line said `not published — you chose not to take over Ana's flat`,
which is a double negative around a choice the resident made on purpose.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:119` | caption | `Your flat, as your neighbours will see it` | |
| `src/core/words.ts` `UNTITLED` | flat name | `Untitled` | |
| `index.html:257` | headline | `Send it to your group.` | |
| `src/core/words.ts` `whoLineText` | who is sending | `As {name}, to {code}.` and its three other cases | |
| `index.html:275` | button | `change` | |
| `src/core/words.ts` `SEND_IT`, `GO_TO_GROUP` | button | `Send it`, `Go to your group` | |
| `src/core/words.ts` `sendAnyway` | button | `Send anyway · {n} thing(s) to look at` | |
| `src/core/words.ts` `GROUP_HAS_OLDER` | notice | `Your group still has this flat as you sent it. Sending again replaces it.` | |
| `index.html:300` | hint | `Your neighbours see it within seconds.` | |
| `src/core/words.ts` `itBecomes` | what it will be called | `It becomes {name}` | `Your group will see it as {name}.` |
| `src/core/words.ts` `sentTo` | after a send | `Sent to {code} as {label}` | `Sent to {code}. Your group sees it as {label}.` |
| `src/core/words.ts` `takeoverConfirm` | confirm | `This flat belongs to {owner}. Take it over?` | |
| `src/core/words.ts` `declinedTakeover` | after declining | `not published — you chose not to take over {owner}'s flat` | `not sent, because you chose to leave {owner}'s flat alone` |

## 7. Step 02, More

Nothing here changed. Every line is already a plain noun with a second line
saying what the thing is, which is what the brief asks a label to do.

| Where | Kind | Before | After |
|---|---|---|---|
| `index.html:306`, `316` | heading, label | `More`, `Colour` | |
| `index.html:320` | button | `Save a copy to my computer` / `the whole design, the only thing that reopens for editing` | |
| `index.html:324` | button | `Add to the library` / `the unit plus a picture, browsable under Units` | |
| `index.html:328` | button | `Save the unit file` / `the contract with the building` | |

## 8. Toasts and confirms

Four lines began `Import failed`. A resident opens a project; they do not
import one, and a thing that failed is a thing the app did rather than a thing
that happened to them. Two lines carried version numbers with no plain reading.
One said `carries no sourceProject`, which is a field name on a screen, and the
brief settled on 8 September that nothing a resident reads names a field that is
not in front of them.

`This will replace your current layout` used a word the rest of the app does not:
everywhere else the thing a person draws is a flat.

| Where | Kind | Before | After |
|---|---|---|---|
| `src/core/words.ts` `DRAFT_RESTORED` | toast | `Your flat is as you left it.` | |
| `src/core/words.ts` `couldNotOpen` | toast | `Import failed: {message}` | `Could not open that project. {message}` |
| `src/core/words.ts` `FILE_MAY_BE_DAMAGED` | toast | `Import failed while loading — the file may be corrupt.` | `Could not open that project. The file may be damaged.` |
| `src/core/words.ts` `roomsNotPlaced` | toast | `{n} room(s) could not be placed.` | `{n} rooms could not be placed.`, and `1 room` |
| `src/core/words.ts` `olderFileOpened` | toast | `This file was made with an older version (v{n}) and has been loaded successfully.` | `This file was made with an older version of the app (v{n}). It opened fine.` |
| `src/core/words.ts` `newerFileOpened` | toast | `Loaded a newer-version (v{n}) file on an older app (v{m}). Some elements may be missing.` | `This file was made with a newer version of the app (v{n}, this app is v{m}). Some things may be missing.` |
| `src/core/words.ts` `PROJECT_OPENED` | toast | `Project imported.` | `Project opened.` |
| `src/core/words.ts` `COULD_NOT_READ_FILE` | toast | `Could not read that file.` and `Could not read this file.` | `Could not read that file.` for both |
| `src/core/words.ts` `renamed` | toast | `Renamed {id} to "{name}".` | |
| `src/core/words.ts` `deleted` | toast | `Deleted "{name}" and {n} of its files.` | `Deleted "{name}" and {n} of its files.`, and `1 of its file` |
| `src/core/words.ts` `noSourceProject` | toast | `{file} carries no sourceProject — cannot open a copy.` | `{file} does not carry its design, so there is nothing to open.` |
| `src/core/words.ts` `couldNotReadNamed` | toast | `Could not read {file}: {message}` | `Could not read {file}. {message}` |
| `src/main.ts:2343` | toast, **operator** | `?project= could not load {url}: {message}` | |
| `src/core/words.ts` `REPLACE_LAYOUT_CONFIRM` | confirm | `This will replace your current layout. Continue?` | `This will replace the flat you have now. Continue?` |
| `src/core/words.ts` `LOAD_PROJECT_CONFIRM` | confirm | `Load this project?` | `Open this project?` |
| `src/core/words.ts` `newerFileConfirm` | confirm | `This file was created with a newer version (v{n}) of the app …` | `This file was made with a newer version of the app (v{n}). It may not open correctly. Open it anyway?` |
| `src/core/words.ts` `libraryReplaceConfirm` | confirm | `The library already holds "{name}" ({id}, saved {date}). OK replaces that entry. Cancel keeps it and adds a second one under a new id.` | |

## 9. The 42 rules' advisory lines

These were written for whoever wrote the rule. Twenty-one of them glued two
clauses with an em dash. Nine used a word a resident has no reason to know:
orphaned, reachability, leaf space, privacy gradient, hops, dwelling, mediated
access, atypical. Six named a condition rather than saying what is wrong in the
flat on the screen.

Every line now starts from what is in front of the person. Where a rule exists
because of a habit rather than a failure, it says so. Where it exists because of
a regulation, it names the regulation.

The thresholds did not move. DP1 and F1 read theirs from the constants they
check against, `DEEP_ROOM_THRESHOLD_HOPS` and `ESCAPE_DEPTH_MAX`, so the number
on screen is the number the rule uses.

| Rule | Sev | Before | After |
|---|---|---|---|
| E1 | hard | No entrance defined — the entrance is the unit's interface to the building. | This flat has no entrance yet. The entrance is where the building meets the flat. |
| E1 blocked | hard | All entrances are blocked — none currently open to the outside. Reachability can't be validated. | Every entrance is blocked. None of them opens to the outside any more, so there is no way in to check from. |
| E2 | hard | Entrance is blocked — its edge no longer faces outside. | This entrance is blocked. Its edge no longer faces outside. |
| DR1 | note | No doors placed — reachability requires doors. | No doors are placed. Two rooms that touch are not connected until a door joins them. |
| DR2 | note | Bedroom has an unusual number of doors for a private room. | This bedroom has more doors than a private room usually has. |
| DR2 detail | note | Bedroom has {n} doors — unusual for a private room. | This bedroom has {n} doors. A private room usually has one. |
| P1 | hard | A dwelling needs a bathroom. | A flat needs a bathroom. |
| P2 | hard | A dwelling needs a kitchen. | A flat needs a kitchen. |
| P3 | note | More than one kitchen — atypical, but not a problem. | There is more than one kitchen. That is unusual and it is allowed. |
| P4 | hard | A dwelling needs a bedroom — place one so the flat has somewhere to sleep. | A flat needs a bedroom. Place one so there is somewhere to sleep. |
| MB1 | soft | A floor has bedrooms but no bathroom. | This floor has bedrooms and no bathroom. |
| MB1 detail | soft | Floor {n} has bedrooms but no bathroom. | Floor {n} has bedrooms and no bathroom. |
| H1 | hard | Orphaned room — no path of adjacencies (including stairs) reaches an entrance. | There is no way to reach this room from an entrance, through doors or up a stair. |
| H2 | hard | A room or stair reachable from an entrance only by passing through a bathroom. | The only way to this room or stair from an entrance goes through a bathroom. |
| H3 | hard | A room or stair reachable from an entrance only by passing through a bedroom. | The only way to this room or stair from an entrance goes through a bedroom. |
| H4 | hard | Direct door between a bathroom and a kitchen — food prep opening onto a toilet. | A door joins a bathroom straight to a kitchen. Food is prepared on the other side of it. |
| S6 | note | Shared wet wall between kitchen and bathroom — efficient services. | The kitchen and the bathroom share a wet wall. Their pipes can run together. |
| H6 | hard | A room or stair reachable from an entrance only by passing through an outdoor space. | The only way to this room or stair from an entrance goes through an outdoor space. |
| C1 | soft | Orphaned corridor — a circulation space connected to nothing (dead space). | This circulation space connects to nothing, so nobody can use it. |
| C2 | soft | Under-used corridor — connects to only one space, so it doesn't circulate. | This circulation space connects to one room only, so nobody passes through it. |
| A1 | soft | Circulation narrower than 1.2 m (below accessible width). | This circulation is narrower than 1.2 m. A wheelchair needs 1.2 m. |
| O1 | soft | Outdoor space is unconnected — nothing opens onto it. | Nothing opens onto this outdoor space. |
| OD1 | hard | Outdoor space is not reachable from the dwelling. | There is no way to reach this outdoor space from inside the flat. |
| ST3 | hard | A floor is not reachable by stairs from the entrance floor. | No stair reaches this floor from the floor the entrance is on. |
| ST1 | soft | Stair connects to nothing on one or both floors it should link. | This stair reaches nothing on one of the two floors it joins. |
| ST2 | hard | Stair not reachable from any entrance. | There is no way to reach this stair from an entrance. |
| D1 | hard | Room has no exterior wall — no daylight possible. | This room has no outside wall, so no daylight can reach it. |
| D2 | soft | Kitchen has no exterior wall — no natural ventilation. | This kitchen has no outside wall, so it cannot be aired by a window. |
| W1 | soft | Room's glazing is below its daylight target. | This room has less glazing than its daylight target asks for. |
| OR1 | soft | Room is lit only from the north (no direct sun). | This room is lit from the north only, so no direct sun reaches it. |
| OR2 | soft | Room's glazing faces only the orientation this project asks to avoid. | All of this room's glazing faces the direction this project asks to avoid. |
| G1 | soft | No bathroom is reachable without passing through a bedroom (guest access). | Every bathroom is behind a bedroom, so a guest has nowhere to go. |
| G2 | soft | Entrance opens directly into a private room. | The entrance opens straight into a private room. |
| S1 | soft | Outdoor / balcony over-connected (more than two doors) — usually a leaf space. | This outdoor space has more than two doors. It is usually somewhere you end up rather than pass through. |
| S2 | soft | Living room under-connected (one or no doors) — typically a social hub. | This living room has one door or none. It is usually the room everything else opens onto. |
| S3 | soft | Bedroom directly adjacent to a kitchen, living room, or recreation room (privacy — prefer mediated access). | This bedroom opens straight onto a kitchen, living room or recreation room. A bedroom is usually reached through something quieter. |
| AC1 | soft | Bedroom shares a wall with a stair — stair noise against a sleeping room. | This bedroom shares a wall with a stair. People on the stair will be heard. |
| S5 | note | Kitchen and living room connected by a door — open-plan. Perfectly fine, noted for confirmation. | A door joins the kitchen and the living room, so the two are open to each other. That is fine, and it is noted so you know it was read that way. |
| S7 | note | En-suite bathroom (accessed via bedroom). | This bathroom is reached through a bedroom, so it is en suite. |
| DP1 | soft | Room is unusually deep in the layout (≥5 hops from the entrance). | This room is deep in the flat. Getting to it from the entrance passes through 5 rooms or more. |
| N1 | soft | Circulation-heavy layout — too much of the interior is circulation. | Much of the floor area is circulation, so less of it is left to live in. |
| PG1 | soft | Inverted privacy gradient — bedrooms are shallower than living spaces. | The bedrooms are closer to the entrance than the living spaces. Usually it is the other way round. |
| F1 | soft | Room is far from any exit (more than 4 hops from the nearest entrance or stair). | This room is far from a way out. Getting to the nearest entrance or stair passes through more than 4 rooms. |
| WET1 | soft | Wet rooms (bathrooms, kitchen) are split across separate groups on a floor. Split wet areas mean long installation runs and shafts that cannot bundle to the next storey. | The wet rooms are in separate groups on this floor. Pipes then run a long way and cannot bundle into one shaft to the storey above. |
| FAC1 | hard | Habitable room has no facade — it touches neither open sky nor a balcony. (PBG LS 700.1 § 302: every habitable room needs a facade window) | This habitable room has no facade. It touches neither open sky nor a balcony, and PBG LS 700.1 § 302 asks every habitable room for a facade window. |

## 10. The store's refusals

**Operator** unless marked otherwise, and left exactly as they are. The store
answers a program. Its words are read by whoever is running it, in a terminal or
a developer console, and they name the method, the field and the shape a call
must have. Making them conversational would take away what they are for, and no
resident sees them: the flat app never shows a store error verbatim, and the
building app has its own words for every case a person reaches.

The seven marked **person** are the ones the other app can put in front of
somebody. They stay exact here and are said plainly there. That is the other
repository's run to make, and this run does not reach into it.

| Where | Status | Text |
|---|---|---|
| `src/session/store.ts:492`, `526`, `624`, `813` | 404 | `no such route; see docs/store.md` |
| `src/session/store.ts:495` | 400 | `session code must be 1-32 of a-z, 0-9, - and _` |
| `src/session/store.ts:405` | 400 | `resident name must be 1-64 printable characters` |
| `src/session/store.ts:513` | 409, **person** | `group "{code}" has already been started` |
| `src/session/store.ts:522` | 400 | `flat id must be 1-64 of a-z, 0-9, - and _` |
| `src/session/store.ts:532` | 404, **person** | `no flat "{id}" in session "{code}"` |
| `src/session/store.ts:539` | 400 | `?resident= is required: who is publishing` |
| `src/session/store.ts:594` and others | 400 | `body must be JSON`, `body must be a JSON object` |
| `src/session/store.ts:603`, `635` | 404, **person** | `no resident "{who}" in session "{code}"` |
| `src/session/store.ts:611` | 409, **person** | `"{to}" is already at the table in session "{code}"` |
| `src/session/store.ts:692` | 400 | `text must be 1-{n} characters` |
| `src/session/store.ts:723` | 409, **person** | `round {n} in session "{code}" is still open` |
| `src/session/store.ts:728` | 409 | `next round in session "{code}" is {n}, not {m}` |
| `src/session/store.ts:764` | 400 | `no pair "{id}" in round {n}` |
| `src/session/store.ts:769` | 403, **person** | `"{who}" is not in session "{code}"` |
| `src/session/store.ts:773` | 409, **person** | `round {n} in session "{code}" is closed`, `no open round {n} in session "{code}"` |
| various | 405 | `GET or POST only`, `PUT only`, `POST only`, `GET or PUT only`, `PUT, DELETE or POST .../rename only` |
