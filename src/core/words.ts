/**
 * Every word a resident reads, in one file (run 0042).
 *
 * Before this run the app's words were spread over `index.html`, `src/main.ts`,
 * `src/core/flatState.ts`, `src/core/draft.ts`, `src/session/session.ts`,
 * `src/ui/palette.ts` and the 42 rules in `src/core/rules.ts`, written run by
 * run over three months by different sessions. They did not sound like one app.
 * They are here now so the next rewrite is one file, and so a test can read all
 * of them at once and fail on the habits Shrey strikes out.
 *
 * The two measures are `_cowork/design/DESIGN-BRIEF-3sep.md`, section "How the
 * app talks", and `_cowork/design/WRITING-GUIDE.md`. Short natural sentences
 * that explain rather than announce. Plain words. No slogans, no punchlines, no
 * metaphors, nothing that sells. No contrast constructions of the "x, not y"
 * shape. No em dashes gluing clauses together. Every number in something a
 * person can picture.
 *
 * `docs/words.md` lists every one of these beside what it used to say.
 *
 * Strings the operator alone reads stay where they are. They are exact on
 * purpose, and a person never sees them.
 */

// ---- The top bar ------------------------------------------------------------

/** Under the app's name. A number a person can picture: one cell is 0.6 m. */
export const GRID_META = "0.6 m grid";

export const TOOLTIP_GROUP_CODE = "Your group code";
export const STEP_DRAW = "Draw your flat";
export const STEP_SEND = "Send it";

/** The three labels under the flat's live numbers. Names of things, so short
 *  words rather than sentences. "storey(s)" carried its plural in punctuation,
 *  which is not how a person reads. */
export const LABEL_AREA = "area";
export const LABEL_STOREYS = "storeys";
export const LABEL_GLAZING = "glazing";
export const LABEL_ROOMS = "rooms";

export const OPEN_THE_REPORT = "Open the layout report";
export const NO_GROUP = "No group";
export const TOOLTIP_SESSION = "Set under step 02";

/** The check chip. `All checks pass` when nothing is wrong; otherwise a count
 *  of what has to be fixed, counted in things rather than in a category name.
 *  "3 must fix" is not a sentence a person would say. */
export const ALL_CHECKS_PASS = "All checks pass";
export function mustFixLabel(n: number): string {
  return `${n} thing${n === 1 ? "" : "s"} to fix`;
}

/** The chip's tooltip. Two sentences rather than one glued with an em dash. */
export function checkChipTooltip(firstFault: string): string {
  return firstFault ? `${firstFault} ${OPEN_THE_REPORT}.` : OPEN_THE_REPORT;
}

// ---- The landing, this app's own parts --------------------------------------
//
// The doors, the headline, the aside and the journey dots belong to the shared
// fragment in `_cowork/design/landing/landing.html` and are the Context copy's
// words. Nothing here restyles or rewrites them.

export const START_A_FLAT = "Start a flat";
export const BACK_TO_YOUR_FLAT = "Back to your flat";

export const FIELD_GROUP = "Your group";
export const FIELD_NAME = "Your name";

/** A placeholder is an example of what to type. `who is sending` was an
 *  instruction standing in an example's place, and it sat under a label that
 *  already asked the question. */
export const PLACEHOLDER_CODE = "room-42";
export const PLACEHOLDER_NAME = "Ana";

export const JOIN = "Join";
export const BACK = "back";
export const YOUR_GROUP_CODE = "Your group code";
export const PASS_IT_ON = "Pass this to the others so they can join.";
export const START_DRAWING = "Start drawing";

/**
 * What the landing says to a browser that has been here before.
 *
 * `Picking up where you left off` is a phrase people write and nobody says.
 * The line now says the plain thing: you were here, this is who we think you
 * are, change it if we are wrong.
 */
export function recallLine(name: string, code: string): string {
  const who = name ? `as ${name}` : "";
  const where = code ? `in ${code}` : "";
  const both = [who, where].filter(Boolean).join(" ");
  const which = who && where ? "either one" : "it";
  return `You were here before, ${both}. Change ${which} if that is not you.`;
}

/** No such group. Says what to do next, which is the only useful half. */
export function noSuchGroup(code: string): string {
  return `No group called ${code}. Check the code for a typo, or ask whoever started the group for it.`;
}

/**
 * The store is not running. A resident does not know what a store is, so the
 * sentence says what the thing does before it names the command.
 */
export function storeNotRunning(command: string, address: string): string {
  return `The app cannot reach the place your group is kept. Start it with ${command} and open ${address}.`;
}

