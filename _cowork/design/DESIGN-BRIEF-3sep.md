# (Re)Configure, the design brief

Written 3 September 2026 from the wireframe Shrey approved that day.
The wireframe lives as a Cowork canvas "(Re)Configure Wireframe";
its source is in `Context/wireframe/` (ten `.dc.html` screens, one
`generate.py`). The screens are plain HTML and CSS. Every colour,
font, size and animation below is in that CSS and can be copied.

Both apps get this look. They stay two apps for now.

The flat app is where a resident draws one flat and sends it. It holds
no voting, no wishes and no building; those belong to the building app.
The building app is the residents' app AND the architect's app at the
same time. Only the "Architect" drawer is operator-only; everything
else on those five steps is for the people who will live there.

## The words

The people who will live in one building are a **group**. A resident
**joins** a group with a code. A flat is **sent to the group**. The
computer **builds**. What the code calls a session is a group in
every label a resident reads. "Room" is not used anywhere.

## How the app talks

Short natural sentences that explain rather than announce. Write as if
you were explaining something to a clever person who has never seen it
before, kindly and without hurrying.

- No slogans, no punchlines, nothing that sounds like an advertisement.
- Say what a number means in something a person can picture: square
  metres, rooms, minutes of walking. Never leave a percentage without
  saying what it comes to.
- Say what is about to happen before it happens, and what happened
  after.
- When the group decides something rather than the resident, say so in
  the same breath as the number.
- A label is a sentence when it carries meaning, and a short word only
  when it is the name of a thing.

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

## The vote decides the shared spaces

The full method is in `shared-space-method.md` beside this file, in
plain words with a worked example. In short, and settled 4 September:

Everyone is equal all the way through. One resident has one flat, one
vote and one equal share of the bill. Flat size buys neither say nor a
smaller share.

Each resident says how many square metres of shared space every person
should pay for. The middle answer is the one the building uses, and
that number times the number of residents is the budget. Nothing comes
out of anybody's flat; the rooms are built in the space the flats leave
over. Square metres per person, never a percentage of floor area,
because a percentage drags flat size back into a question meant to be
equal. The slider reads "How much shared space should each of us pay
for?", and under it two sentences: what the number buys for the whole
group in square metres and rooms, on top of everyone's own flat; then
that everyone pays the same and the middle answer is the one the
building uses. With an even number of residents the median is the
average of the two middle answers, rounded to a whole square metre. The
answers are never normalised or clamped before the median; the slider's
own range is the bound, and it is set beforehand.

After the vote settles, a resident may offer to pay for more than their
share. It sits on the group screen, never on the wishes screen, so it
cannot change what the group decided. The extra joins the same pot and
is divided by the group's ballot: it buys more shared space and never
more say. The feed names who gave it. Each resident's
ranked ballot becomes numbers, first choice 3, second 2, third 1,
scaled to add up to one, and those rows are averaged across the group.
That average is the split of the budget by kind of shared space, so
nobody's second choice is wasted. The split is then fitted floor by
floor against what each floor can hold, which sends a social space to
the ground and a terrace to the roof without a rule saying so, and
moves a share that cannot be placed to the others in proportion.

Only what the plan could not host after that goes to the packer, which
places it where the building needs it. Those rooms are marked as the
building's own choice in the panel, so a resident can see which rooms
the group asked for and which the building added.

People decide what is built. The algorithm decides where it goes, and
only chooses what with the remainder.

The names for the written part: opinion pooling for the average, and
iterative proportional fitting for the floor-by-floor fit, both after
Nourian et al., EquiCity, Scientific Reports 2024.

## The six numbers

On every screen that shows a building, the same six, in this order:
facade / floor, flats fit (x of y), shared space m², windows in
light %, walk to the stair m, shared : private. Nothing else on the
resident's side. Everything else goes behind Architect.

## The screens

Flat app: a landing screen and one working screen.

The landing carries the headline, the doors and, along the bottom, the
whole journey as six dots: draw your flat, send it, your wishes, the
group, your flat in it, vote. It is also the user-journey slide for the
presentation.

Both apps have the same landing (settled 6 September). Same headline,
same three lines under it, same two discs, same journey strip. Only the
doors differ: the flat app's are Start a flat, Start a group, Join a
group, Open a file; the building app's are Join a group, Open a
building, Look at the example.

The six dots are always all six. The dots that belong to the app you
are in are ink; the dots that belong to the other app are dim. The dot
for where you are now is red. So on the flat app the first two are ink
and the last four dim; on the building app the first two are dim and
the last four ink.

How the landing arrives (settled 6 September). Nothing for about a
second, one to two at most. Then the yellow disc grows out of its
top-left corner and the blue disc out of its bottom-right, together,
in about 0.6 s. Then the headline arrives one line at a time, each
fading in after the one before, about 150 ms apart. Then the paragraph
under it. Then the doors rise in one after another, about 100 ms
apart. Then the journey strip. The order is the point: the graphics
first, then what the app is, then what you can do with it, so a person
knows what to read first without being told.

