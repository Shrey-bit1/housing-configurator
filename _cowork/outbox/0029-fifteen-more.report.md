---
id: "0029"
title: Fifteen more flats, a bedroom in every one, and a way to delete
source: 0029-fifteen-more.md
status: complete
branch: run/0029
commit: 36f5b00
completed: 2026-09-04
---

## Summary

The library now holds twenty flats this project designed, `unit-8` through
`unit-27`, and every one of them carries zero must-fix findings from the app's
own `validate()`. A new hard rule, P4, says a dwelling needs a bedroom; it
turned exactly one existing flat red, run 0028's Flat 08, which is redrawn here
as a proper one-bedroom. Every library card grew a Delete control that asks
first, names the flat, and refuses the one open in the editor. A second
reference study went looking for housing the first study's rules cannot
describe, and found that the app's rules are the signature of one household
model rather than architectural law. The run also fixed a real generator bug
that would have broken every maisonette from here on.

This run was attempted once before and stopped at its first assumption, because
`main` did not carry run 0028. The blocked report for that attempt is in git at
`be8c4ee`. Shrey merged run 0028 into `main` at `6e081d8`, and this is the
second attempt.

## What I did

- `src/core/rules.ts:586-600` — added rule P4, `severity: "hard"`.
- `src/ui/validationPanel.ts:55` — its suggested move, "place a bedroom".
- `docs/rules-reference.html:242`, `:304`, and the two "All 42 rules" headings —
  the rule's prose, its lookup row, and the count. PDF rebuilt at 276874 bytes.
- `src/library/unitBrowser.ts` — `deleteConfirmText` and `deleteRefusal`, the
  `onDelete` and `openUnitId` options, the Delete control on each card, and
  `notice()`, a message that does not wipe the grid.
- `vite.config.ts:235-283` — `POST /__library/delete`.
- `src/main.ts` — `openLibraryUnitId`, cleared in `importProjectText`, set after
  a library open; the `onDelete` and `openUnitId` wiring.
- `scripts/flatLayout.ts` — the `gap` slot, and `deriveDoors` now takes
  `storeyOf`.
- `scripts/gen-flat.mjs` — `checkEmptySpace` replaces `checkVoidsEnclosed` and
  checks gaps the other way round; the storey map for doors.
- Created `scripts/flats/unit-13.flat.json` through `unit-27.flat.json` and
  rewrote `unit-8.flat.json`; created `public/units/unit-13.json` through
  `unit-27.json` and their `.jpg` previews; fifteen new manifest rows and one
  rewritten.
- Created `_cowork/outbox/0029-reference-plans-2.md` (277 lines) and
  `_cowork/outbox/0029-contact-sheet.jpg` (2436 by 2332, 1156855 bytes).
- Tests in `src/core/rules.test.ts`, `src/library/unitBrowser.test.ts`,
  `scripts/flatLayout.test.ts` and `src/core/libraryClean.slow.test.ts`.
- `PROJECT_STATE.md:3537`, `:3552`, `:4292` and `_cowork/CONTEXT.md:257`,
  `:286`, `:330`.

## Findings

**The app's rules are one household model, not architectural law.** The second
study read Hunziker Areal Haus A, a built and awarded Zürich cooperative
building, and it breaks all four patterns the first study found at once. Its
entrance goes through a named Garderobe into a shared hall of 22.5 to 31.7 m²
that is a room. Its circulation is a large fraction of a 398.9 m² cluster flat
and is the point of it. Its private rooms each have their own bath of 3.2 to
6.3 m², so the wet rooms are distributed round the ring rather than gathered
with the kitchen. As the rules stand, this app cannot express it.

**A door on one storey was blocking a door on the other.** Both storeys of a
maisonette are drawn on the same grid coordinates, and `deriveDoors` kept its
used-edge set in plain plan coordinates. So a ground-floor door reserved the
physical edge a first-floor door needed at the same place, and the second one
failed with "the two rooms share no straight boundary" on a boundary it plainly
shared. Two flats hit it, and one subagent diagnosed it independently and named
the line. Fixed by keying that set per storey.