export const COULD_NOT_START_GROUP =
  "The app could not reach the place groups are kept. Try again in a moment.";

export function couldNotAnswer(code: string): string {
  return `The app could not find out whether ${code} exists. Try again in a moment.`;
}

// ---- Step 01, drawing -------------------------------------------------------

export const DROP_A_ROOM_HERE = "Drop a room here";

/** The palette's caption while the grid is empty. */
export const EMPTY_HINT = "Drag a room onto the grid to start. Nothing is checked until you do.";

export const SEND_IT_TO_YOUR_GROUP = "Send it to your group";

/** Why the way forward is asleep. */
export const NO_WAY_IN = "Place an entrance to send the flat to the group.";

export function selectionEntrance(): string {
  return "Entrance · Floor 0";
}
export function selectionDoor(floor: number): string {
  return `Door · Floor ${floor}`;
}

export const RELAYOUT = "Re-layout";

/** The diagram's legend. Em dashes gone; each row reads as what it is. */
export const LEGEND_DOOR = "A door between them";
export const LEGEND_TOUCHING = "Touching, with no door";
export const LEGEND_ENTRY = "ENTRY, the entrance";
export const LEGEND_MUST_FIX = "Must fix";
export const LEGEND_WORTH_A_LOOK = "Worth a look";
export const LEGEND_NOTE = "Note";
export const SHOW_TOUCHING = "Show touching";
export const SHOW_DEPTH = "Show depth";

export const SHORTCUTS = "Shortcuts";
export const SHORTCUT_ROWS: { keys: string; what: string }[] = [
  { keys: "Click", what: "Select a placed room" },
  { keys: "Drag", what: "Move what is selected" },
  { keys: "R", what: "Rotate what is selected" },
  { keys: "M", what: "Mirror what is selected" },
  { keys: "S", what: "Change the way a selected door swings" },
  { keys: "Del", what: "Delete what is selected" },
  { keys: "Shift", what: "Hold and click to add to or remove from the selection" },
  { keys: "Ctrl/Cmd D", what: "Duplicate what is selected, or Shift D" },
  { keys: "Ctrl/Cmd Z", what: "Undo" },
  { keys: "Ctrl/Cmd Shift Z", what: "Redo, or Ctrl/Cmd Y" },
  { keys: "Esc", what: "Cancel what you are doing, clear the selection, or leave plan view" },
];

/** The old note named Reset View and Top View. Neither button carries those
 *  words any more: they read Frame and Plan. */
export const SHORTCUT_NOTE = "Frame and Plan are buttons only. Neither has a shortcut.";

export const UNDO = "Undo";
export const REDO = "Redo";
export const TOOLTIP_UNDO = "Undo, Ctrl+Z";
export const TOOLTIP_REDO = "Redo, Ctrl+Shift+Z or Ctrl+Y";

// The Display card. Every tooltip said what the layer is called; each one now
// says what a person will see.
export const DISPLAY = "Display";
export const DISPLAY_NOTHING_ON = "Nothing on";
export const CUTAWAY = "Cutaway";
export const TOOLTIP_CUTAWAY = "Hide the walls facing you so you can see in.";
export const SEEDS = "Seeds";
export const TOOLTIP_SEEDS = "Outline the rectangle each stretching room was drawn from.";
export const STRUCTURE = "Structure";
export const TOOLTIP_STRUCTURE =
  "Show the wet rooms and the stairs as they are built. Everything else becomes a bare floor.";
export const INTERFACE = "Interface";
export const TOOLTIP_INTERFACE =
  "Show what the building needs from this flat: the outside wall, the wet cells, the stair, the balconies and the entrance. The rest becomes one open floor.";
export const FRAME = "Frame";
export const TOOLTIP_FRAME = "Fit the whole flat in the view.";

export function compassValue(degrees: number): string {
  return `North ${degrees}°`;
}
export const COMPASS_HINT = "Drag to set. It moves the glazing.";

export const DROP_TO_OPEN = "Drop a project file here to open it.";

// Refusals while drawing. Each says what happened and why.
export const ALREADY_A_FRENCH_WINDOW = "That boundary is already a french window onto the balcony.";
export function cannotOpenUpward(what: string): string {
  return `This room cannot open upward. The floor above already holds ${what} over it.`;
}
export const NOT_DOUBLE_HEIGHT = "This room cannot be made double height.";

/** After a resize. The old line used a semicolon and carried its plural in
 *  brackets. */