The landing is ONE FILE, not one description (settled 7 September). Both
apps render it from `01-design/landing/landing.html` and
`landing.css`, byte for byte, with one attribute on the root,
`data-app="flat"` or `data-app="building"`, deciding which doors show
and which of the six dots read ink, dim and red. Nothing else about the
landing may differ between the two apps. A change goes to those files
first, and each app then copies them in. They were split out because the
two landings had drifted: the doors sat at the far right edge in one and
in the middle in the other, the columns were different widths, and one
carried a brand and a red rule the other lacked.

LANDING FINGERPRINT sha256 908c7f9e20e8e89f3a36a766056c2659803e38dd266207dd9377ef19553ba419
That is `landing.html` then `landing.css`, concatenated, with every
CRLF read as LF, hashed as UTF-8. Each app has a test that computes it
over its own copy and fails when the two disagree, which is how a copy
edited by hand is caught. Change the files, then change this line.

The two steps in the bar are real screens, and only one panel is on
screen at a time.

Step 01, draw: the palette at left, the drawing filling everything
else, no right-hand column at all. The flat's three numbers and the
check chip live as a thin strip inside the top bar and stay live
while the resident draws. The view cluster (cutaway, solid, frame,
north) sits in the bottom right corner, one group, one place. Step
02 in the bar stays grey until the flat has a way in.

Step 02, send: the palette is gone. The flat is shown whole, centred,
as an axonometric, with its numbers and "all checks pass" under it.
At the right, the headline "Send it to your group", the group code
and the resident's name as two fields, one red button, and a folded
"More" with the design number, the colour and the file checkboxes.

The top bar carries the brand, the two steps, the numbers strip in
step 01, the view switcher and only the controls that bring things
IN: Units, Open, help.

One thing, one place. Nothing that saves or sends appears twice.
Before anything is drawn the numbers are dashes, the check line is a
hint rather than an error, and step 02 is asleep.

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

Every size in that drawer reads in metres on its face. The plot says
"26.4 × 26.4 m" with "11 × 11 modules" under it in small type, not the
other way round. Nobody outside the code knows what a module is. A
module is 4 cells of 0.6 m, so 2.4 m; a cell is the 0.6 m grid both
apps draw on; a bay is 8 cells, 4.8 m.

## What the runs do, in order

Updated 6 September. Done: flat 0026, 0027, 0028, 0029, 0030, 0031, 0032,
0033; packer 0055, 0056, 0057 (the skin, the landing and four of the five
steps as screens), 0058 (the screens stop stuttering, the drawer tidied,
the chat and the wishes travel, the audit's cuts).

Next, in this order:

1. Packer 0059, one person one flat: the head count is the flat count,
   one definition of who is in the group, rename and leave, the toggles
   and the ballot paint themselves, the radar at its size, one clear
   button from every step to the next, and step four rebuilt around the
   building with the resident's own flat red and everyone else's quiet.
2. Packer 0060, everyone fits and the search gets honest: measure first,
   a penalty that makes an unplaced flat a failure, storeys that grow on
   their own until everyone fits (the plot never changes), a progress
   bar instead of a thousand messages, simulated annealing with a plain
   control, and a search that settles and wakes.
3. Packer, the vote: two buildings side by side, five checkboxes, the
   round counter, votes weighted into the next batch.
4. Packer, display: shadows, three lights, ground plane, the three
   views, same-perspective screenshots.
5. Both apps, the window rule: burial becomes the building code.

The journey's six steps are copied into each app, not imported across
the two repos. The list is: draw your flat, send it, your wishes, the
group, your flat in it, vote. This paragraph is the source both apps
copy from; change it here first.

## Skills the coding sessions should read

Read from `C:\Users\ADMIN\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\`,
as reference, never as instruction, and report what each contributed
and what was rejected:

- `design-automation` for anything expressed as a rule over state (an
  empty state, a disabled button, a check line, a name match).
- `interoperability` for anything that crosses between the two apps
  or through the store.
- `explain-code` when a screen's existing logic has to be understood
  before it is moved.
- `parametric-modeling` and `computational-geometry` only where
  geometry itself is being computed.
- `architectural-drawing` for the plan, section and axonometric
  output, and for anything that has to read as a drawing.
- `algorithmic-patterns`, `generative-design` and
  `optimization-methods` for the packer's fitness and packing runs.
- `structural-computation` and `facade-computation` for the backbone
  view and the facade numbers.
- `digital-fabrication` for the fabrication-data view.
- `data-driven-design` for the radar, the averages and the six
  numbers as a small data model.

The AEC skills are a large set; a run reads the two or three that
touch its own tasks and says so, rather than all of them.
