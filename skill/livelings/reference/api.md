# Livelings API for character files

A character is a plain object (`CharacterDef`). Import helpers from
`../livelings.js` (from inside `livelings/characters/`). Body units: the rest
body has radius about 1, centred on the origin, y pointing down; the floor is at
y = 1. Time is in seconds.

```js
import { defineCharacter, label, physics, shapes, variant, at, every, sparkles } from '../livelings.js'

export default defineCharacter({
  id: 'mine',                          // lowercase, used in <live-ling character="mine">
  name: label('Mine', '小家伙'),        // { en, zh } everywhere text is shown
  material: label('Thing', '东西'),
  tagline: label('One line.', '一句话。'),
  bio: label('A short paragraph.', '一小段。'),
  traits: { en: ['three', 'short', 'traits'], zh: ['三个', '短', '标签'] },
  physics: physics({ /* overrides, see below */ }),
  eyes: { w: 0.16, h: 0.24, corner: 1, spacing: 0.56, lift: 0.04, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',                      // 'ink' painted eyes, or 'hole' cut out of the body (Inky)
  outlineWidth: 0.055,
  rest: () => shapes.circle(),         // the silhouette
  palettes: [{ id: 'main', body: '#ffd43b', outline: '#3d2e05', eye: '#1f1a0e', accent: '#ff922b', mark: '#3d2e05' }],
  actions: { /* its own moves and its takes on shared states */ },
  signature: ['…'],                    // its own action ids, in display order
  fidgets: ['look-around', 'wiggle']   // small moves it does when idle
})
```

## Shapes (`shapes.*`)

Every silhouette is 96 points, so any shape morphs into any other.

| function | makes |
|---|---|
| `circle(r)`, `pebble()`, `egg()`, `droplet(point)`, `teardrop(w, h, lean)` | round things |
| `squircle(n, size)` | rounded squares (n 4 to 6) |
| `star(points, inner)`, `heart()`, `moon()` | symbols |
| `discs([{x, y, r}, …])` | union of circles (clouds, ducks, cacti); the origin must be inside |
| `scallop(bumps, depth)` | a cloud |
| `polygon([{x, y}, …])` | straight-edged shapes with exact corners (use with `straight: true`) |
| `polar(a => r)` | radius as a function of angle (from the top, clockwise) |
| `resample(points)` | any closed outline to 96 points |
| `transform(shape, sx, sy, dx, dy)`, `normalize(shape, max)` | fit and move |

Named shapes for `morph('…')`: `circle pebble squircle droplet flame puddle egg
star heart moon tall wide pancake tiny bean`, and `text:7`, `text:OK`, `text:?`
(any short text). A character's own `shapes: { name: () => shape }` take
priority (give your character its own `wide`, `tall`, `puddle`).

## Physics (`physics({...})`)

`morphStiffness 150`, `morphDamping 14.5` (shape changes: lower damping =
jelly), `softStiffness 240`, `softDamping 12`, `softSmoothing 120` (dents from
pokes and drags), `gravity 12`, `hopPower 3.4`, `bounce 0` (rubber 0.5),
`squashiness 1` (0.3 rigid, 1.5 gooey), `floaty false` + `hover` (clouds,
ghosts, moons), `wobble 0` (constant jiggle), `breath 0.025`, `stretch 0.7`
(how far a drag pulls), `flutter 0` (rocks while airborne, like paper).

## Eyes and expressions

`eyes` sets the resting eyes in face units: `w`, `h` (size), `corner` (0 square
to 1 round), `spacing`, `lift`, `topLid`/`bottomLid` (0 to 1), `tilt`, `slant`
(angry +, sad −), `asym`. `eyeShine` (0 to 1) adds a glossy highlight.
Expressions for `express()` / `flash()`: `neutral happy excited proud sleepy
closed curious surprised shy focused soft sad worried angry dizzy wink`, or an
object of overrides. The face sits in the largest circle inside the shape; pin it
with `face: { x, y, r }` for the rest shape. Draw a custom face with
`drawFace(r)` (the die draws pips), reading `r.actor.expression` and
`r.actor.eyes`.

## Actions

```js
actions: {
  stamp: {                       // a one-shot of its own
    kind: 'once', duration: 1.8, label: label('Stamp', '盖章'),
    enter(a) { a.express('focused'); a.morph('squircle') },
    tick(a, t, dt) { if (at(t, dt, 0.6)) { a.morph('rest'); a.hop(0.8); sparkles(a, 6) } },
    front(r, t, alpha) { /* draw in front of the body */ },
    back(r, t, alpha) { /* behind */ }
  },
  working: variant('working', {  // its own take on a shared state (keeps id, label, kind)
    enter(a) { a.express('focused') },
    tick(a, t, dt) { if (every(t, dt, 0.5)) a.squish(2) },
    front: undefined             // drop the shared overlay
  })
}
```

Loops (`kind: 'loop'`) stay until another loop is played; one-shots play once and
hand back. Every state change resets targets (shape back to rest, face to the
mood, lean, scale, tint, effects), so behaviours only set what they need.

Shared ids every character understands: loops `idle thinking working waiting
blocked listening sleep`; one-shots `acknowledge done error poked happy excited
proud love surprised shy sad angry confused nod no hello celebrate look-around
yawn bounce wiggle`.