export function floorResized(cols: number, rows: number, removed: number): string {
  const size = `The floor is now ${cols} by ${rows} cells.`;
  if (removed === 0) return size;
  return `${size} ${removed} thing${removed === 1 ? "" : "s"} no longer fitted and ${removed === 1 ? "was" : "were"} removed.`;
}

export const DELETE_FLOOR_CONFIRM = "Delete this floor and everything on it?";

// ---- The palette ------------------------------------------------------------

export const PALETTE_PLACE = "Place";
/** The grid takes rooms. The old caption called them tiles, and the empty
 *  state beside it called them rooms. */
export const PALETTE_CAPTION = "Drag a room onto the grid to place it. Press ? for every shortcut.";
export const PALETTE_ROOMS = "Rooms";
export const PALETTE_CIRCULATION = "Circulation and outdoor";
export const PALETTE_STRUCTURE = "Structure and access";
export const PALETTE_BRIEF = "Brief";
export const PALETTE_FLOORS = "Floors";
export const TOOL_ENTRANCE = "Entrance";
export const TOOL_ENTRANCE_WHERE = "on an outside edge";
export const TOOL_DOORWAY = "Doorway";
export const TOOL_DOORWAY_WHERE = "in an inside wall";
export const TOOL_DOUBLE_HEIGHT = "Double height";
export const TOOL_DOUBLE_HEIGHT_WHERE = "opens a room into the storey above";

// ---- Step 02, sending -------------------------------------------------------

export const SEND_CAPTION = "Your flat, as your neighbours will see it";
export const UNTITLED = "Untitled";
export const DASH = "—";
export const SEND_HEADLINE_1 = "Send it to";
export const SEND_HEADLINE_2 = "your group.";

/** Who is sending and where to, in one sentence. */
export function whoLineText(name: string, code: string): string {
  if (name && code) return `As ${name}, to ${code}.`;
  if (!name && !code) return "You have not said who you are or which group.";
  if (!name) return `To ${code}, but you have not said who you are.`;
  return `As ${name}, but you have not joined a group.`;
}

/** The top bar's line. */
export function sessionLineText(name: string, code: string): string {
  if (!code) return name ? `${NO_GROUP} · ${name}` : NO_GROUP;
  return name ? `Group ${code} · ${name}` : `Group ${code}`;
}

export const CHANGE = "change";
export const SEND_IT = "Send it";
export const GO_TO_GROUP = "Go to your group";

export function sendAnyway(n: number): string {
  return `Send anyway · ${n} thing${n === 1 ? "" : "s"} to look at`;
}

/** Left as it was. It is two short sentences that say what the group has and
 *  what pressing again does, which is what the brief asks for. */
export const GROUP_HAS_OLDER =
  "Your group still has this flat as you sent it. Sending again replaces it.";
export const NEIGHBOURS_SEE_IT = "Your neighbours see it within seconds.";

/** What the flat will be called once it is sent. `It becomes Flat 7` is not a
 *  sentence a person would say about their own drawing. */
export function itBecomes(name: string): string {
  return `Your group will see it as ${name}.`;
}

export function sentTo(code: string, label: string): string {
  return `Sent to ${code}. Your group sees it as ${label}.`;
}

export function takeoverConfirm(owner: string): string {
  return `This flat belongs to ${owner}. Take it over?`;
}

export function declinedTakeover(owner: string): string {
  return `not sent, because you chose to leave ${owner}'s flat alone`;
}

// ---- Step 02, More ----------------------------------------------------------

export const MORE = "More";
export const COLOUR = "Colour";
export const SAVE_A_COPY = "Save a copy to my computer";
export const SAVE_A_COPY_NOTE = "the whole design, the only thing that reopens for editing";
export const ADD_TO_LIBRARY = "Add to the library";
export const ADD_TO_LIBRARY_NOTE = "the unit plus a picture, browsable under Units";
export const SAVE_UNIT_FILE = "Save the unit file";
export const SAVE_UNIT_FILE_NOTE = "the contract with the building";

// ---- Toasts and confirms ----------------------------------------------------

export const DRAFT_RESTORED = "Your flat is as you left it.";

/** Every "Import failed" line now says what could not be done, in the words a
 *  person uses for it: they opened a project, they did not import one. */
export function couldNotOpen(detail: string): string {
  return `Could not open that project. ${detail}`;
}
export const FILE_MAY_BE_DAMAGED = "The file may be damaged.";
export const COULD_NOT_READ_FILE = "Could not read that file.";
export const PROJECT_OPENED = "Project opened.";

