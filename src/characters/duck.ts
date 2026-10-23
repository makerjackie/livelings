import { at, every, floatGlyph, sparkles, thoughtDots, variant, zzz } from '../engine/behaviors'
import { TAU, clamp, mixHex, withAlpha } from '../engine/math'
import { discs, transform } from '../engine/shapes'
import type { Actor } from '../engine/actor'
import type { CharacterDef, RenderCtx } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

/** A bath duck facing left: round head, plump body, a tail that turns up. */
const duckShape = () =>
  transform(
    discs([
      { x: -0.3, y: -0.42, r: 0.44 },
      { x: 0.02, y: 0.28, r: 0.62 },
      { x: 0.42, y: 0.24, r: 0.52 },
      { x: 0.82, y: -0.06, r: 0.2 }
    ]),
    0.92,
    0.92,
    0,
    0.02
  )

const WATER = 0.56

/** The bath water is part of the scene, not the duck: it bobs in it. */
function water(r: RenderCtx) {
  const { g, R, cx, cy, time } = r
  const y0 = cy + R * WATER
  const left = cx - R * 3
  const right = cx + R * 3
  g.save()
  g.beginPath()
  g.moveTo(left, y0)
  for (let x = left; x <= right; x += R * 0.1) {
    g.lineTo(x, y0 + Math.sin((x - cx) / R * 3.2 + time * 2.6) * R * 0.035)
  }
  g.lineTo(right, cy + R * 1.4)
  g.lineTo(left, cy + R * 1.4)
  g.closePath()
  g.fillStyle = withAlpha('#74c0fc', 0.42)
  g.fill()
  g.strokeStyle = withAlpha('#ffffff', 0.9)
  g.lineWidth = R * 0.05
  g.beginPath()
  for (let x = left; x <= right; x += R * 0.1) {
    const y = y0 + Math.sin((x - cx) / R * 3.2 + time * 2.6) * R * 0.035
    if (x === left) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  // ripples when it moves about
  const ripple = clamp(r.actor.fxValue('ripple'))
  if (ripple > 0.02) {
    const k = (time * 0.8) % 1
    g.strokeStyle = withAlpha('#ffffff', ripple * (1 - k))
    g.lineWidth = R * 0.03
    g.beginPath()
    g.ellipse(cx + r.actor.rootX.value * R, y0 + R * 0.02, R * (0.9 + k * 0.9), R * (0.08 + k * 0.08), 0, 0, TAU)
    g.stroke()
  }
  g.restore()
}

/** Beak (opens to quack), wing and a dab of shine. */
function features(r: RenderCtx) {
  const { g, R, palette: pal, actor: a } = r
  const ink = pal.outline ?? '#3d2e05'
  const open = clamp(a.fxValue('beak'))
  const flap = a.fxValue('flap')
  const tip = r.toPx(-1.02, -0.3)
  const root = r.toPx(-0.62, -0.34)
  const len = Math.hypot(tip.x - root.x, tip.y - root.y)
  const ang = Math.atan2(tip.y - root.y, tip.x - root.x)
  g.save()
  g.translate(root.x, root.y)
  g.rotate(ang)
  g.fillStyle = pal.accent
  g.strokeStyle = ink
  g.lineWidth = R * 0.045
  g.lineJoin = 'round'
  const bx = len * 0.48
  const rx = len * 0.6
  const ry = R * 0.13
  // a closed bill is one rounded shape; it opens into two halves to quack
  for (const side of [-1, 1]) {
    g.save()
    g.rotate(side * open * 0.32)
    g.beginPath()
    g.ellipse(bx, 0, rx, ry, 0, side < 0 ? Math.PI : 0, side < 0 ? Math.PI * 2 : Math.PI)
    g.closePath()
    g.fill()
    g.restore()
  }
  g.beginPath()
  g.save()
  g.rotate(-open * 0.32)
  g.ellipse(bx, 0, rx, ry, 0, Math.PI, Math.PI * 2)
  g.restore()
  g.save()
  g.rotate(open * 0.32)
  g.ellipse(bx, 0, rx, ry, 0, 0, Math.PI)
  g.restore()
  g.stroke()
  g.lineWidth = R * 0.03
  g.beginPath()
  g.moveTo(bx - rx * 0.5, 0)
  g.lineTo(bx + rx * 0.85, 0)
  g.stroke()
  g.restore()
  // the wing, which flaps when it is pleased
  const w = r.toPx(0.3, 0.12)
  g.save()
  g.translate(w.x, w.y)
  g.rotate(-0.35 - flap * 0.9)
  g.fillStyle = mixHex(pal.body, '#000000', 0.08)
  g.strokeStyle = ink
  g.lineWidth = R * 0.045
  g.beginPath()
  g.ellipse(R * 0.06, 0, R * 0.34, R * 0.2, 0.2, 0, TAU)
  g.fill()
  g.stroke()
  g.restore()
}

function squeak(a: Actor) {
  a.squish(12)
  a.poke(1.4)
  a.flash('closed', 0.35)
  a.fx('beak').snap(1)
  a.fx('beak').target = 0
  floatGlyph(a, '♪', 'note', a.palette.outline ?? '#3d2e05', 0.24)
}

function bubbles(a: Actor, n = 4) {
  const c = a.bodyCenter()
  for (let i = 0; i < n; i++) {
    a.emit({ kind: 'bubble', x: c.x + (a.rand() - 0.5) * 1.2, y: WATER + 0.2, vy: -0.8 - a.rand() * 0.6, vx: (a.rand() - 0.5) * 0.4, life: 1, size: 0.05 + a.rand() * 0.05, color: '#ffffff' })
  }
}

function splash(a: Actor, n = 8) {
  const c = a.bodyCenter()
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1
    a.emit({ kind: 'drop', x: c.x + side * (0.5 + a.rand() * 0.4), y: WATER, vx: side * (0.8 + a.rand() * 1.4), vy: -2.4 - a.rand() * 1.4, ay: 9, life: 0.8, size: 0.06, color: '#74c0fc' })
  }
}