**Timing helpers**: `at(t, dt, when)` is true once when local time passes
`when`; `every(t, dt, period, offset)`.

## The actor (`a`)

| verb | does |
|---|---|
| `a.morph(nameOrShape, { squash, blink })` | spring into a shape |
| `a.holdShape(name, seconds)` | keep a shape across state changes (a count, a score) |
| `a.express(expr)`, `a.flash(expr, seconds)` | set the face; a flash is temporary |
| `a.hop(strength)`, `a.squish(amount)`, `a.poke(strength)`, `a.jiggle(strength)` | impulses |
| `a.spinBy(turns)`, `a.shake(amp, freq, decay)` | spin, shake |
| `a.lean.target`, `a.scale.target`, `a.rootX.target`, `a.hover.target` | springs to aim |
| `a.tint.target` + `a.tintColor` | colour wash |
| `a.lookAt(x, y)`, `a.lookFree()` | gaze (−1 to 1) |
| `a.emit({ kind, x, y, vx, vy, ay, life, size, color, … })` | particles: `drop rain spark star smoke puff heart note flake bubble glyph dust square coin bead` |
| `a.fx(name)` | a spring of your own, declared in `effects: { name: { rest, stiffness, damping } }`; read with `a.fxValue(name)` while drawing |
| `a.cues` | a free object for numbers you want to remember (a score, a timer) |
| `a.rand()` | deterministic random |
| `a.time`, `a.state`, `a.expression`, `a.shapeKey`, `a.pointerHere`, `a.pointerSince` | read-only facts |

Particle helpers: `sparkles(a, n, color)`, `confetti(a)`, `floatGlyph(a, text,
kind, color, size)`, `sweat(a)`, `steam(a, n)`. Overlays: `thoughtDots`,
`zzz`, `doneBadge`, `errorBadge`, `helpBadge`.

## Drawing hooks

All receive `r`: `r.g` (canvas 2D), `r.R` (pixels per body unit), `r.toPx(x, y)`
(body units to pixels, following hops, squash and lean), `r.box` (outline
bounds), `r.bodyPath`, `r.palette`, `r.face`, `r.cx`/`r.cy` (where it stands,
fixed), `r.time`, `r.actor`.

- `paintBack(r)`: behind the body (glows, a puddle, a string).
- `paintBody(r)`: inside the body, clipped to it (shading, stripes, letters).
- `paintFace(r)`: on top, unclipped (a beak, a flag, bath water in front).
- `drawFace(r)`: replaces the eyes.
- `outlineMod(points, t, a)`: bend the outline at draw time (a rippling hem, gear teeth).
- `straight: true`: straight edges (blocks, paper). `thicken: false` for hard bodies.
- `effects: { opacity: {...} }`: the body becomes see-through by that spring.

## Sounds

A character can have its own sounds, synthesized (no files). Keys are action
ids, plus `tap`, `land`, `grab`, `release` and `hello`; missing ones use the
shared set. Times are seconds from the moment the action starts, so a sound
can land where the action lands. The page plays them only when sound is on
(`<live-ling sound>`), after the first click.

```js
import { chime, clack, thud, whoosh, patter, squeak, splash, blip, note } from '../livelings.js'

sounds: {
  tap: (s) => clack(s, 900),                                   // a wooden knock
  stamp: (s) => thud(s, 0.5, 0.28, 130),                        // lands at 0.5 s, like the stamp
  done: (s) => chime(s, [72, 76, 79, 84]),                      // notes are MIDI numbers
  boo: (s) => s.tone({ f: 260, to: 430, dur: 0.6, gain: 0.16, type: 'sawtooth', vibrato: [5, 18] }),
  rain: (s) => patter(s, 40, 2.3, 4200, 0.05, 0.3)              // many tiny clicks
}
```

`s.tone({ f, to, dur, type, gain, at, vibrato, filter })` and `s.noise({ dur,
gain, at, type, f, to, q })` are the two primitives; the helpers are built on
them. Keep sounds short and quiet: they play while people use the product.

## Reacting to people

```js
react: {
  tap(a, count) { roll(a); return true },          // count = taps in a row
  startle(a, dx) { vanish(a); return true },       // a pointer whipped past
  purr(a) { … },                                   // a pointer resting on it
  giggle(a) { … },                                 // rubbed back and forth
  arrive(a, awayFor) { if (awayFor > 2) boo(a) }   // the pointer came back
},
update(a, dt) { /* runs every step, whatever the state */ }
```

Return true to replace the shared reaction (pokes, dizzy after three taps,
cross after five).

## Cards (`cards/<slug>.json`)

```json
{
  "title": "等待，也可以**很香**",
  "subtitle": "a smaller line",
  "character": "inky" | "./characters/mine.js",
  "palette": "main",
  "action": "done",
  "at": 1.0,
  "side": "right" | "left" | "center",
  "scale": 1,
  "background": "paper" | "white" | "#hex",
  "notes": [{ "text": "a handwritten note", "x": 0.5, "y": 0.2, "color": "red" | "blue" | "orange" | "green", "arrow": [0.66, 0.34] }],
  "props": [{ "shape": "star", "x": 0.9, "y": 0.2, "size": 0.035, "color": "#ffd43b" }],
  "width": 1600, "height": 900,
  "credit": false
}
```

Positions are fractions of the card. `at` is the moment of the action used for
still exports.
