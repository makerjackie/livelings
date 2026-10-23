import { UNIVERSAL, at, errorBadge, every, sparkles, variant } from '../engine/behaviors'
import { clamp, withAlpha } from '../engine/math'
import { circle, squircle } from '../engine/shapes'
import type { CharacterDef, RenderCtx } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

const stampShape = squircle(4.4, 0.9)

/** Yellow highlighter swipe under the body: Inky's "done" mark. */
function highlighter(r: RenderCtx, t: number, alpha: number) {
  const { g, R, cx, cy } = r
  const k = clamp((t - 0.5) / 0.3)
  if (k <= 0) return
  const eased = 1 - (1 - k) ** 3
  const w = R * 3.1
  const x0 = cx - w / 2
  const y = cy + R * 0.86
  g.save()
  g.globalAlpha = alpha * 0.9
  g.strokeStyle = '#ffd43b'
  g.lineWidth = R * 0.4
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x0, y + R * 0.04)
  g.quadraticCurveTo(x0 + w * eased * 0.5, y + R * 0.08, x0 + w * eased, y - R * 0.05)
  g.stroke()
  g.restore()
}

/** A wobbly line of handwriting that grows under Inky while it works. */
function writingLine(r: RenderCtx, t: number, alpha: number) {
  const { g, R, cx, cy } = r
  g.save()
  g.globalAlpha = alpha
  g.strokeStyle = withAlpha(r.palette.body, 0.85)
  g.lineWidth = R * 0.06
  g.lineCap = 'round'
  g.beginPath()
  const len = (t / 5) % 1.2
  for (let i = 0; i <= 60 * Math.min(1, len); i++) {
    const x = cx - R * 1.3 + (i / 60) * R * 2.6
    const y = cy + R * 1.12 + Math.sin(i * 0.9) * R * 0.05
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  g.restore()
}

export const inky: CharacterDef = {
  id: 'inky',
  name: label('Inky', '小墨'),
  material: label('Ink', '墨'),
  tagline: label('A living drop of ink that stamps your day.', '一滴活的墨，帮你给每一天盖章。'),
  bio: label(
    'Inky was spilled on a habit tracker and decided to stay. It morphs into whatever it needs to be: a stamp, a star, the number of your streak. When it lands too hard, it splashes.',
    '小墨是一滴洒在打卡本上、决定留下来的墨。它想变成什么就变成什么：一枚印章、一颗星、你连续打卡的天数。落地太用力时会溅出墨点。'
  ),
  traits: { en: ['Shape-shifter', 'Stamps everything', 'Splashes when excited'], zh: ['会变形', '什么都想盖个章', '一激动就溅墨'] },
  origin: label('Inky Habits (墨团习惯)', '墨团习惯 App'),
  physics: physics({}),
  eyes: { w: 0.23, h: 0.34, corner: 0.55, spacing: 0.56, lift: 0.08, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'hole',
  sheen: 1,
  rest: () => circle(),
  palettes: [
    { id: 'ink', body: '#141414', eye: '#ffffff', accent: '#ffd43b', mark: '#141414' },
    { id: 'indigo', body: '#283a8f', eye: '#ffffff', accent: '#ffd43b', mark: '#283a8f' },
    { id: 'sepia', body: '#5b3a29', eye: '#ffffff', accent: '#ff922b', mark: '#5b3a29' },
    { id: 'plum', body: '#5f3dc4', eye: '#ffffff', accent: '#ffd43b', mark: '#5f3dc4' },
    { id: 'teal', body: '#0b7285', eye: '#ffffff', accent: '#ffd43b', mark: '#0b7285' },
    { id: 'vermilion', body: '#d6453a', eye: '#ffffff', accent: '#ffd43b', mark: '#d6453a' }
  ],
  accessories: pickAccessories('tuft', 'cap', 'beret', 'sprout'),
  actions: {
    // Inky's own takes on the shared states
    thinking: variant('thinking', {
      enter(a) {
        UNIVERSAL.thinking.enter?.(a, false)
        a.morph('droplet')
      }
    }),
    working: variant('working', {
      enter(a) {
        a.express('focused')
        a.lean.target = 0.1
        a.lookAt(0.5, 0.8)
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 2.2) * 0.25
        if (every(t, dt, 0.35)) a.squish(2)
      },
      back: (r, t, alpha) => writingLine(r, t, alpha),
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('focused')
        a.morph(stampShape)
        a.hop(0.95)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.5)) {
          a.squish(9)
          a.express('proud')
          sparkles(a, 6)
        }
      },
      back: highlighter
    }),
    error: variant('error', {
      enter(a) {
        a.express('sad')
        a.morph('puddle', { squash: 0 })
        a.shake(0.05, 18, 2.5)
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.2)) a.morph('rest')
      },
      front: errorBadge
    }),
    sleep: {
      ...UNIVERSAL.sleep,
      enter(a) {
        a.express('closed')
        a.morph('moon')
      }
    },
    stamp: {
      kind: 'once',
      duration: 1.9,
      label: label('Stamp', '盖章'),
      enter(a) {
        a.express('focused')
        a.morph(stampShape)
        a.hop(0.95)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.5)) {
          a.squish(9)
          a.express('proud')
        }
      },
      back: highlighter
    },
    splat: {
      kind: 'once',
      duration: 2.6,
      label: label('Splat', '躺平'),
      enter(a) {
        a.express('surprised')
        a.hop(0.8)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.5)) {
          a.morph('puddle', { blink: false, squash: 0 })
          a.express('sleepy')
        }
        if (at(t, dt, 1.9)) {
          a.morph('rest')
          a.hop(0.7)
          a.express('happy')
        }
      }
    },
    count: {
      kind: 'once',
      duration: 2.4,
      label: label('Count', '数数'),
      enter(a) {
        a.express('excited')
        a.hop(0.5)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.15)) a.morph('text:1')
        if (at(t, dt, 0.75)) a.morph('text:2')
        if (at(t, dt, 1.35)) {
          a.morph('text:3')
          a.hop(0.5)
        }
      }
    },
    star: {
      kind: 'once',
      duration: 2,
      label: label('Star', '变星星'),
      enter(a) {
        a.express('excited')
        a.morph('star')
        a.spinBy(0.5)
        a.hop(0.8)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.6)) sparkles(a, 8, '#ffd43b')
      }
    },
    splash: {
      kind: 'once',
      duration: 1.4,
      label: label('Shake off', '甩墨'),
      enter(a) {
        a.express('closed')
        a.shake(0.08, 30, 2.5)
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.12) && t < 0.7) {
          const c = a.bodyCenter()
          const side = a.rand() < 0.5 ? -1 : 1
          a.emit({
            kind: 'drop',
            x: c.x + side * 0.9,
            y: c.y - 0.2,
            vx: side * (2 + a.rand() * 1.5),
            vy: -2 - a.rand() * 1.5,
            ay: 9,
            life: 1.3,
            size: 0.06 + a.rand() * 0.04,
            lands: true,
            color: a.palette.body
          })
        }
        if (at(t, dt, 0.8)) a.express('happy')
      }
    },
    write: {
      kind: 'loop',
      label: label('Writing', '写字'),
      enter(a) {
        a.express('focused')
        a.lean.target = 0.1
        a.lookAt(0.5, 0.8)
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 2.2) * 0.25
        if (every(t, dt, 0.35)) a.squish(2)
      },
      back: (r, t, alpha) => writingLine(r, t, alpha)
    }
  },
  signature: ['stamp', 'splat', 'count', 'star', 'splash', 'write'],
  fidgets: ['look-around', 'bounce', 'splash', 'wiggle', 'yawn']
}