**Rows that are left-aligned can only make a staircase.** Every row of the
packer starts at the flat's own west edge, so before this run the outline could
step but never indent. A `gap` slot, space the flat is not in, is what unlocks
the L with a re-entrant corner. It has to be checked as the exact inverse of a
growth void: a gap must reach the grid border, because one that cannot is an
enclosed pocket that an elastic room absorbs, taking the hole the plan was drawn
around with it.

**A maisonette cannot reach the reference circulation range.** The reference
plans run 5 to 15 per cent. The five two-storey flats run 29, 38, 36, 30 and 32
per cent, because rule N1 counts a stair as circulation and a stair sits on both
storeys with a corridor reaching it on each. This is structural, not sloppiness:
Flat 23's subagent reported that the alternative, putting the stair mid-row,
pushes the kitchen-to-bath wet gap to 4 cells.

**Only one existing flat failed the new rule.** Running every flat and every
fixture against P4 turned exactly `public/units/unit-8.json` red. The already
quarantined `unit-5.json` holds a `bedroom_large`, so P4 does not fire on it and
its quarantine list is unchanged.

## Evidence

**1. Commits, the branch, and the state found on `main`.**

`main` was at `6e081d8`, "Merge run/0028: five flats for the library, the first
batch". Work is on `run/0029`, branched from that commit. Eight commits:

| hash | message | stats |
|---|---|---|
| `249e715` | rules: a dwelling needs a bedroom | 4 files, +25 -4 |
| `7909396` | library: flat 08 gets a bedroom | 4 files, +493 -379 |
| `dc3ab4a` | library: what other housing does | 1 file, +277 |
| `9063006` | library: a card can be deleted | 3 files, +171 -5 |
| `c3a37bd` | library: fifteen more flats | 32 files, +34575 -11 |
| `3feefb7` | library: twenty flats, all clean | 1 file, +13 |
| `faf9fbc` | library: twenty on one sheet | 17 files, +150 |
| `36f5b00` | library: tests for 0029 | 3 files, +148 -5 |

The preview ran on `http://localhost:52821`.

**2. The wider reading.** Written to `_cowork/outbox/0029-reference-plans-2.md`.
Two plans were read properly and the rest are reported from text, each saying
so.

Frei Otto's Ökohaus, Berlin, 1983 to 1992: three concrete tables with slabs at
6.00 and 12.00 m leaving two-storey voids that residents filled with their own
houses. House 12's ground floor was read with dimensions from
`solidar-architekten.de`: a 10.92 by 14.44 m structural bay holding a skewed
dwelling of roughly 8 by 14 m, printed room areas of 26.1, 13.5, 11.6 with 5.8,
7.9, 7.6, 5.0, 4.2 and 3.6 with 0.8 m², about 79.5 m². Its 7.6 m² kitchen is
annotated "OBERLICHT OHNE DIREKTEN AUSBLICK", lit by a rooflight with no facade
window. Graph, from legible door swings with names inferred from fixtures:
`entrance and stair → hall (5.0); hall → bath, three rooms, kitchen; a room →
living (26.1); living → terrace`. Circulation 6.3 per cent. The unit count could
not be reconciled: three sources say 18, 26 and 27. **This shaped Flats 14, 16
and 24**, the three with a landlocked kitchen.

Mehr als Wohnen, Hunziker Areal, Haus A, Duplex Architekten, 2015: the Planheft
run 0028 never reached. `WebFetch` cannot open it and the Google Docs viewer
route was refused, so it was downloaded and its pages rendered. The first-floor
sheet gives two cluster flats at 12.5 rooms and 398.9 m² and 10.5 rooms and
323.5 m², an irregular six-sided ring with printed overall dimensions of 43.10,
40.54, 31.66, 25.90, 23.75, 21.81, 22.00, 12.10 and 9.85 m, shared Wohnküche and
living rooms of 41.8 to 48.7 m², shared halls of 22.5 to 31.7 m², and ten to
twelve private satellites of 13.6 to 22.8 m² each with its own bath. Graph:
`entrance → Garderobe; Garderobe → shared hall; hall → shared Wohnküche, Büro,
Waschraum and each satellite; each satellite → its own bath`. **This shaped no
flat directly and is the reason for open question 1**, because the app cannot
express it.

