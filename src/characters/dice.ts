import { at, every, sparkles, sweat, thoughtDots, variant } from '../engine/behaviors'
import { TAU, clamp } from '../engine/math'
import { squircle, transform } from '../engine/shapes'
import type { Actor } from '../engine/actor'
import type { CharacterDef, RenderCtx } from '../engine/types'
import { drawGlyph } from '../engine/text'
import { label, physics, pickAccessories } from './kit'

const cube = () => transform(squircle(5.5, 0.88), 1, 1, 0, 0.1)

/** Pips on each face, in units of half the face. Two is a pair of eyes. */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-0.46, 0], [0.46, 0]],
  3: [[-0.52, -0.52], [0, 0], [0.52, 0.52]],
  4: [[-0.46, -0.46], [0.46, -0.46], [-0.46, 0.46], [0.46, 0.46]],
  5: [[-0.52, -0.52], [0.52, -0.52], [0, 0], [-0.52, 0.52], [0.52, 0.52]],
  6: [[-0.46, -0.56], [0.46, -0.56], [-0.46, 0], [0.46, 0], [-0.46, 0.56], [0.46, 0.56]]
}
const PIP_SIZE: Record<number, number> = { 1: 0.26, 2: 0.19, 3: 0.15, 4: 0.15, 5: 0.14, 6: 0.13 }

/** Which face it shows for each feeling: the die's face is its expression. */
const FACE_OF: Record<string, number> = {
  neutral: 2,
  custom: 2,
  soft: 2,
  shy: 2,
  wink: 2,
  surprised: 1,
  curious: 1,
  sad: 1,
  dizzy: 3,
  worried: 3,
  focused: 4,
  sleepy: 4,
  closed: 4,
  excited: 5,
  angry: 5,
  happy: 6,
  proud: 6
}

const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** The face showing right now: tumbling faces, then the result, then its mood. */
function faceNow(a: Actor): number {
  if (a.time < (a.cues.rollUntil ?? -1)) return 1 + Math.floor(hash(Math.floor(a.time * 14)) * 6)
  if (a.time < (a.cues.showUntil ?? -1)) return a.cues.result
  return FACE_OF[a.expression] ?? 2
}

/** Every pip is a little eye: it blinks, squints and smiles with the expression. */
function pips(r: RenderCtx) {
  const { g, R, palette: pal, actor: a } = r
  const n = faceNow(a)
  const e = a.eyes
  const base = a.def.eyes
  const sx = clamp(e.w / base.w, 0.5, 1.6)
  const sy = clamp(e.h / base.h, 0.4, 1.6)
  const lid = clamp(Math.max(e.topLid, a.lid * 0.92))
  const smile = clamp(e.bottomLid)
  const look = a.look
  // Chinese dice paint the one and the four red
  g.fillStyle = n === 1 || n === 4 ? pal.accent : pal.eye
  for (const [px, py] of PIPS[n]) {
    const c = r.toPx(px * 0.5 + look.x * 0.9, 0.1 + py * 0.5 + look.y * 0.6)
    const rx = R * PIP_SIZE[n] * sx
    const ry = R * PIP_SIZE[n] * sy
    g.save()
    g.beginPath()
    // lids cut from the top, a smile bites from below
    g.rect(c.x - rx * 1.2, c.y - ry + ry * 2 * lid - 0.6, rx * 2.4, ry * 2 * (1 - lid) - ry * 2 * smile * 0.55 + 1.2)
    g.clip()
    g.beginPath()
    g.ellipse(c.x, c.y, rx, ry, 0, 0, TAU)
    g.fill()
    g.restore()
  }
}

/** A die has volume: a lit top edge and a shaded right side. */
function cubeShade(r: RenderCtx) {
  const { g, box } = r
  const shade = g.createLinearGradient(box.x, 0, box.x + box.w, 0)
  shade.addColorStop(0.72, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.09)')
  g.fillStyle = shade
  g.fillRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8)
  const lit = g.createLinearGradient(0, box.y, 0, box.y + box.h)
  lit.addColorStop(0, 'rgba(255,255,255,0.6)')
  lit.addColorStop(0.18, 'rgba(255,255,255,0)')
  g.fillStyle = lit
  g.fillRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8)
}

/** Throw it: it hops and spins, faces flicker, and it lands showing `result`. */
function roll(a: Actor, result?: number, hold = 1.5) {
  const n = result ?? 1 + Math.floor(a.rand() * 6)
  a.cues.rollUntil = a.time + 0.85
  a.cues.result = n
  a.cues.showUntil = a.time + 0.85 + hold
  a.hop(0.95)
  a.spinBy(a.rand() < 0.5 ? 1 : -1)
  a.squish(-3)
  return n
}

/** The number it landed on, popping up beside it for a moment. */
function score(r: RenderCtx) {
  const a = r.actor
  const landed = a.cues.rollUntil ?? -1
  if (a.time < landed || a.time > (a.cues.showUntil ?? -1)) return
  const { g, R, bx, by } = r
  const k = clamp((a.time - landed) / 0.2)
  const n = a.cues.result
  g.save()
  g.globalAlpha = k * clamp(((a.cues.showUntil ?? 0) - a.time) / 0.3)
  drawGlyph(g, String(n), bx - R * 1.1, by - R * (0.75 + k * 0.15), R * 0.5, n === 6 ? '#fab005' : n === 1 ? '#e03131' : r.palette.mark ?? '#212529')
  g.restore()
}

