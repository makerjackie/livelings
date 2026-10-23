import { at, every, sparkles, variant, zzz } from '../engine/behaviors'
import { TAU, clamp, withAlpha, type Vec } from '../engine/math'
import { circle, resample } from '../engine/shapes'
import type { Actor } from '../engine/actor'
import type { CharacterDef, RenderCtx } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

/**
 * The lit part of the moon, `k` of the way from a sliver (0) to full (1):
 * the disc minus a same-sized shadow disc slid off to the right.
 */
function crescent(k: number) {
  if (k > 0.97) return circle()
  const d = 0.25 + 1.75 * k
  const yi = Math.sqrt(Math.max(0, 1 - (d * d) / 4))
  const xi = d / 2
  const top = Math.atan2(-yi, xi)
  const bottom = Math.atan2(yi, xi)
  const pts: Vec[] = []
  // outer edge: the long way round from the top meeting point to the bottom one
  for (let i = 0; i <= 64; i++) {
    const a = top - (i / 64) * (TAU - (bottom - top))
    pts.push({ x: Math.cos(a), y: Math.sin(a) })
  }
  // inner edge: the shadow disc's left side, back up to the top
  const innerTop = Math.atan2(-yi, xi - d)
  const innerBottom = Math.atan2(yi, xi - d)
  for (let i = 1; i < 32; i++) {
    const a = innerBottom + (i / 32) * (innerTop + TAU - innerBottom)
    pts.push({ x: d + Math.cos(a), y: Math.sin(a) })
  }
  return resample(pts.map((p) => ({ x: p.x * 0.98 + (1 - k) * 0.25, y: p.y * 0.98 })))
}

const PHASES = [0.32, 0.5, 0.7, 0.86, 1]

/** Soft moonlight around it. */
function moonlight(r: RenderCtx) {
  const { g, R, palette: pal } = r
  const c = r.toPx(0, 0)
  const glow = g.createRadialGradient(c.x, c.y, R * 0.6, c.x, c.y, R * 1.9)
  glow.addColorStop(0, withAlpha(pal.accent, 0.35))
  glow.addColorStop(1, withAlpha(pal.accent, 0))
  g.fillStyle = glow
  g.beginPath()
  g.arc(c.x, c.y, R * 1.9, 0, TAU)
  g.fill()
}

/** A few soft craters. */
function craters(r: RenderCtx) {
  const { g, R, palette: pal } = r
  g.fillStyle = withAlpha(pal.core ?? '#e9d58a', 0.6)
  for (const [x, y, s] of [
    [-0.55, -0.45, 0.13],
    [-0.62, 0.42, 0.09],
    [-0.2, 0.68, 0.07],
    [0.3, -0.62, 0.06]
  ]) {
    const p = r.toPx(x, y)
    g.beginPath()
    g.arc(p.x, p.y, R * s, 0, TAU)
    g.fill()
  }
}

function stars(a: Actor, n = 5) {
  const c = a.bodyCenter()
  for (let i = 0; i < n; i++) {
    const ang = a.rand() * TAU
    const d = 1.2 + a.rand() * 0.5
    a.emit({ kind: 'star', x: c.x + Math.cos(ang) * d, y: c.y + Math.sin(ang) * d * 0.8, vy: -0.1, life: 1 + a.rand() * 0.6, size: 0.06 + a.rand() * 0.06, color: '#ffd43b', vrot: 1.5 })
  }
}

/** Steps through the phases; each step is a morph, so it fills up smoothly. */
function phase(a: Actor, i: number) {
  a.morph(`phase${i}`, { blink: false, squash: 1 })
}