Kalkbreite: the WBS object document was read and the Grosshaushalt plan examined
at high zoom. 89 apartments and 269 rooms by that table, against 97 units
elsewhere, unreconciled. **The rooms are unnamed and no areas are printed, so no
graph is given.** Its readable geometry, a through-block section 13 to 14 m deep
with rooms on both opposite facades and a served central spine, **shaped Flats
21 and 26**.

Habitat 67: **no plan read.** From text: 354 to 365 modules of 11.7 by 5.3 by
3.0 m, 158 dwellings in 15 types from 56 to 167 m², 60 per cent of them two
modules. **Its stacked-rooms idea shaped Flat 27**, whose sleeping floor sits
below its living floor.

Habraken and Open Building: the SAR method's zones and margins on a 30 cm tartan
grid, from a peer-reviewed article's text rather than a drawing. Molenvliet, 123
dwellings from 67 unit types. **No support or infill plan read.**

PREVI and Quinta Monroy: **no plan read for either.** PREVI's Stirling unit is
described in prose as four columns round a central patio with a second courtyard
at the plot corner carrying the services; that prose **shaped Flat 13's
re-entrant patio corner**. Quinta Monroy delivers about 30 to 36 m² of a 72 m²
house, structure and wet rooms and stair, with an equal void alongside; that
**shaped Flat 19**, the narrow two-storey bay.

Kaisersrot: **no dwelling plan found and unlikely to exist.** It works at plot
scale. `kaisersrot.com` refused the connection and the ETH wiki returned 403, so
this is from search summaries and **no built scheme could be confirmed**.

**3. The new rule.** Id `P4`, severity `hard`, message
"A dwelling needs a bedroom — place one so the flat has somewhere to sleep."
It is in the programme family beside P1 and P2 and is written in their shape:
if no node satisfies `ctx.is.bedroom`, one finding with no node ids.

Run against every flat in `public/units/` and every fixture in `testflats/`:

```
--- testflats ---
flat-1-no-stair.json               panel  7 (1 hard, 6 soft)  note 4   HARD: ST3
flat-1-two-storey.json             panel 12 (1 hard, 11 soft)  note 5   HARD: H1
flat-2-single-storey.json          panel  2 (0 hard, 2 soft)  note 1   clean
flat-3-terrace.json                panel  3 (0 hard, 3 soft)  note 1   clean
--- public/units ---
unit-5.json                        panel  7 (4 hard, 3 soft)  note 1   HARD: P1, H1, ST3, ST2
unit-8.json                        panel  1 (1 hard, 0 soft)  note 1   HARD: P4
(every other flat: clean)
```

**Exactly one flat fails, `unit-8.json`.** It was drawn in run 0028 as one room
plus a kitchen and has no bedroom at all. Nothing else moves: `unit-5.json`
still fails its existing four and P4 is not among them, because it holds a
`bedroom_large`.

**Both baselines are unchanged, before and after: 12 and 7.**
`flat-1-two-storey.json` reads 1 hard plus 11 soft, and `flat-1-no-stair.json`
reads 1 hard plus 6 soft. Both fixtures hold bedrooms, so P4 is silent on them
and neither file was touched. `git diff --name-only main -- testflats/` returns
nothing.

**4. The twenty.**