export function roomsNotPlaced(n: number): string {
  return `${n} room${n === 1 ? "" : "s"} could not be placed.`;
}

export function olderFileOpened(version: number): string {
  return `This file was made with an older version of the app (v${version}). It opened fine.`;
}

export function newerFileOpened(fileVersion: number, appVersion: number): string {
  return `This file was made with a newer version of the app (v${fileVersion}, this app is v${appVersion}). Some things may be missing.`;
}

export function newerFileConfirm(version: number): string {
  return `This file was made with a newer version of the app (v${version}). It may not open correctly. Open it anyway?`;
}

export const REPLACE_LAYOUT_CONFIRM = "This will replace the flat you have now. Continue?";
export const LOAD_PROJECT_CONFIRM = "Open this project?";

export function renamed(id: string, name: string): string {
  return `Renamed ${id} to "${name}".`;
}

export function deleted(name: string, files: number): string {
  return `Deleted "${name}" and ${files} of its file${files === 1 ? "" : "s"}.`;
}

export function noSourceProject(file: string): string {
  return `${file} does not carry its design, so there is nothing to open.`;
}

export function couldNotReadNamed(file: string, detail: string): string {
  return `Could not read ${file}. ${detail}`;
}

export function libraryReplaceConfirm(name: string, id: string, savedAt: string): string {
  return (
    `The library already holds "${name}" (${id}, saved ${savedAt}).\n\n` +
    `OK replaces that entry. Cancel keeps it and adds a second one under a new id.`
  );
}

// ---- The layout report ------------------------------------------------------

/** What a saved thing is called in the results list. */
export const OUTPUT_PROJECT = "Project file";
export const OUTPUT_UNIT = "Unit file";
export const OUTPUT_LIBRARY = "Library entry";
export const OUTPUT_GROUP = "Group";

// ---- The 42 rules' advisory lines -------------------------------------------
//
// Read in the layout report, one per finding. `src/core/rules.ts` holds the
// rules themselves as data and takes its wording from here, so the rules stay
// a table of thresholds and checks and their words stay with every other word.
//
// The old lines were written for whoever wrote the rule. They glued two clauses
// with an em dash, and they used words a resident has no reason to know:
// orphaned, reachability, leaf space, privacy gradient, hops, dwelling. Each one
// now says what is wrong in the flat on the screen, and where a rule exists
// because of a habit or a regulation, it says so.

export const RULE_WORDS: Record<string, string> = {
  E1: "This flat has no entrance yet. The entrance is where the building meets the flat.",
  E1_BLOCKED:
    "Every entrance is blocked. None of them opens to the outside any more, so there is no way in to check from.",
  E2: "This entrance is blocked. Its edge no longer faces outside.",
  DR1: "No doors are placed. Two rooms that touch are not connected until a door joins them.",
  DR2: "This bedroom has more doors than a private room usually has.",
  P1: "A flat needs a bathroom.",
  P2: "A flat needs a kitchen.",
  P3: "There is more than one kitchen. That is unusual and it is allowed.",
  P4: "A flat needs a bedroom. Place one so there is somewhere to sleep.",
  MB1: "This floor has bedrooms and no bathroom.",
  H1: "There is no way to reach this room from an entrance, through doors or up a stair.",
  H2: "The only way to this room or stair from an entrance goes through a bathroom.",
  H3: "The only way to this room or stair from an entrance goes through a bedroom.",
  H4: "A door joins a bathroom straight to a kitchen. Food is prepared on the other side of it.",
  S6: "The kitchen and the bathroom share a wet wall. Their pipes can run together.",
  H6: "The only way to this room or stair from an entrance goes through an outdoor space.",
  C1: "This circulation space connects to nothing, so nobody can use it.",
  C2: "This circulation space connects to one room only, so nobody passes through it.",
  A1: "This circulation is narrower than 1.2 m. A wheelchair needs 1.2 m.",
  O1: "Nothing opens onto this outdoor space.",
  OD1: "There is no way to reach this outdoor space from inside the flat.",
  ST3: "No stair reaches this floor from the floor the entrance is on.",
  ST1: "This stair reaches nothing on one of the two floors it joins.",
  ST2: "There is no way to reach this stair from an entrance.",
  D1: "This room has no outside wall, so no daylight can reach it.",
  D2: "This kitchen has no outside wall, so it cannot be aired by a window.",
  W1: "This room has less glazing than its daylight target asks for.",
  OR1: "This room is lit from the north only, so no direct sun reaches it.",
  OR2: "All of this room's glazing faces the direction this project asks to avoid.",
  G1: "Every bathroom is behind a bedroom, so a guest has nowhere to go.",
  G2: "The entrance opens straight into a private room.",
  S1: "This outdoor space has more than two doors. It is usually somewhere you end up rather than pass through.",
  S2: "This living room has one door or none. It is usually the room everything else opens onto.",
  S3: "This bedroom opens straight onto a kitchen, living room or recreation room. A bedroom is usually reached through something quieter.",
  AC1: "This bedroom shares a wall with a stair. People on the stair will be heard.",
  S5: "A door joins the kitchen and the living room, so the two are open to each other. That is fine, and it is noted so you know it was read that way.",
  S7: "This bathroom is reached through a bedroom, so it is en suite.",
  N1: "Much of the floor area is circulation, so less of it is left to live in.",
  PG1: "The bedrooms are closer to the entrance than the living spaces. Usually it is the other way round.",
  WET1: "The wet rooms are in separate groups on this floor. Pipes then run a long way and cannot bundle into one shaft to the storey above.",
  FAC1: "This habitable room has no facade. It touches neither open sky nor a balcony, and PBG LS 700.1 § 302 asks every habitable room for a facade window.",
};