export const moon: CharacterDef = {
  id: 'moon',
  name: label('Luna', '月月'),
  material: label('Moonlight', '月光'),
  tagline: label('Fills up as you go, from a sliver to full.', '你越往前，它就越圆。'),
  bio: label(
    'Luna is the moon, and its phase is a progress bar: it waxes from a thin sliver to a full moon while a job runs, shines full when it is done, and goes dark red in an eclipse when something fails. At night it rocks itself to sleep like a cradle.',
    '月月是一轮月亮，月相就是进度条：事情在进行，它就从细细的月牙慢慢变圆；做完了是一轮满月；出了错会变成红红的月食。到了晚上，它像摇篮一样把自己摇睡着。'
  ),
  traits: { en: ['Phases = progress', 'Full when done', 'Rocks to sleep'], zh: ['月相就是进度', '做完就是满月', '会摇自己入睡'] },
  physics: physics({ floaty: true, hover: 0.28, squashiness: 0.6, hopPower: 2.6, morphStiffness: 110, morphDamping: 13, breath: 0.015 }),
  eyes: { w: 0.15, h: 0.2, corner: 1, spacing: 0.5, lift: 0.02, topLid: 0.25, bottomLid: 0, tilt: 0.1, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.05,
  rest: () => crescent(0.5),
  shapes: Object.fromEntries([
    ...PHASES.map((k, i) => [`phase${i}`, () => crescent(k)]),
    ['full', () => circle()],
    ['wide', () => crescent(0.4)],
    ['tall', () => crescent(0.36)],
    ['sliver', () => crescent(0.18)]
  ]),
  palettes: [
    { id: 'silver', body: '#fff3bf', core: '#ead58c', accent: '#ffe066', outline: '#2b2d42', eye: '#2b2d42', mark: '#2b2d42' },
    { id: 'harvest', body: '#ffc078', core: '#f59f61', accent: '#ffa94d', outline: '#3d2410', eye: '#3d2410', mark: '#3d2410' },
    { id: 'blue', body: '#d0ebff', core: '#a5c9ea', accent: '#a5d8ff', outline: '#16253d', eye: '#16253d', mark: '#16253d' },
    { id: 'ghost', body: '#f1f3f5', core: '#d0d4d9', accent: '#e9ecef', outline: '#212529', eye: '#212529', mark: '#212529' }
  ],
  accessories: pickAccessories('tuft', 'crown', 'flower'),
  paintBack: moonlight,
  paintBody: craters,
  actions: {
    thinking: variant('thinking', {
      tick(a, t) {
        a.lean.target = Math.sin(t * 1.2) * 0.12
      }
    }),
    working: variant('working', {
      // waxing, over and over: a progress bar that fills and starts again
      enter(a) {
        a.express('focused')
        phase(a, 0)
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.9, 0.9)) phase(a, Math.floor(t / 0.9) % PHASES.length)
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('proud')
        a.morph('full', { squash: 2 })
        a.hop(0.6)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) stars(a, 7)
      },
      front: undefined
    }),
    error: variant('error', {
      enter(a) {
        a.express('sad')
        a.morph('full', { blink: false })
        a.tintColor = '#a61e4d'
        a.tint.target = 0.55
        a.shake(0.04, 20, 2)
      }
    }),
    sleep: variant('sleep', {
      enter(a) {
        a.express('closed')
        a.morph('sliver')
      },
      tick(a, t) {
        a.lean.target = Math.sin(t * 1.3) * 0.22
      },
      front: zzz
    }),
    wax: {
      kind: 'once',
      duration: 2.8,
      label: label('Wax', '慢慢变圆'),
      enter(a) {
        a.express('focused')
        a.morph('sliver', { squash: 0 })
      },
      tick(a, t, dt) {
        PHASES.forEach((_, i) => at(t, dt, 0.35 + i * 0.32) && phase(a, i))
        if (at(t, dt, 1.95)) {
          a.express('proud')
          stars(a, 5)
        }
      }
    },
    wane: {
      kind: 'once',
      duration: 2.6,
      label: label('Wane', '慢慢变弯'),
      enter(a) {
        a.express('soft')
        a.morph('full', { squash: 0 })
      },
      tick(a, t, dt) {
        ;[4, 3, 2, 1, 0].forEach((k, i) => at(t, dt, 0.35 + i * 0.3) && phase(a, k))
        if (at(t, dt, 1.9)) a.morph('sliver')
      }
    },
    twinkle: {
      kind: 'once',
      duration: 2,
      label: label('Twinkle', '眨星星'),
      enter(a) {
        a.express('happy')
        stars(a, 6)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.8)) stars(a, 4)
      }
    },
    eclipse: {
      kind: 'once',
      duration: 2.4,
      label: label('Eclipse', '月食'),
      enter(a) {
        a.express('surprised')
        a.morph('full')
        a.tintColor = '#a61e4d'
        a.tint.target = 0.6
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.5)) {
          a.tint.target = 0
          a.express('happy')
          sparkles(a, 4, '#ffe066')
        }
      }
    },
    swing: {
      kind: 'once',
      duration: 3,
      label: label('Rock-a-bye', '摇啊摇'),
      enter(a) {
        a.express('closed')
      },
      tick(a, t) {
        a.lean.target = Math.sin(t * 2.4) * 0.3 * clamp(2.6 - t)
      }
    }
  },
  signature: ['wax', 'wane', 'twinkle', 'eclipse', 'swing'],
  fidgets: ['twinkle', 'swing', 'look-around', 'wiggle']
}