| name | storeys | m² | rooms | graph in one line | reference |
|---|---|---|---|---|---|
| Flat 08 — one bedroom, corner | 1 | 44.28 | 4 | entrance → entree; entree → living, bed1, kitchen, bath; living – loggia | Zwischenbächen C |
| Flat 09 — two rooms, hall between | 1 | 51.48 | 4 | entrance → entree; entree → living, bed1, kitchen, bath; living – loggia | Zwischenbächen C |
| Flat 10 — two rooms, off the living room | 1 | 56.88 | 5 | entrance → entree; entree → living, kitchen, bath; dining → bed1, loggia | Else Züblin West |
| Flat 11 — three rooms, deep hall | 1 | 70.20 | 6 | entrance → diele; diele → living, bed1, kitchen, bath, bed2; wc lobby – wc; living – loggia | Volkswohnung WHG 3 |
| Flat 12 — four rooms, maisonette | 2 | 110.88 | 7 | entrance → entree; entree → living, kitchen, bath, dining, stair; corridor → bed1, bed2, bed3, terrace | Zwischenbächen D |
| Flat 13 — one bedroom, patio corner | 1 | 42.84 | 4 | entrance → entree; entree → bed1, living, kitchen, bath; living – patio | Zwischenbächen C with PREVI's patio corner |
| Flat 14 — one bedroom, inner kitchen | 1 | 42.84 | 4 | entrance → entree; entree → living, bed1, bath, kitchen; kitchen – loggia | Ökohaus House 12 |
| Flat 15 — one bedroom, stepped | 1 | 36.36 | 4 | entrance → entree; entree → living, bed1, kitchen, bath | Volkswohnung WHG 1 |
| Flat 16 — two rooms, inner kitchen | 1 | 50.76 | 4 | entrance → entree; entree → living, bed1, bath, kitchen; kitchen – loggia | Ökohaus House 12 |
| Flat 17 — two rooms, wide hall | 1 | 54.36 | 5 | entrance → hall; hall → living, kitchen, bath, bed1; living – dining; dining – loggia | Else Züblin West |
| Flat 18 — two rooms, stepped south | 1 | 51.48 | 5 | entrance → entree; living → bed1, loggia; entree → kitchen, bath; wcp – wc | Manegg 1 at 3.5 rooms |
| Flat 19 — two rooms, maisonette | 2 | 64.80 | 4 | entrance → entree; entree → living, kitchen, bath, stair; landing → stair, bed1 | Quinta Monroy |
| Flat 20 — two rooms, corner turn | 1 | 54.00 | 4 | entrance → entree; entree → living, bed1, kitchen, bath; kitchen – terrace | Zwischenbächen C |
| Flat 21 — three rooms, through | 1 | 71.28 | 7 | entrance → spine; spine → living, dining, bed1, bed2, kitchen, bath; wcp – wc; living – dining | Kalkbreite Grosshaushalt |
| Flat 22 — three rooms, deep hall | 1 | 73.80 | 5 | entrance → diele; diele → living, bed1, kitchen, bath, bed2; living – loggia | Volkswohnung WHG 3 |
| Flat 23 — three rooms, maisonette | 2 | 84.60 | 5 | entrance → entree; entree → living, kitchen, bath, stair; landing → bed1, bed2, terrace; wcp – wc | Zwischenbächen D |
| Flat 24 — three rooms, inner core | 1 | 78.48 | 7 | entrance → hall; hall → living, bed1, bed2, bath, kitchen, dining; wcp – wc; dining – loggia | Ökohaus House 12 |
| Flat 25 — four rooms, maisonette | 2 | 114.12 | 7 | entrance → entree; entree → living, kitchen, bath, stair; landing → bed1, bed2, bed3, terrace; wcp – wc | Manegg 1 at 4.5 rooms |
| Flat 26 — four rooms, long spine | 1 | 95.04 | 7 | entrance → spine; spine → living, dining, bed1, bed2, bed3, loggia; kpad – kitchen; bpad – bath; wcp – wc | Obsthalden |
| Flat 27 — four rooms, upside down | 2 | 113.76 | 7 | entrance → hall; hall → bed1, bed2, bed3, bath, kitchen, stair; landing → living, roof; dining – terrace | Habitat 67 |

The mix is three small at 36.36 to 42.84, five medium at 50.76 to 64.8, four
large at 70.2 to 84.6, three extra large at 95.04 to 114.12, and five over two
storeys counting Flat 12. The room counts above are what the app's `roomTypes`
reports, which counts a dining room and a bathroom as rooms; in the Swiss count
the study describes, the four bands are one, two, three and four rooms as the
prompt asked.

**5. The check result for all twenty.** Zero must-fix on every one. Worth-a-look
and note per flat, in id order: 1+1, 1+1, 1+1, 3+1, 4+1, 1+1, 2+1, 2+1, 2+1,
2+1, 1+1, 4+1, 2+1, 3+1, 3+1, 5+1, 4+1, 4+1, 4+1, 5+1. The single note is S6 in
every case, the engine observing the kitchen and bathroom share a wall.

