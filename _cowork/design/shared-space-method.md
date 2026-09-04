# How the shared spaces are decided

The method, in plain words, for the presentation and the written part.
Decided 4 September 2026. It is EquiCity's maths (Nourian, Azadi, Bai,
de Andrade, Abu Zaid, Rezvani and Pereira Roders, "EquiCity game",
Scientific Reports 14:10912, 2024) applied to one building.

Everyone has one vote of equal weight. One resident has one flat, and
one flat has one voice.

---

## The four steps

**1. How much.** Each resident says how many square metres of shared
space they think each person should pay for. The middle answer is the
one the building uses, not the average, because a middle cannot be
moved by one person asking for a lot. That number times the number of
residents is the budget. Seven square metres each, with twenty
residents, gives 140 m².

Everyone pays the same. A resident with a large flat and a resident
with a small one carry the same share of the shared space, because
they have the same one vote. Say does not come from what you own, and
neither does the bill.

Nothing is taken out of anybody's flat. A resident draws 70 m² and
keeps 70 m². The shared rooms are built in the space the flats leave
over, and what a resident carries is their equal part of the cost.
That is the cost-sharing the EquiCity paper says it left out.

The wording in the app:

> **How much shared space should each of us pay for?**
>
> `[———————•——————————————]` **7 m²**
>
> Seven square metres each, on top of your own flat. With 20 of you
> that is about 145 m² of shared space, roughly 8 rooms.
>
> Everyone pays the same, and the middle answer is the one the building
> uses. Right now that is 8 m² each.

Square metres per person rather than a percentage of floor area. A
percentage always drags flat size back into the question, and flat size
is exactly what does not count here.

With an even number of residents there is no single middle answer, so
the median is the average of the two in the middle, rounded to the
nearest whole square metre. The answers are not normalised or clamped
before that. They are all in the same unit, so there is nothing to
rescale, and a median is already immune to one person asking for a lot.
Altering somebody's number after they typed it would also make the
sentence "the middle answer is the one the building uses" untrue. The
slider's own range, nought to fifteen square metres, is the honest
place for a bound: the architect sets it beforehand and everybody can
see it.

**Paying for more.** Once the middle answer is known, a resident may
offer to pay for more than their share. This happens after the vote, so
it cannot change what the group decided. The extra goes into the same
pot and is divided by the group's ballot like everything else: it buys
more shared space and never more say. The feed names who gave it, so
the act is visible without becoming power. The group screen reads:

> The group settled on **8 m²** each. If you would like to pay for more
> than your share, you can.
>
> `[ − ]` **+5 m²** `[ + ]`
>
> You pay for 13 m². The building gets 165 m² instead of 160.

**2. What kind.** Each resident puts the shared spaces in order: first
choice, second, third. The order becomes numbers. A first choice is
worth 3, a second 2, a third 1, and each resident's numbers are scaled
so they add up to one. So "hall, terrace, laundry" becomes hall 0.50,
terrace 0.33, laundry 0.17. Nobody's second choice is thrown away.

**3. The group's split.** Average those rows across everyone. That is
the whole calculation. The result says what share of the shared budget
each kind of space should get. In the paper this is called opinion
pooling, and with one building it is exactly an average.

**4. Where it goes.** The split says how much of each kind. It does not
say which floor. Each floor can hold only so much shared space, and
some kinds have to sit somewhere particular: a social space needs the
ground, a terrace needs the roof. The method scales the numbers up and
down, floor by floor and kind by kind, until the floor totals and the
group's totals both come out right, staying as close to what people
asked for as it can. In the paper this is iterative proportional
fitting. It is the same procedure economists call RAS and
mathematicians call Sinkhorn.

If a kind of space cannot fit anywhere, its share moves to the others
on its own, in proportion. Nothing is special-cased. If it truly does
not fit, the building says so and by how many square metres.

---

## The worked example, four people