/** DR2 counts the doors it found. */
export function bedroomDoors(n: number): string {
  return `This bedroom has ${n} door${n === 1 ? "" : "s"}. A private room usually has one.`;
}

/** MB1 names the floor. */
export function floorHasNoBathroom(floor: number): string {
  return `Floor ${floor} has bedrooms and no bathroom.`;
}

/** DP1 and F1 read their thresholds from `src/core/rules.ts`, so the numbers on
 *  screen stay the numbers the rule checks. */
export function roomIsDeep(hops: number): string {
  return `This room is deep in the flat. Getting to it from the entrance passes through ${hops} rooms or more.`;
}
export function roomIsFarFromAWayOut(hops: number): string {
  return `This room is far from a way out. Getting to the nearest entrance or stair passes through more than ${hops} rooms.`;
}

// ---- Opening a file that will not open --------------------------------------
//
// Found by the finishing pass, on screen: these four are what a person reads
// under `Could not open that project.`, and the inventory had missed them. They
// named JSON, a format identifier and a voxel prop, and one of them was a
// contrast construction of exactly the shape the guide strikes out.

export const FILE_NOT_READABLE = "This file cannot be read. It may be damaged.";
export const FILE_NOT_OURS = "This file is not one this app wrote.";
export const FILE_IS_A_PROP = "That is a single piece of furniture. A project file holds a whole flat.";
export const FILE_WRONG_FORMAT =
  "This file is not one this app wrote. It may have come from another program.";

// ---- The lines a rule builds about one room ---------------------------------
//
// Found by the finishing pass, in the layout report on screen: nine rules do
// not show their own line but build one naming the room, the floor or the
// count. The inventory had listed two of them and missed seven, so seven em
// dashes and four bracketed asides survived the first pass.

/** A1: how many cells of this circulation are too narrow. */
export function narrowCirculation(cells: number): string {
  return `This circulation is narrower than 1.2 m across ${cells} cell${cells === 1 ? "" : "s"}. A wheelchair needs 1.2 m.`;
}

/** ST1: which of the stair's two ends reaches nothing. */
export function stairReachesNothing(where: string): string {
  return `This stair reaches nothing at the ${where}.`;
}

/** ST3: which floors are cut off. */
export function floorsNotReachable(list: string, many: boolean): string {
  return `${list} ${many ? "are" : "is"} not reachable by stairs from the floor the entrance is on. Every space there is cut off for this one reason.`;
}

/** OR2: which way this room's glazing faces. */
export function glazingFaces(sectors: string): string {
  return `All of this room's glazing faces ${sectors}, which this project asks to avoid.`;
}

/** DP1 and F1, once they know the room's own depth. */
export function roomIsThisDeep(hops: number): string {
  return `This room is deep in the flat. Getting to it from the entrance passes through ${hops} rooms.`;
}
export function roomIsThisFar(hops: number): string {
  return `This room is far from a way out. Getting to the nearest entrance or stair passes through ${hops} rooms.`;
}

/** N1, for the whole flat and for one floor. */
export function circulationHeavy(percent: number): string {
  return `${percent}% of the floor area is circulation, so less of it is left to live in.`;
}
export function floorCirculationHeavy(floor: number, percent: number): string {
  return `On floor ${floor}, ${percent}% of the area is circulation, so less of it is left to live in.`;
}