Raw generator output for five of them:

```
=== unit-13 — Flat 13 — one bedroom, patio corner
  storeys 1   instances 18   area 42.84 m²
  doors written 5, kept by the app 5   skipped placements 0
  must fix 0   worth a look 1   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room …
  wet rooms kitchen, bath   widest gap per storey 0 cells

=== unit-14 — Flat 14 — one bedroom, inner kitchen
  storeys 1   instances 24   area 42.84 m²
  doors written 5, kept by the app 5   skipped placements 0
  must fix 0   worth a look 2   note 1
  wet rooms kitchen, bath   widest gap per storey 0 cells

=== unit-21 — Flat 21 — three rooms, through
  storeys 1   instances 34   area 71.28 m²
  doors written 9, kept by the app 9   skipped placements 0
  must fix 0   worth a look 3   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ OR1  Room is lit only from the north (no direct sun).
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room …
    ~ S3  Bedroom directly adjacent to a kitchen, living room, or recreation room …
  wet rooms kitchen, wc, bath   widest gap per storey 2 cells

=== unit-25 — Flat 25 — four rooms, maisonette
  storeys 2   instances 71   area 114.12 m²
  doors written 14, kept by the app 14   skipped placements 0
  must fix 0   worth a look 4   note 1
    ~ MB1  Floor 1 has bedrooms but no bathroom.
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ N1  Circulation-heavy layout (30% of interior area).
    ~ N1  Floor 0 is circulation-heavy (33% of interior area).
    ~ N1  Floor 1 is circulation-heavy (27% of interior area).
  wet rooms kitchen, wc, bath   widest gap per storey 2, 0 cells

=== unit-27 — Flat 27 — four rooms, upside down
  storeys 2   instances 62   area 113.76 m²
  doors written 13, kept by the app 13   skipped placements 0
  must fix 0   worth a look 5   note 1
    . S6  Shared wet wall between kitchen and bathroom — efficient services.
    ~ OR1  Room is lit only from the north (no direct sun).
    ~ N1  Circulation-heavy layout (32% of interior area).
    ~ N1  Floor 0 is circulation-heavy (30% of interior area).
    ~ N1  Floor 1 is circulation-heavy (35% of interior area).
    ~ PG1  Inverted privacy gradient — bedrooms are shallower than living spaces.
  wet rooms kitchen, wc, bath   widest gap per storey 2, 0 cells
all clean
```

Flat 27's PG1 is the intended finding: the sleeping floor is below the living
floor, which is the Habitat 67 inversion this flat exists to test.

**6. Wet rooms, the fifteen.** All on one storey in every case, and on the lower
storey in all four new maisonettes.

| flat | storey | kitchen | bath | WC | widest gap |
|---|---|---|---|---|---|
| Flat 13 | 0 | yes | yes | none | 0 |
| Flat 14 | 0 | yes | yes | none | 0 |
| Flat 15 | 0 | yes | yes | none | 0 |
| Flat 16 | 0 | yes | yes | none | 0 |
| Flat 17 | 0 | yes | yes | none | 0 |
| Flat 18 | 0 | yes | yes | yes | 2 |
| Flat 19 | 0 | yes | yes | none | 0; storey 1 holds none |
| Flat 20 | 0 | yes | yes | none | 0 |
| Flat 21 | 0 | yes | yes | yes | 2 |
| Flat 22 | 0 | yes | yes | none | 0 |
| Flat 23 | 0 | yes | yes | yes | 2; storey 1 holds none |
| Flat 24 | 0 | yes | yes | yes | 2 |
| Flat 25 | 0 | yes | yes | yes | 2; storey 1 holds none |
| Flat 26 | 0 | yes | yes | yes | 2 |
| Flat 27 | 0 | yes | yes | yes | 2; storey 1 holds none |

Every 2 is the kitchen and the bath separated by a WC two cells wide, so all
three sit in one continuous run and one shaft serves them.

**7. Variety: what was managed and what was not.**