Four residents, five kinds of shared space, one building.

| | first | second | third |
|---|---|---|---|
| Ana | hall | terrace | laundry |
| Bruno | terrace | lounge | hall |
| Mina | social | hall | terrace |
| Leo | lounge | laundry | social |

Their orders become rows of numbers:

| | hall | terrace | laundry | lounge | social |
|---|---|---|---|---|---|
| Ana | 0.50 | 0.33 | 0.17 | 0 | 0 |
| Bruno | 0.17 | 0.50 | 0 | 0.33 | 0 |
| Mina | 0.33 | 0.17 | 0 | 0 | 0.50 |
| Leo | 0 | 0 | 0.33 | 0.50 | 0.17 |

The average of the four rows is the group's split:

| | hall | terrace | laundry | lounge | social |
|---|---|---|---|---|---|
| share | 25 % | 25 % | 12.5 % | 21 % | 17 % |
| of a 163 m² budget | 41 m² | 41 m² | 20 m² | 34 m² | 27 m² |

Every kind gets something. Hall and terrace tie, because two people put
hall high and two put terrace high.

Then the fitting decides the floors. Social can only be on the ground,
terrace only on the roof, the rest anywhere. The result, in square
metres:

```
            hall  terrace  laundry  lounge  social
  ground       6       0        3        5      27
  level 1     14       0        7       12       0
  level 2     13       0        7       11       0
  level 3      7       0        4        6       0
  roof         0      41        0        0       0
```

Social gets its 27 m² on the ground, because that is the only place it
can be. Nobody wrote a rule saying so. The arithmetic did it.

---

## The line for the slide

> Everyone ranks the shared spaces. The ranks become numbers, the
> numbers are averaged, and the average is fitted to what each floor
> can hold. One resident, one vote. Nobody's second choice is wasted.

And the citation underneath: opinion pooling and iterative
proportional fitting, after Nourian et al., EquiCity, 2024.

---

## Why each choice was made

**The median for the amount, the average for the kind.** An average can
be pulled by one person asking for 90 per cent. A median cannot. But an
average is the right thing for the split, because there every resident
should pull their full weight on what they care about. The two
mechanisms are used where each is safe.

**Square metres per person, not a percentage.** A percentage needs a
denominator, and every denominator available drags flat size back into
a question that is meant to be equal. Square metres per person needs no
explanation and is a thing a resident can picture. The building still
reports "shared : private" among its six numbers, which is the same
fact after the fact.

**Shared rooms are single-storey rooms with a floor area.** A hall is
7.5 by 5.0 m, a laundry 3.75 by 3.75 m, each one storey tall on one
level. The code calls them "volumes", which is a misnomer for a room
size and is being renamed. Square metres is the right unit.

**Equal all the way through.** One resident has one flat, one vote and
one equal share of the bill. Weighting either the vote or the payment
by floor area is defensible and is not used, because the thesis argues
that a resident's standing does not come from what they own, and shared
housing is where that argument has to hold. Area weighting stays
available as a variant to show.

**Ranks rather than one choice.** Asking people to order five things
and then reading only the top line wastes what they said. With ranks,
a space that is nobody's favourite and everybody's second still gets
built.

**The building only chooses what is left.** After the group's split is
spent, whatever the plan could not host goes to the packer, which
places it where the building needs it. Those rooms are marked in the
panel as the building's own choice. People decide what is built. The
algorithm decides where it goes, and only chooses what with the
remainder.

---

## What was left out, and why

- **Say that differs by floor.** In the paper a person can have more
  control over their own floor than over another. It is the interesting
  generalisation and it is not in this version.
- **The full Markov chain.** With one building the pooling is an
  average, and the chain is not needed. It would be needed for a
  neighbourhood of several sites.
- **The badges.** The paper rewards a gainer, a player and a
  contributor. Benjamin argued against badges on 3 September, and the
  profile diagram does the same work.