export const duck: CharacterDef = {
  id: 'duck',
  name: label('Quack', '嘎嘎'),
  material: label('Rubber duck', '橡皮鸭'),
  tagline: label('Squeaks when squeezed. Listens while you debug.', '一捏就吱，你讲 bug 它认真听。'),
  bio: label(
    'Quack is the bath-tub duck programmers explain their bugs to. It bobs in its own little bath, nods along while it listens, and squeaks when you press it. Squeeze it three times and it tips bottom-up, then rights itself; finish something and it flaps and quacks.',
    '嘎嘎就是程序员拿来讲 bug 的那只小黄鸭。它漂在自己的小澡盆里，你说话它就认真点头，你一捏它就吱一声。连捏三下它会翻个底朝天再翻回来；事情办成了，它会拍着翅膀嘎嘎叫。'
  ),
  traits: { en: ['Squeaks', 'Good listener', 'Always afloat'], zh: ['一捏就吱', '最会倾听', '永远浮着'] },
  physics: physics({ floaty: true, hover: 0.02, hopPower: 2.2, squashiness: 1.3, squashStiffness: 260, squashDamping: 9, softStiffness: 220, softDamping: 9, breath: 0.015 }),
  eyes: { w: 0.15, h: 0.22, corner: 1, spacing: 0.42, lift: 0.08, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  eyeShine: 0.7,
  outlineWidth: 0.055,
  splash: false,
  face: { x: -0.28, y: -0.4, r: 0.36 },
  rest: duckShape,
  shapes: {
    wide: () => transform(duckShape(), 1.12, 0.86, 0, 0.12),
    tall: () => transform(duckShape(), 0.9, 1.1, 0, -0.08)
  },
  palettes: [
    { id: 'classic', body: '#ffd43b', accent: '#ff922b', outline: '#3d2e05', eye: '#1f1a0e', mark: '#3d2e05' },
    { id: 'pink', body: '#ffc9de', accent: '#ff8787', outline: '#3b1d2a', eye: '#2a121d', mark: '#3b1d2a' },
    { id: 'mint', body: '#b2f2bb', accent: '#ffa94d', outline: '#163a1f', eye: '#0f2615', mark: '#163a1f' },
    { id: 'snow', body: '#f8f9fa', accent: '#ffa94d', outline: '#2b2d42', eye: '#1b1c2b', mark: '#2b2d42' },
    { id: 'pirate', body: '#495057', accent: '#ffd43b', outline: '#101113', eye: '#ffffff', mark: '#495057' }
  ],
  accessories: pickAccessories('cap', 'crown', 'beret'),
  effects: {
    beak: { rest: 0, stiffness: 90, damping: 10 },
    flap: { rest: 0, stiffness: 160, damping: 8 },
    ripple: { rest: 0, stiffness: 40, damping: 10 }
  },
  // the bath is drawn after the duck, so it sits in the water
  paintFace(r) {
    features(r)
    water(r)
  },
  react: {
    tap(a, n) {
      if (n === 3) {
        a.cues.flipUntil = a.time + 1.3
        a.lean.target = Math.PI
        bubbles(a, 5)
        return true
      }
      squeak(a)
      return true
    }
  },
  update(a) {
    if (a.time > (a.cues.flipUntil ?? -1) && a.cues.flipUntil) {
      a.cues.flipUntil = 0
      a.lean.target = 0
      a.flash('dizzy', 1)
    }
  },
  actions: {
    listening: variant('listening', {
      // rubber-duck debugging: it nods along
      enter(a) {
        a.express({ w: 1.08, h: 1.08, lift: 0.1 })
        a.lookAt(-0.6, 0)
      },
      tick(a, t, dt) {
        if (every(t, dt, 1.3, 0.4)) {
          a.squish(4)
          a.lean.velocity -= 1.2
        }
      }
    }),
    thinking: variant('thinking', {
      tick(a, t) {
        a.lean.target = -0.16 + Math.sin(t * 1.2) * 0.05
      },
      front: thoughtDots
    }),
    working: variant('working', {
      // paddles in circles
      enter(a) {
        a.express('focused')
        a.fx('ripple').target = 1
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 1.6) * 0.5
        a.lean.target = Math.cos(t * 1.6) * 0.08
        if (every(t, dt, 0.9)) bubbles(a, 1)
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('happy')
        a.hop(1)
        a.fx('beak').snap(1)
      },
      tick(a, t, dt) {
        a.fx('flap').target = t < 1.2 ? (Math.sin(t * 22) > 0 ? 1 : 0) : 0
        if (at(t, dt, 0.3)) {
          splash(a)
          sparkles(a, 6, '#ffd43b')
          floatGlyph(a, '♪', 'note', a.palette.outline ?? '#3d2e05', 0.28)
        }
      },
      front: undefined
    }),
    error: variant('error', {
      // bottoms up
      enter(a) {
        a.express('surprised')
        a.lean.target = Math.PI
        bubbles(a, 5)
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.2)) {
          a.lean.target = 0
          a.express('dizzy')
        }
      }
    }),
    sleep: variant('sleep', {
      enter(a) {
        a.express('closed')
        a.lean.target = 0.12
      },
      front: zzz
    }),
    squeak: {
      kind: 'once',
      duration: 1.3,
      label: label('Squeak', '吱'),
      enter(a) {
        squeak(a)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.45)) squeak(a)
      }
    },
    quack: {
      kind: 'once',
      duration: 1.6,
      label: label('Quack', '嘎嘎'),
      enter(a) {
        a.express('excited')
      },
      tick(a, t, dt) {
        a.fx('beak').target = t < 1 ? (Math.sin(t * 18) > 0 ? 1 : 0) : 0
        if (at(t, dt, 0.1) || at(t, dt, 0.55)) floatGlyph(a, '♪', 'note', a.palette.outline ?? '#3d2e05', 0.26)
      }
    },
    flip: {
      kind: 'once',
      duration: 2.2,
      label: label('Bottoms up', '翻个底朝天'),
      enter(a) {
        a.express('surprised')
        a.lean.target = Math.PI
        bubbles(a, 6)
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.2)) {
          a.lean.target = 0
          a.express('dizzy')
          splash(a, 4)
        }
      }
    },
    paddle: {
      kind: 'once',
      duration: 3,
      label: label('Paddle', '划水'),
      enter(a) {
        a.express('happy')
        a.fx('ripple').target = 1
      },
      tick(a, t) {
        a.rootX.target = t < 2.4 ? Math.sin(t * 2.6) * 0.9 : 0
        a.lean.target = t < 2.4 ? Math.cos(t * 2.6) * 0.1 : 0
      }
    },
    dive: {
      kind: 'once',
      duration: 2.6,
      label: label('Dive', '扎猛子'),
      enter(a) {
        a.express('closed')
        a.hover.target = -1.3
        a.lean.target = -0.5
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) bubbles(a, 6)
        if (at(t, dt, 1.3)) {
          a.hover.target = 0.02
          a.lean.target = 0
          a.hop(1.2)
          a.express('excited')
          splash(a, 10)
        }
      }
    }
  },
  signature: ['squeak', 'quack', 'flip', 'paddle', 'dive'],
  fidgets: ['quack', 'paddle', 'look-around', 'squeak']
}