Managed, and new since run 0028. **The L with a re-entrant corner**, Flat 13,
where a `gap` in the south row holds the patio, after PREVI. **The stepped
edge**, Flats 15 and 18, where each row stops short of the last. **The deep plan
with a landlocked room**, Flats 14, 16 and 24, whose kitchens are enclosed on
all four sides after the Ökohaus, though Flat 24's south neighbour is an outdoor
pad rather than a room, so it has a semi-exterior edge and reports W1 for
glazing below target. **The through-flat**, Flats 21 and 26, with habitable
rooms on two opposite facades and a two-cell spine between them, after
Kalkbreite. **The inverted section**, Flat 27, sleeping below and living above,
after Habitat 67.

Not managed, with the reason each time. **The closed ring and the courtyard**,
which Hunziker Haus A and Kalkbreite both are. A hole inside the outline is an
enclosed pocket, and the app hands enclosed pockets to the nearest elastic room,
so a courtyard becomes floor area. This is not a packer limitation but an app
one: `computeExpansion` in `src/core/expansion.ts` has no notion of a void that
is meant to stay void. **Split level**, which the Ökohaus and Habitat 67 both
are. A storey here is a whole storey; there is no way to say a room sits half a
level up. **The non-orthogonal outline**, which Ökohaus House 12 is, with its
dwelling boundary at an angle to the structural bay. Every module is an
axis-aligned rectangle on a 0.6 m grid. **A compact central hall serving every
room**, which is what a square Diele would be. A two-cell spine reaches
everything because it is long; a square hall touches only its four neighbours,
and with six rooms to serve it cannot. That is why every hall in these twenty is
a band.

**8. Delete.** The confirm reads
`Delete "<name>" from the library? This cannot be undone.` and is produced by
`deleteConfirmText`.

On a decline nothing happens: `window.confirm` returns false and the handler
returns before `onDelete` is called. Measured live, pressing Delete on Flat 10
left the manifest at fourteen rows, the same as before.

When the flat is open in the editor the control refuses before it asks or sends
anything, with `"<name>" is the flat you have open. Open something else first,
then delete it.` Measured live: after opening a copy of Flat 09, its Delete
answered
`"Flat 09 — two rooms, hall between" is the flat you have open. Open something
else first, then delete it.` and all fourteen cards stayed on screen.

A real delete was proved through the endpoint on a planted throwaway entry,
because `window.confirm` cannot be accepted under scripting:

```
{"ok":true,"id":"zz-probe","removed":["zz-probe.json","zz-probe.jpg"],"remaining":14}
```

and `index.json` was byte-identical to before the probe was planted. The
refusals: a missing id answers
`{"ok":false,"error":"no entry with id \"no-such-flat\""}`, a body with no id
answers `{"ok":false,"error":"missing id"}`, and a GET answers
`{"ok":false,"error":"POST only"}`.

**9. Subagents.** Five launched, one for the reading and four for tuning. All
five finished, which is the opposite of run 0028, where ten launches produced
nothing.

The reading agent got the eight projects, the browser-pane route for reading a
PDF that run 0028 wrote down, and a 2500-word cap. It returned in 8.7 minutes
with two plans read properly and honest refusals for the rest.

The four tuning agents were given what run 0028's report said to give them: a
starting layout that already runs, and a tool that prints a verdict, so the job
is tuning rather than open-ended design behind two long documents. The split was
Flats 17, 18 and 19; Flats 21 and 22; Flats 23 and 24; Flats 25, 26 and 27. Each
also got one shared 120-line brief with the module sizes, the slot kinds and the
five rules that produce the generator's errors, and each was told which specific
error its flats reported and where to look. They took 5 to 26 tool calls each.
The five flats I kept, 13 to 16 and 20, were the ones that already passed.

What the verification caught. The agent on Flats 23 and 24 diagnosed the
per-storey door bug independently, naming `taken` in `flatLayout.ts` and
observing that a 12-wide corridor offers only one anchor, which is the same
conclusion I reached from Flat 19. Its first fix, widening both corridors to 14
so each door gets its own anchor, would have worked but at the cost of a wider
flat; the generator fix made it unnecessary. Nothing a subagent produced was
wrong in a way the checks missed, because the checks are what they worked
against.

