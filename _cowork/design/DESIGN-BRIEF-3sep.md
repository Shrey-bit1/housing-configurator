# (Re)Configure, the design brief

Written 3 September 2026 from the wireframe Shrey approved that day.
The wireframe lives as a Cowork canvas "(Re)Configure Wireframe";
its source is in `Context/wireframe/` (seven `.dc.html` screens, one
`generate.py`). The screens are plain HTML and CSS. Every colour,
font, size and animation below is in that CSS and can be copied.

Both apps get this look. They stay two apps for now.

## The words

The people who will live in one building are a **group**. A resident
**joins** a group with a code. A flat is **sent to the group**. The
computer **builds**. What the code calls a session is a group in
every label a resident reads. "Room" is not used anywhere.

## The ground

Paper, not white and not dark: `#ece6d8`, with a faint grain (an SVG
`feTurbulence` noise at 16 % alpha, tiled at 180 px). No grid on the
ground. Cards are a slightly lighter paper `#f4f0e6` with a 3 px
black rule on top and nothing else; no rounded corners, no shadows,
no borders on the sides.

## The colours, and only these

- Ink `#161616` for text and lines.
- Red `#d6341c` for the one primary action on a screen, for the
  resident's own flat in the building, and for the resident's own
  shape in the radar.
- Blue `#1d4fa3` for the group's average and for annotations.
- Yellow `#f2b41c` for shared spaces, in the plan and in the building.
- Muted ink `#6b665c` for labels, dim `#a39c8d` for what is off.

No gradients. No other hue.

## The type

- Display: **Big Shoulders Display** 800 to 900, uppercase, for
  headings, step names, buttons and big numbers. Flat, square-cut,
  condensed.
- Reading: **Jost** 400 to 600 for sentences, labels (uppercase,
  letter-spaced 0.14 em, 10 px) and small print.
- Mono: **JetBrains Mono** only for codes and timestamps
  (`review-0023`, `12:51`).

Sizes in the wireframe: screen title 52 px, card title 28 px, big
number 34 px, sentence 14 px, label 10 px.

## The pieces

- Top bar: brand at left, the steps across the middle as numbered
  circles with names, a live dot and the clock at right, and the
  `Architect` button. The current step is a red disc that breathes;
  done steps are black discs. A 3 px black rule under the bar.
- Button: a red block, display type, an arrow at the right edge that
  nudges. One per screen. Secondary buttons are outlined black.
- Input: a line under the text, a red block caret.
- Slider: a ruler of ticks (every 10 units thin, every 50 thick), a
  red line that grows in, a red triangle as the knob.
- Toggle: a black pill with a red dot when on.
- Chip: outlined pill, black when on, red outline for a warning.
- Radar: five axes, three rings, the group's average as a blue dashed
  shape, the resident's shape in red that traces itself, a ring of
  tick marks around it turning slowly, a blue dashed circle turning
  the other way.
- Feed: one line per change, a timestamp in mono at the left, lines
  slide in one after another.
- Building: white blocks with black lines on a light ground plane;
  the resident's copies red; shared spaces yellow. Three views: real,
  organisation, backbone (lines only).

## The motion, all CSS

- The building draws itself in line by line (stroke-dashoffset per
  face, 50 ms apart), then the faces fill.
- Numbers count up over 1.6 s.
- Screen titles arrive out of a blur.
- Lists rise or slide in with 80 to 180 ms between items.
- The card heading types itself.
- The Architect drawer slides in from the right.
- Arrows on buttons nudge; the live dot blinks; the current step
  breathes.

NOT in the app: the red line that sweeps down over the building on
the group screen of the wireframe. Shrey does not want it. While a
build runs, show the progress window that exists today, restyled.

## The six numbers

On every screen that shows a building, the same six, in this order:
facade / floor, flats fit (x of y), shared space m², windows in
light %, walk to the stair m, shared : private. Nothing else on the
resident's side. Everything else goes behind Architect.

## The screens

Flat app: one screen. Draw at left with five tools; at right the
flat's three numbers, the check line, the group and one red button
"Send it to your group"; "More" folds the files and the library.

Building app: five steps in the bar.

1. Join: code, name, one button.
2. Wishes: the share slider, the ballot as a numbered list, three
   flat wishes as toggles, the radar with the group's average.
3. The group: people at the table with mini radars at left, the
   building in the middle with the six numbers under it, Build and
   the feed at right, a chat line at the bottom. Residents can drag
   a shared space; flats stay put.
4. Your flat: the building with the resident's copies in red, the
   card in sentences at right, then the next button.
5. Vote: two buildings side by side with the six numbers, the two
   extremes small at the top, five checkboxes for why, one button.

Architect: a drawer from the right with every operator control,
closed unless opened. The building shows as backbone behind it.

## What the runs do, in order

1. Flat 0026, small: the store's building entry carries the plot;
   resident names match trimmed and case-insensitive.
2. Packer 0055, the skin and the first two steps: fonts, colours,
   the bar with steps, buttons, the Wishes screen with the radar,
   the group screen as above, the Architect drawer. The current
   panel's content moves; nothing is invented.
3. Packer 0056, the ballot decides: first choices reserve budget
   before the general fit; Regenerate adopts the plot from the store;
   the shared-space list reads the wireframe's way.
4. Packer 0057, steps four and five: the card with the building
   view, the vote between two buildings with five checkboxes, the
   round counter, votes weighted into the next batch.
5. Packer 0058, display: shadows, three lights, ground plane, the
   three views, same-perspective screenshots.
6. Flat 0027, the flat app in the same skin.