export const dice: CharacterDef = {
  id: 'dice',
  name: label('Pips', '点点'),
  material: label('Dice', '骰子'),
  tagline: label('Every face is a mood. Tap it to roll.', '每一面都是一种心情，点一下就掷。'),
  bio: label(
    'Pips is a die whose pips are its eyes, so every face is a feeling: two for an ordinary day, one big red eye when it is startled, a dizzy diagonal three, a squinting four when it concentrates, and a full six when it is delighted. Tap it and it rolls. Good news lands on six; bad news on a lonely one.',
    '点点是一颗骰子，它的点数就是它的眼睛，所以每一面都是一种心情：平常是两个点，吓一跳是一个大红点，晕头转向是斜着的三点，专心是眯着的四点，开心到不行就是六点。点它一下就会掷一次。好消息掷出六，坏消息只剩孤零零的一。'
  ),
  traits: { en: ['Face = mood', 'Tap to roll', 'Lucky six'], zh: ['点数就是表情', '一点就掷', '幸运六'] },
  physics: physics({ squashiness: 0.45, bounce: 0.25, hopPower: 3.8, gravity: 14, softStiffness: 380, softDamping: 18, breath: 0.012 }),
  eyes: { w: 0.2, h: 0.2, corner: 1, spacing: 0.6, lift: 0, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.055,
  rest: cube,
  shapes: {
    wide: () => transform(cube(), 1.12, 0.84, 0, 0.17),
    tall: () => transform(cube(), 0.9, 1.12, 0, -0.12),
    pancake: () => transform(cube(), 1.2, 0.6, 0, 0.42)
  },
  palettes: [
    { id: 'classic', body: '#fffdf8', eye: '#212529', accent: '#e03131', outline: '#212529', mark: '#212529' },
    { id: 'casino', body: '#e03131', eye: '#ffffff', accent: '#ffd43b', outline: '#3a0d0d', mark: '#3a0d0d' },
    { id: 'night', body: '#343a40', eye: '#ffffff', accent: '#ff6b6b', outline: '#101113', mark: '#343a40' },
    { id: 'mint', body: '#d3f9d8', eye: '#1b3a24', accent: '#e8590c', outline: '#1b3a24', mark: '#1b3a24' },
    { id: 'honey', body: '#ffe8a3', eye: '#3d2e05', accent: '#e03131', outline: '#3d2e05', mark: '#3d2e05' }
  ],
  accessories: pickAccessories('cap', 'crown', 'bow'),
  paintBody: cubeShade,
  drawFace: pips,
  paintFace: score,
  react: {
    // tapping a die throws it
    tap(a) {
      roll(a)
      return true
    }
  },
  actions: {
    thinking: variant('thinking', {
      enter(a) {
        a.express('curious')
        a.lookAt(0.7, -0.9)
      },
      tick(a, t, dt) {
        if (every(t, dt, 2.4, 0.6)) roll(a, 3, 1)
      },
      front: thoughtDots
    }),
    working: variant('working', {
      // a slot machine: faces flicker while it works
      enter(a) {
        a.express('focused')
      },
      tick(a, t, dt) {
        a.cues.rollUntil = a.time + 0.2
        if (every(t, dt, 0.5)) a.squish(2.2)
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('happy')
        roll(a, 6, 1.4)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.95)) sparkles(a, 8, '#ffd43b')
      },
      front: undefined
    }),
    error: variant('error', {
      enter(a) {
        a.express('sad')
        roll(a, 1, 1.2)
      },
      tick(a, t, dt) {
        if (at(t, dt, 1)) {
          a.shake(0.05, 22, 2)
          sweat(a)
        }
      },
      front: undefined
    }),
    roll: {
      kind: 'once',
      duration: 2.4,
      label: label('Roll', '掷一下'),
      enter(a) {
        roll(a)
      },
    },
    lucky: {
      kind: 'once',
      duration: 2.6,
      label: label('Lucky six', '掷出六'),
      enter(a) {
        a.express('excited')
        roll(a, 6, 1.6)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.9)) {
          a.express('happy')
          a.hop(0.5)
          sparkles(a, 10, '#ffd43b')
        }
      },
    },
    snake: {
      kind: 'once',
      duration: 2.4,
      label: label('Rolled a one', '掷出一'),
      enter(a) {
        roll(a, 1, 1.4)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.9)) {
          a.express('sad')
          a.squish(3)
        }
      },
    },
    tumble: {
      kind: 'once',
      duration: 2.6,
      label: label('Tumble', '满地打滚'),
      enter(a) {
        a.express('dizzy')
        a.cues.rollUntil = a.time + 1.8
      },
      tick(a, t, dt) {
        a.rootX.target = t < 1.8 ? Math.sin(t * 3.6) * 0.8 : 0
        if (every(t, dt, 0.45) && t < 1.8) {
          a.spinBy(Math.cos(t * 3.6) > 0 ? 0.5 : -0.5)
          a.hop(0.4)
        }
        if (at(t, dt, 1.8)) {
          a.cues.result = 3
          a.cues.showUntil = a.time + 0.8
        }
      }
    },
    count: {
      kind: 'once',
      duration: 3,
      label: label('Count to six', '数到六'),
      enter(a) {
        a.express('focused')
      },
      tick(a, t, dt) {
        for (let n = 1; n <= 6; n++) {
          if (at(t, dt, 0.15 + (n - 1) * 0.4)) {
            a.cues.result = n
            a.cues.showUntil = a.time + (n === 6 ? 0.8 : 0.4)
            a.squish(n === 6 ? -4 : 1.5)
            if (n === 6) {
              a.hop(0.6)
              a.express('happy')
            }
          }
        }
      }
    }
  },
  signature: ['roll', 'lucky', 'snake', 'tumble', 'count'],
  fidgets: ['roll', 'tumble', 'look-around', 'wiggle']
}