**10. Test counts, fixtures and downloads.** The fast suite goes from 244 in
eighteen files to **256 in eighteen**: four for P4 in `rules.test.ts`, six for
the delete helpers in `unitBrowser.test.ts`, and two in `flatLayout.test.ts` for
the gap slot and the per-storey door bookkeeping, less one case removed that
asserted only `not.toThrow`. The slow suite goes from `41 passed | 1 expected
fail` to **`57 passed | 1 expected fail`** in four files, the extra sixteen being
the fifteen new library files plus the case that names the twenty.

Both fixture baselines are unchanged at **12 and 7**, measured before and after
the rule was added. `testflats/` shows zero changed lines against `main`.
`src/core/saveFiles.ts` and `src/core/savePlan.ts` are untouched and
`saveFiles.test.ts` passes its eight cases, so **the three downloads stay
byte-identical**. `src/core/modules.ts` and `docs/bridge-format.md` are
untouched, as the constraints require. `npx tsc --noEmit` is clean and
`npm run build` finishes in 6.88 s with only the standing chunk-size warning.

**11. The skills.** Two were read from disk under
`C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`.

`design-automation` contributed twice. Its section 5.1 placement order, which
run 0028 already found matched the reference plans, is the order the fifteen
follow. Its section 1.4 hard and soft rule distinction is what P4 was written
against: the question the prompt raised was whether "a dwelling needs a bedroom"
is a hard boundary or a scored preference, and the answer is that it is hard
here because the packer downstream allocates one flat to one resident, which is
a property of this system rather than of housing.

`parametric-modeling` contributed section 1.3's split into what is fixed, what
varies, what is derived and what is conditional. That is what shaped the family
structure of the fifteen: the fixed part is the module catalogue, which this run
was told not to change; what varies is the row structure and the gaps; what is
derived is every wall, window, stair hole and door.

`architectural-drawing` was **not read**. The prompt said to read it only if the
contact sheet needed it. The sheet is a grid of already-rendered axonometrics
with type over them, composed on a canvas through the sink run 0013 built, and
needed no drawing technique.

`algorithmic-patterns` and `computational-geometry` were **not read**, as the
prompt instructed, since run 0028 rejected the first with reasons and read only
the second's outline.

**12. Contradictions with the Assumptions, then my own.**

Assumption 1 **failed on the first attempt** and holds now. `main` did not carry
run 0028 when this prompt was first picked up, the run stopped and reported as
the assumption instructs, and the blocked report is in git at `be8c4ee`. Shrey
merged run 0028 at `6e081d8` and this is the second attempt.

Assumption 4 holds and its warning did not apply. `unit-5.json` fails exactly
P1, H1, ST3 and ST2, and P4 is not among them because it holds a
`bedroom_large`, so its quarantine list needed no change.

Assumptions 2, 3, 5 and 6 hold as written.

My own assumptions. **The five flats I did not hand to a subagent** were the
five that already passed, so there was nothing for one to tune; the prompt asked
for subagents on the fifteen and four of them covered the ten that needed work.
**Room counts in the table** are what the app reports from `roomTypes`, which
counts a dining room and a bathroom, so they read higher than the Swiss count
the size bands use; both are given. **Names** follow run 0028's form and the
twelve I emitted with a plain hyphen were normalised to the em dash before
committing. **Colours** cycle the app's own seven and no two adjacent ids share
one. **Flat 24's kitchen** is enclosed by an outdoor pad on its south side
rather than a room, so it is landlocked in plan but has a semi-exterior edge,
and it reports W1 rather than being fully internal like Flats 14 and 16.

## Artifacts produced

- `_cowork/outbox/0029-reference-plans-2.md` — the second study, 277 lines.
- `_cowork/outbox/0029-contact-sheet.jpg` — twenty on one sheet, 2436 by 2332.
- `scripts/flats/unit-13.flat.json` … `unit-27.flat.json`, and a rewritten
  `unit-8.flat.json`.
- `public/units/unit-13.json` … `unit-27.json` and their `.jpg` previews; a
  rewritten `unit-8` pair.
- `public/units/index.json` — fifteen new rows and one rewritten.
- `src/core/rules.ts` — rule P4. `docs/rules-reference.html` and its PDF.
- `src/library/unitBrowser.ts`, `src/main.ts`, `vite.config.ts` — the delete
  control and its endpoint.

