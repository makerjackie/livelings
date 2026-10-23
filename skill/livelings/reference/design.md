# What makes a Liveling worth making

Lessons from designing the family (and from the characters that were thrown
away). Read before proposing anything.

## Pick a thing whose body is the joke

Ask "what is the funniest thing this does?" before "what does it look like?".

- Good: a **die** rolls and the face it lands on is its mood; a **ghost**
  fades when you leave and jumps out when you come back; a **rubber duck**
  squeaks when squeezed and flips bottom-up; **blocks** stack up as progress
  and topple on error; the **moon** waxes from a sliver to full as a progress
  bar.
- Weak: a flame, a dust ball, a jelly, a sun with rays. They look fine but the
  body does nothing of its own, so every animation has to be bolted on.

Test: can you name five motions in ten seconds, and does at least one of them
map onto an app state without explanation? If not, pick another thing.

## Bind it to an image people already know

The character should be recognisable from its silhouette alone, at 32 px. The
thing's defining features must be present and must *act*: phases for the moon,
pips for the die, a wavy hem for the ghost, a bill and a bath for the duck.
A ball of yarn that does not read as yarn fails, however nice the strands are.

## Put the feature in the face

The best characters fuse their defining feature with their expression:

- the die's pips **are** its eyes (two for neutral, one big red one when
  startled, six happy arcs when delighted);
- the ghost's whole body is its mood (opacity, the ripple of its hem);
- the duck's bill opens to quack.

A generic face (two small dots) beside a decoration reads as a sticker.

## Give it a temper and a relationship with the user

One line of personality: "a shy prankster", "a lucky optimist", "a good
listener". Then let it answer the user's cursor in character: the ghost is
startled and vanishes, the die rolls when tapped, the duck squeaks.
Interaction is where people fall for a character.

## Look

- Ink outline (`outlineWidth` about 0.05), flat colours, a soft highlight or
  shade at most. One accent colour.
- Eyes designed per character: size, spacing and position matter more than
  anything else on the face. Big, expressive eyes beat tiny dots.
- A silhouette that differs from the family's (circle, cloud, cube, sheet,
  duck, tower, crescent).
- 3 to 5 palettes; the first is the signature look.

## States it must act out, in its own way

`idle`, `thinking`, `working`, `waiting`, `blocked`, `listening`, `sleep` (loops)
and `done`, `error` (once). Override at least thinking, working, done, error and
sleep with something only this character would do. Everything else falls back to
the shared vocabulary (happy, love, surprised, celebrate...).

## Before you hand it over

- [ ] Recognisable from the silhouette at small sizes (check the studio).
- [ ] Every one of the sixteen studio tiles reads at a glance.
- [ ] Its signature trick happens in at least two states and one reaction.
- [ ] Nothing glitches when switching mid-action (springs handle it if you only
      set targets and give impulses; never set positions directly every frame).
- [ ] Palettes all read on light and dark backgrounds.
