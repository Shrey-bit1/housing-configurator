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

## The vote chooses the building

Settled 7 September. The vote is how the group arrives at one building
it agrees on. It runs as a sequence of rounds, and it runs over days if
it has to, because twenty people are rarely at their laptops at once.

What a resident sees. Two buildings side by side, the six numbers
under each, and one sentence saying what is different between them:
"This one has more light and longer walks to the stair." The resident
presses the one they would rather live in and ticks one or two reasons
from five: privacy, shared space, cost, light, short walks. Then the
screen says "You have voted. 8 of 20 so far." and they are done until
the round closes. Nobody waits at a screen.

Where the second building comes from. A second building that differs
only by chance is not worth a vote. So a challenger is the current
building searched again with one dial pushed: more windows in light, or
shorter walks to the stair, or a tighter facade that is cheaper to heat
and cool, or more shared space, or fewer shafts. The two then differ in
a way a person can see and the six numbers can show.

Rounds. Because every round is a wait for the whole group, a round
offers several pairs at once rather than one, five pairs maybe, each
built from the current building pushed on a different dial. A resident
votes on each pair. A round closes when everyone at the table has
voted; until then it stays open, and the screen says how many have.
When it closes, the app counts, keeps the building that won most, and
prepares the next round. Two or three rounds is the expectation.

The bump. The reasons people tick are counted, everyone equal, and
become five numbers, one per dial. They do two things. They decide
which dials the next round pushes hardest: what people ticked for a
building that lost is what they wanted and did not get. And round by
round they become the weights the search itself builds by, so that
after the vote the scoring rule the building is built by has been set
by the residents' choices rather than by a guess in the Architect
drawer. One person ticking the same reason every time moves a weight
by one twentieth.

When it ends. At the close of any round, if three quarters or more of
the people who voted chose the same building, that building is the one,
and the screen says "17 of 20 chose this building. This is the one."
Otherwise the next round goes up. For now an absent person can hold a
round open; a rule for that comes later. A vote that a person changes
is replaced for the count, and the earlier one is kept in the record,
so that how many changed their minds can be read afterwards.

The pause before it. After the wishes, the screen says "Your wishes are
recorded. The building will be ready when everyone has answered." While
the group finishes, the app uses that time to run the search properly
and to build the first round's pairs, so when the last person answers
the vote is ready. The same happens between rounds. This is an idea
for the thesis after the master, and the first version (run 0063)
builds the vote without the pause.

What the store carries for this: the current building and the
challengers of the open round, each with its genome and the plot it
was built on; the round number; and one vote per person per pair with
the reasons ticked. Both apps read the same five reasons, copied from
this paragraph: privacy, shared space, cost, light, short walks.

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

When the flat app remembers you (settled 8 September), the first door
reads "Back to your flat" and the fields hold your code and name. Under
the doors there is then one written line, "Start again with a new
flat." It asks once, in plain words, and then forgets the flat and the
name on this browser, so the landing is a first visit again. The flat
you already sent stays in the group; taking it out is done from the
group screen, never by starting again.

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

LANDING FINGERPRINT sha256 7a21b057379d50f7cc93dd0c79962e6c98449f27a02206d546a06ca755ae6602
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
   building in the middle with the six numbers under it, the feed at
   right, a chat line at the bottom. Residents can drag a shared
   space; flats stay put. There is no build button (settled
   8 September): once the wishes are in, the building builds itself,
   and while it searches the screen shows it trying, lightly, with the
   step count. Above the building one small switch of five views:
   Building, Rooms, Backbone, Plan, Section (Benjamin's three views
   from 3 September plus the two drawings). Building is the default:
   facade panels, glass, studio light, shadows, ground plane.
4. Your flat: the building with the resident's own flat in red,
   everyone else's in one quiet neutral, shared rooms in yellow; the
   card in sentences at right; the same five-view switch; then the
   next button.
5. Vote: as "The vote chooses the building" above. Pairs side by side
   with the six numbers and one sentence naming the difference, five
   reasons to tick, one press per pair, and a line saying how many
   have voted.

Architect: a drawer from the right with every operator control,
closed unless opened. The building shows as backbone behind it.

Every size in that drawer reads in metres on its face. The plot says
"26.4 × 26.4 m" with "11 × 11 modules" under it in small type, not the
other way round. Nobody outside the code knows what a module is. A
module is 4 cells of 0.6 m, so 2.4 m; a cell is the 0.6 m grid both
apps draw on; a bay is 8 cells, 4.8 m.

The plot is the architect's (settled 8 September). Nothing in the app
changes it on its own: not a rebuild, not a file opening, not the
storeys growing. The architect sets it with the two sliders or with one
press, "Size the plot for these flats", which measures once and sets the
sliders, at any time, group or no group. Residents never reach it. A
tall building gets two staircases from eight storeys; below that the
walk to the stair decides.

Storeys are the architect's too, and growing them is a last resort
(settled 8 September). The building is packed at the storey count set
in the drawer. When the flats do not fit, every screen says the same
thing in the same words ("Only 14 of 21 flats fit on this plot at 7
storeys. Seven people have no flat yet. Your architect has been told."),
and the drawer offers one press, "Add storeys until everybody fits",
which walks the heights once, keeps the best, and says what it found.
Nothing grows unasked.

A shared room is placed only where a person can walk to it from a
stair landing along the corridor or through another shared room. A
terrace nobody can reach is not a terrace.

Nothing a resident reads names a field, a parameter or a button that
is not on their screen. "Shared space 89 m², was 81." Never
"sharedBuiltM2 80.6, −8.7".

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
   control, and a search that settles and wakes. (Storeys growing on
   their own was withdrawn 8 September; see the plot paragraphs.)
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