## Decisions and rationale

**P4 is hard rather than soft.** A living room that doubles as a bedroom is a
real dwelling type and plenty of studios are built that way, so the rule is not
a claim about housing in general. It is hard because the packer downstream gives
one flat to one resident, and a flat with nowhere to sleep is not one it can
allocate. The comment in `rules.ts` says this, and so does the paragraph added
to `docs/rules-reference.html`, because a reader who meets a hard rule they
disagree with deserves the reason.

**The rule was committed with the library test red.** The prompt asked for the
rule and its result before any flat was changed to suit it. `249e715` therefore
leaves `libraryClean.slow.test.ts` failing on `unit-8.json`, and `7909396`
redraws the flat and turns it green. The commit message says so.

**Flat 08's bedroom sits west and its living room east.** With the living room
in the west corner it touched only the entrée and rule S2 fired, a living room
acting as a dead end. Swapping the pair gives it a second door onto the loggia.

**A gap is checked as the inverse of a void.** Both are empty space and they
fail in opposite directions, so a single check that knows which kind it is
looking at catches both mistakes and names them differently.

**The refusal uses `notice` rather than `status`.** `status` replaces the whole
grid, which is right when a fetch failed and there is nothing to show, and wrong
when the library is fine and the resident needs the cards to act on.

## Deviations from the prompt

**Tasks 2 and 3 were committed before task 1.** The prompt says nothing is drawn
before the reading file exists. The reading ran as a background agent for 8.7
minutes, and the bedroom rule and Flat 08's redraw were done while it ran. Flat
08 traces to a plan in run 0028's study rather than the new one, so nothing in
it depended on the reading, but the commit order is 2, 3, 1 rather than 1, 2, 3.

**Flat 24's kitchen is not fully landlocked.** Its south neighbour is an outdoor
pad, so it has a semi-exterior edge and reports W1. Flats 14 and 16 are the
fully internal cases.

**Flat 23 lost its dining room.** Bringing it inside the 70 to 85 band after the
corridors were widened meant turning the dining room into a gap, which left the
living room with one door and rule S2 firing. It is reported rather than
flattened further.

## Blocked / did not do

Nothing the prompt asked for is missing. The shapes listed under point 7 as not
managed are recorded as findings rather than omissions, since the prompt asked
for exactly that.

## Open questions for you

**1. Should the rules become a named, switchable set?** The second study's
central finding is that these rules describe one household model. Hunziker Haus
A is built, awarded and thoroughly conventional Swiss cooperative housing, and
this app cannot express it: its shared hall is a room, its circulation share is
large on purpose, and every private room has its own bath. A cluster set beside
the nuclear-family one would make the tool able to describe the housing the
thesis is actually about. It is a large change and it is the one the reading
most clearly points at.

**2. Should an enclosed void be able to stay void?** `computeExpansion` hands
every enclosed pocket to the nearest elastic room, which is why a courtyard
cannot be drawn. A flag saying this hole is a hole would unlock the ring, the
courtyard and the light well in one move, and all three appear in the buildings
the thesis names.

**3. Does a maisonette need its own circulation budget?** Five flats trip N1 at
29 to 38 per cent because a stair counts as circulation and sits on both
storeys. Either the rule should discount a stair, or two-storey flats should
carry a different threshold, or the finding is correct and maisonettes are
simply expensive. The reference sample is entirely single-storey, so the numbers
that set the 25 per cent cap have nothing to say about them.

## Suggested next prompt

**0031, the rule set that fits the housing.** Take open question 1. Make `RULES`
carry a set name, add a second set for cluster and shared-household flats in
which the entrance may open into a habitable shared hall, circulation carries no
upper bound, wet rooms may be distributed, and an en-suite is expected rather
than exceptional. Keep the existing set as the default and unchanged, so every
one of the twenty flats still reports what it reports today, and prove that with
the library-wide test run under both sets. Then draw two cluster flats after
Hunziker Areal Haus A, whose sheet
`_cowork/outbox/0029-reference-plans-2.md` records with printed areas, and show
that the first set rejects them and the second accepts them. That single pair of
results is the thesis argument about whose norms a configurator encodes, made
executable.