/** WET1, once it knows the floor and where the groups are. */
export function wetRoomsSplit(floor: number, groups: number, where: string): string {
  return `On floor ${floor} the wet rooms form ${groups} separate groups, at ${where}. Pipes then run a long way and cannot bundle into one shaft to the storey above.`;
}

/** FAC1, naming the room. */
export function roomHasNoFacade(room: string): string {
  return `${room} has no facade. It touches neither open sky nor a balcony, and PBG LS 700.1 § 302 asks every habitable room for a facade window.`;
}

// ---- The layout report's own furniture ---------------------------------------
//
// Also found by the finishing pass. The 33 fix hints beside each fault were
// already short imperative sentences in plain words and are left alone. Two
// things were not: the strip of numbers under the heading read as a list of
// measures with no plain reading, and one chip said dwelling where the rest of
// the app says flat.

export const WHOLE_FLAT = "The whole flat";
export const CHECKED_JUST_NOW = "checked just now";

/** The circulation share, with the per-floor rider on a flat of more than one
 *  floor. A percentage never stands on its own; it says what it is a share of. */
export function circulationShare(percent: number, perFloor: string): string {
  const head = `Circulation is ${percent}% of the inside`;
  return perFloor ? `${head} (${perFloor})` : head;
}
export function floorShare(floor: number, percent: number): string {
  return `${percent}% on floor ${floor}`;
}

/** How far into the flat the rooms sit, in rooms rather than in hops. */
export function depthSummary(max: number, mean: string): string {
  return `The deepest room is ${max} rooms from the entrance, ${mean} on average`;
}

/** Where the living spaces sit against the bedrooms. */
export function privacyGradient(publicMean: string, bedroomMean: string): string {
  return `Living spaces sit ${publicMean} rooms in, bedrooms ${bedroomMean}`;
}

// ---- The rooms, by their plain names ----------------------------------------
//
// Every room carries a stored name, `def.name` in `src/core/modules.ts`, and
// that name travels: `src/core/adjacencyGraph.ts:170` and `:202` copy it into
// every graph node's `label`, and `src/core/unitExport.ts:213` copies it into
// the exported unit's `roomTypes`, which is a bridge-format payload the
// building app reads. Renaming a preset would therefore change a file format
// and break every flat already sitting in a group.
//
// So the stored name stays and the screen shows a plain one instead. Sixteen of
// the twenty stored names glue two words with an em dash, which is the guide's
// first rule, and they read as a catalogue rather than as rooms: "Bedroom —
// Small" is how a parts list writes it and "Small bedroom" is how a person says
// it.
//
// The same table is in `_cowork/design/room-names.md`, byte for byte, so the
// building app can copy it and the two apps say the same words about the same
// room (run 0043).
//
// This absorbs the one-line rename `paletteName` did in `src/ui/palette.ts`
// before this run, which turned Circulation into Hall on the palette alone.
// Every screen now reads the same word.

export const ROOM_NAMES: Record<string, string> = {
  "Stair — Straight": "Straight stair",
  "Stair — Dogleg": "Dogleg stair",
  "Stair — Dogleg, generous": "Generous dogleg stair",
  "Stair — Spiral": "Spiral stair",
  "Stair — C, three flights": "C stair, three flights",
  "Stair (dogleg, retired)": "Dogleg stair, retired",
  "Living Room": "Living room",
  Kitchen: "Kitchen",
  "Bedroom — Small": "Small bedroom",
  "Bedroom — Large": "Large bedroom",
  "Bathroom — Small": "Small bathroom",
  "Bathroom — Large": "Large bathroom",
  "WC — minimal": "Minimal WC",
  "Bathroom — Full": "Full bathroom",
  "Bathroom — Full, compact": "Compact full bathroom",
  "Recreation Room": "Recreation room",
  "Circulation — Single": "Single hall",
  "Circulation — Double": "Double hall",
  "Outdoor — Single": "Single outdoor space",
  "Outdoor — Double": "Double outdoor space",
};

/**
 * What a person reads for a room, given the name the file stores.
 *
 * The stored name is the fallback, so a preset added later shows something
 * rather than nothing, and a name that has already travelled into a flat file
 * still reads. `src/core/words.test.ts` checks that every name in
 * `src/core/modules.ts` has a row here, so the fallback is a safety net rather
 * than a way of quietly skipping one.
 */
export function roomName(stored: string): string {
  return ROOM_NAMES[stored] ?? stored;
}
