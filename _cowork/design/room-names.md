# The rooms, by their plain names

Settled 8 September, written in run 0043. Both apps copy this table.

Every room carries a stored name. In the flat app it is `def.name` in
`src/core/modules.ts`; in a flat file it is what `roomTypes` carries. The
stored name travels: it goes into every graph node's label, into the exported
unit's `roomTypes`, and from there into the building app. Renaming a preset
would change a file format and break every flat already sitting in a group.

So the stored name stays and the screen shows a plain one instead. Sixteen of
the twenty stored names glue two words with an em dash, which is the first
thing the writing guide strikes out, and they read as a catalogue rather than
as rooms. "Bedroom — Small" is how a parts list writes it. "Small bedroom" is
how a person says it.

The table maps a stored name to a display name. Read it with the stored name as
the fallback, so a preset added later shows something rather than nothing.
Never write a display name into a file.

| Stored | On screen |
|---|---|
| `Stair — Straight` | Straight stair |
| `Stair — Dogleg` | Dogleg stair |
| `Stair — Dogleg, generous` | Generous dogleg stair |
| `Stair — Spiral` | Spiral stair |
| `Stair — C, three flights` | C stair, three flights |
| `Stair (dogleg, retired)` | Dogleg stair, retired |
| `Living Room` | Living room |
| `Kitchen` | Kitchen |
| `Bedroom — Small` | Small bedroom |
| `Bedroom — Large` | Large bedroom |
| `Bathroom — Small` | Small bathroom |
| `Bathroom — Large` | Large bathroom |
| `WC — minimal` | Minimal WC |
| `Bathroom — Full` | Full bathroom |
| `Bathroom — Full, compact` | Compact full bathroom |
| `Recreation Room` | Recreation room |
| `Circulation — Single` | Single hall |
| `Circulation — Double` | Double hall |
| `Outdoor — Single` | Single outdoor space |
| `Outdoor — Double` | Double outdoor space |

Circulation reads Hall on screen and stays `circulation` in the data. The flat
app renamed it on the palette alone from run 0027 until run 0043; every screen
says Hall now, and every rule still reasons about `circulation`.

The flat app's copy is `ROOM_NAMES` in `src/core/words.ts`, with `roomName()`
reading it. A test there checks that every name in `src/core/modules.ts` has a
row, so the fallback is a safety net rather than a way of quietly skipping one.
The building app should do the same against its own list.
