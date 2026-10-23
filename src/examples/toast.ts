// Toasty: a slice of bread that lives in a toaster and pops out when it is done.
// Made with the Livelings skill, as an example of a character file.
import { defineCharacter, label, physics, shapes, at, every, sparkles, steam, floatGlyph, variant, mixHex, withAlpha, TAU } from '../index'
import type { Actor, RenderCtx } from '../index'

/** A slice of sandwich bread: two round shoulders on a square body. */
const slice = () =>
  shapes.normalize(
    shapes.discs([
      { x: -0.42, y: -0.45, r: 0.48 },
      { x: 0.42, y: -0.45, r: 0.48 },
      { x: 0, y: 0.25, r: 0.78 },
      { x: -0.5, y: 0.45, r: 0.5 },
      { x: 0.5, y: 0.45, r: 0.5 }
    ]),
    1.02
  )

/** The toaster is part of its world: drawn in front, fixed to the floor, so the slice sits in its slot. */
function toaster(r: RenderCtx) {
  const { g, R, cx, cy, actor: a } = r
  const ink = r.palette.outline ?? '#3b2414'
  const x = cx - R * 1.25
  const y = cy + R * 0.32
  const w = R * 2.5
  const h = R * 0.78
  g.save()
  g.lineWidth = R * 0.055
  g.strokeStyle = ink
  g.fillStyle = r.palette.accent
  g.beginPath()
  g.roundRect(x, y, w, h, R * 0.22)
  g.fill()
  g.stroke()
  // shine, slot and the lever (pressed down while it toasts)
  g.fillStyle = withAlpha('#ffffff', 0.45)
  g.beginPath()
  g.roundRect(x + R * 0.18, y + R * 0.14, w * 0.5, R * 0.08, R * 0.04)
  g.fill()
  const lever = a.fxValue('lever')
  g.fillStyle = ink
  g.beginPath()
  g.roundRect(x + w - R * 0.05, y + R * (0.18 + 0.32 * lever), R * 0.26, R * 0.1, R * 0.04)
  g.fill()
  g.beginPath()
  g.arc(x + R * 0.3, y + h - R * 0.22, R * 0.08, 0, TAU)
  g.stroke()
  g.restore()
}

/** Toasting browns the bread from the middle out; the crust is always a touch darker. */
function bread(r: RenderCtx) {
  const { g, R, palette: pal, actor: a, bodyPath } = r
  const done = Math.min(1, a.fxValue('toast'))
  g.strokeStyle = mixHex(pal.core ?? '#d9934a', '#3b2414', done * 0.6)
  g.lineWidth = R * 0.2
  g.stroke(bodyPath)
  if (done > 0.01) {
    const c = r.toPx(0, 0)
    const glow = g.createRadialGradient(c.x, c.y, R * 0.1, c.x, c.y, R * 1.1)
    glow.addColorStop(0, withAlpha('#c27c3a', done * 0.8))
    glow.addColorStop(1, withAlpha('#c27c3a', done * 0.35))
    g.fillStyle = glow
    g.fill(bodyPath)
  }
  const burnt = Math.min(1, a.fxValue('burnt'))
  if (burnt > 0.01) {
    g.fillStyle = withAlpha('#2b1d14', burnt * 0.85)
    g.fill(bodyPath)
  }
}

function pop(a: Actor, height = 1.5) {
  a.fx('lever').target = 0
  a.hop(height)
  a.squish(-6)
  floatGlyph(a, 'DING!', 'glyph', a.palette.outline ?? '#3b2414', 0.24)
}

export default defineCharacter({
  id: 'toast',
  name: label('Toasty', '吐吐'),
  material: label('Toast', '吐司'),
  tagline: label('Pops out of the toaster when it is done.', '事情办完，它就从吐司机里弹出来。'),
  bio: label(
    'Toasty lives in a toaster. While you wait it goes golden and steams; when the job is done it pops up with a ding; when something goes wrong it burns, smokes and looks embarrassed.',
    '吐吐住在吐司机里。你等着的时候它慢慢烤黄、冒热气；事情一办完就「叮」地弹出来；出了错就烤焦了，冒着黑烟，一脸不好意思。'
  ),
  traits: { en: ['Pops when done', 'Golden while working', 'Burns under pressure'], zh: ['做完就弹出来', '干活时变金黄', '压力大会烤焦'] },
  physics: physics({ gravity: 13, hopPower: 4, squashiness: 0.8, bounce: 0.15 }),
  eyes: { w: 0.15, h: 0.22, corner: 1, spacing: 0.5, lift: 0.2, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.055,
  splash: false,
  rest: slice,
  shapes: {
    // its own versions of the shapes shared actions use, so it stays a slice of bread
    wide: () => shapes.transform(slice(), 1.15, 0.78, 0, 0.22),
    tall: () => shapes.transform(slice(), 0.88, 1.15, 0, -0.15),
    pancake: () => shapes.transform(slice(), 1.2, 0.6, 0, 0.4)
  },
  palettes: [
    { id: 'white', body: '#ffe8b8', core: '#d9934a', accent: '#ff8787', outline: '#3b2414', eye: '#3b2414', mark: '#3b2414' },
    { id: 'rye', body: '#e9c38f', core: '#a8672d', accent: '#74c0fc', outline: '#2b1a0e', eye: '#2b1a0e', mark: '#2b1a0e' },
    { id: 'matcha', body: '#d8f0b8', core: '#8cb35a', accent: '#ffd43b', outline: '#1f2e12', eye: '#1f2e12', mark: '#1f2e12' }
  ],
  effects: {
    toast: { rest: 0, stiffness: 2, damping: 3 },
    burnt: { rest: 0, stiffness: 3, damping: 3.5 },
    lever: { rest: 0, stiffness: 120, damping: 14 }
  },
  paintBody: bread,
  paintFace: toaster,
  react: {
    tap(a, n) {
      if (n >= 3) {
        a.fx('burnt').snap(1)
        a.flash('worried', 1.4)
        steam(a, 4)
      } else pop(a, 1.1)
      return true
    }
  },
  actions: {
    working: variant('working', {
      enter(a) {
        a.express('focused')
        a.fx('lever').target = 1
        a.fx('toast').target = 1
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.8)) steam(a, 1)
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('excited')
        a.fx('toast').snap(0.7)
        pop(a)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.5)) sparkles(a, 6, '#ffd43b')
      },
      front: undefined
    }),
    error: variant('error', {
      enter(a) {
        a.express('worried')
        a.fx('burnt').target = 1
        a.fx('lever').target = 1
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.4)) steam(a, 2)
        if (at(t, dt, 1.2)) pop(a, 0.8)
      }
    }),
    pop: {
      kind: 'once',
      duration: 2,
      label: label('Pop!', '弹出来'),
      enter(a) {
        a.express('excited')
        pop(a)
      }
    },
    toastUp: {
      kind: 'once',
      duration: 3,
      label: label('Toast', '烤一烤'),
      enter(a) {
        a.express('focused')
        a.fx('lever').target = 1
        a.fx('toast').target = 1
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.5)) steam(a, 1)
        if (at(t, dt, 2.2)) pop(a)
      }
    },
    burn: {
      kind: 'once',
      duration: 2.6,
      label: label('Burnt', '烤焦了'),
      enter(a) {
        a.express('worried')
        a.fx('burnt').target = 1
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.35)) steam(a, 2)
        if (at(t, dt, 1.8)) a.express('shy')
      }
    }
  },
  signature: ['pop', 'toastUp', 'burn'],
  fidgets: ['pop', 'look-around', 'wiggle']
})
