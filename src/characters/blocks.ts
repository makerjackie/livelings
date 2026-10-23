import { at, every, sparkles, thoughtDots, variant, zzz } from '../engine/behaviors'
import { chime, clack, thud } from '../engine/sound'
import { TAU, mixHex, type Vec } from '../engine/math'
import { polygon } from '../engine/shapes'
import { drawText } from '../engine/text'
import type { Actor } from '../engine/actor'
import type { CharacterDef, Palette, RenderCtx } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

/** Block height, and each block's half-width and sideways offset, bottom to top. */
const H = 0.56
const BLOCKS = [
  { w: 0.92, x: 0 },
  { w: 0.82, x: 0.07 },
  { w: 0.74, x: -0.05 },
  { w: 0.66, x: 0.06 }
]
const LETTERS = ['A', 'B', 'C', 'D']
/** How far a block slides out when it is pulled, like in Jenga. */
const PULL = 0.42

/** A stack of `n` blocks, with block `pulled` slid out to the right. */
function stack(n: number, pulled = -1): Vec[] {
  const rect = (i: number) => {
    const b = BLOCKS[i]
    const dx = i === pulled ? PULL : 0
    return { l: b.x - b.w + dx, r: b.x + b.w + dx, top: 0.98 - (i + 1) * H, bot: 0.98 - i * H }
  }
  const rs = Array.from({ length: n }, (_, i) => rect(i))
  const pts: Vec[] = [{ x: rs[0].l, y: rs[0].bot }, { x: rs[0].r, y: rs[0].bot }]
  rs.forEach((r, i) => {
    pts.push({ x: r.r, y: r.bot }, { x: r.r, y: r.top })
    if (i + 1 < rs.length) pts.push({ x: rs[i + 1].r, y: r.top })
  })
  const top = rs[rs.length - 1]
  pts.push({ x: top.l, y: top.top })
  for (let i = rs.length - 1; i >= 0; i--) {
    pts.push({ x: rs[i].l, y: rs[i].top }, { x: rs[i].l, y: rs[i].bot })
    if (i > 0) pts.push({ x: rs[i - 1].l, y: rs[i].bot })
  }
  // drop repeated corners
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1e-6)
  return polygon(clean.slice(0, -1))
}

/** Knocked down: two blocks on the floor and one leaning on them. */
const pile = () =>
  polygon([
    { x: -1.35, y: 0.98 },
    { x: 1.35, y: 0.98 },
    { x: 1.35, y: 0.42 },
    { x: 0.42, y: 0.42 },
    { x: 0.52, y: -0.06 },
    { x: -0.1, y: -0.32 },
    { x: -0.4, y: 0.16 },
    { x: -0.3, y: 0.42 },
    { x: -1.35, y: 0.42 }
  ])

/** Lying down in a row, for sleeping. */
const row = () => polygon([{ x: -1.4, y: 0.98 }, { x: 1.4, y: 0.98 }, { x: 1.4, y: 0.42 }, { x: -1.4, y: 0.42 }])

const colorsOf = (p: Palette, shift = 0) => {
  const list = [p.body, p.accent, p.core ?? p.body, p.cheek ?? p.accent]
  return list.map((_, i) => list[(i + shift) % list.length])
}

/** How the blocks are arranged, read from the shape it is turning into. */
function layout(a: Actor): { n: number; pulled: number; flat: boolean } {
  const key = a.shapeKey
  const gap = key.match(/^gap(\d)_(\d)$/)
  if (gap) return { n: Number(gap[1]), pulled: Number(gap[2]), flat: false }
  const st = key.match(/^stack(\d)$/)
  if (st) return { n: Number(st[1]), pulled: -1, flat: false }
  if (key === 'tall') return { n: 4, pulled: -1, flat: false }
  if (key === 'pile' || key === 'row' || key === 'wide') return { n: 3, pulled: -1, flat: true }
  return { n: 3, pulled: -1, flat: false }
}

/** Paint each block its own colour and letter; flat layouts get upright stripes instead. */
function paintBlocks(r: RenderCtx) {
  const { g, R, palette: pal, actor: a } = r
  const { n, pulled, flat } = layout(a)
  const colors = colorsOf(pal, a.cues.shift ?? 0)
  const quad = (x0: number, y0: number, x1: number, y1: number, fill: string) => {
    const c = [r.toPx(x0, y0), r.toPx(x1, y0), r.toPx(x1, y1), r.toPx(x0, y1)]
    g.fillStyle = fill
    g.beginPath()
    c.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
    g.closePath()
    g.fill()
  }
  const ink = pal.outline ?? '#2b2118'
  g.strokeStyle = ink
  g.lineWidth = R * 0.05
  if (flat) {
    for (let i = 0; i < 3; i++) quad(-1.5 + i * 1.0, -0.6, -0.5 + i * 1.0, 1.1, colors[i])
    for (const x of [-0.5, 0.5]) {
      const p = r.toPx(x, 0.4)
      const q = r.toPx(x, 1)
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.lineTo(q.x, q.y)
      g.stroke()
    }
    return
  }
  for (let i = 0; i < n; i++) {
    quad(-1.6, 0.98 - (i + 1) * H, 1.6, 0.98 - i * H, colors[i])
    if (i > 0) {
      const p = r.toPx(-1.6, 0.98 - i * H)
      const q = r.toPx(1.6, 0.98 - i * H)
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.lineTo(q.x, q.y)
      g.stroke()
    }
  }
  // a letter on every block but the one wearing the face
  const faceBlock = Math.floor((0.98 - a.faceY.value) / H)
  for (let i = 0; i < n; i++) {
    if (i === faceBlock) continue
    const dx = i === pulled ? PULL : 0
    const c = r.toPx(BLOCKS[i].x + dx + 0.42, 0.98 - (i + 0.5) * H)
    drawText(g, LETTERS[i], c.x, c.y, { font: `900 ${Math.round(R * 0.36)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`, color: mixHex(colors[i], '#ffffff', 0.75), align: 'center', baseline: 'middle' })
  }
}

/** A little flag on top of a finished tower. */
function flag(r: RenderCtx) {
  const a = r.actor
  if (a.time > (a.cues.flagUntil ?? -1)) return
  const { g, R, outline } = r
  let top = outline[0]
  for (const p of outline) if (p.y < top.y) top = p
  g.save()
  g.strokeStyle = r.palette.outline ?? '#2b2118'
  g.lineWidth = R * 0.05
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(top.x, top.y)
  g.lineTo(top.x, top.y - R * 0.6)
  g.stroke()
  g.fillStyle = '#ff6b6b'
  g.beginPath()
  const wave = Math.sin(r.time * 8) * R * 0.03
  g.moveTo(top.x, top.y - R * 0.6)
  g.lineTo(top.x + R * 0.38, top.y - R * 0.5 + wave)
  g.lineTo(top.x, top.y - R * 0.38)
  g.closePath()
  g.fill()
  g.stroke()
  g.restore()
}

function setStack(a: Actor, n: number, opts: { squish?: number } = {}) {
  a.morph(`stack${n}`, { squash: opts.squish ?? 2, blink: false })
}

function crumble(a: Actor) {
  const c = a.bodyCenter()
  const colors = colorsOf(a.palette, a.cues.shift ?? 0)
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1
    a.emit({ kind: 'square', x: c.x + side * a.rand() * 0.6, y: c.y - 0.4 - a.rand() * 0.6, vx: side * (1 + a.rand() * 2), vy: -2 - a.rand() * 2, ay: 10, life: 0.9, size: 0.16, color: colors[i % 4], rot: a.rand() * TAU, vrot: (a.rand() - 0.5) * 10, lands: true })
  }
}

function pull(a: Actor) {
  const n = layout(a).n
  const k = Math.floor(a.rand() * (n - 1))
  a.morph(`gap${n}_${k}`, { squash: 0, blink: false })
  a.flash('worried', 1.1)
  a.cues.pushAt = a.time + 1
}

export const blocks: CharacterDef = {
  id: 'blocks',
  // wooden blocks knocking together, and the clatter when they fall
  sounds: {
    hello: (s) => {
      clack(s, 820, 0, 0.14)
      clack(s, 980, 0.1, 0.14)
    },
    tap: (s) => {
      s.noise({ dur: 0.22, gain: 0.06, type: 'bandpass', f: 1800, q: 2 })
      clack(s, 900, 0.22, 0.2)
    },
    jenga: (s) => {
      s.noise({ dur: 0.3, gain: 0.07, type: 'bandpass', f: 1800, q: 2 })
      clack(s, 900, 0.3, 0.2)
    },
    stack: (s) => {
      clack(s, 760, 0.5, 0.18)
      clack(s, 900, 1.0, 0.18)
    },
    topple: (s) => {
      ;[0.4, 0.52, 0.62, 0.76, 0.9].forEach((at, i) => clack(s, 1050 - i * 110, at, 0.18 - i * 0.02))
      thud(s, 0.95, 0.2, 110)
    },
    shuffle: (s) => {
      for (let i = 0; i < 4; i++) clack(s, 800 + (i % 2) * 220, i * 0.3, 0.1)
    },
    done: (s) => {
      clack(s, 900, 0, 0.16)
      chime(s, [79, 84, 88], 0.07, 0.09, 0.45)
    },
    error: (s) => {
      ;[1.9, 2.0, 2.12].forEach((at, i) => clack(s, 900 - i * 120, at, 0.16))
      thud(s, 2.2, 0.18, 110)
    }
  },
  name: label('Stacky', '垒垒'),
  material: label('Toy blocks', '积木'),
  tagline: label('Builds itself up, block by block.', '一块一块，把自己垒起来。'),
  bio: label(
    'Stacky is a tower of alphabet blocks with a face on the top one. Progress is literal: it stacks itself taller while you work. Tap it and it plays Jenga with itself, sliding a block out and wobbling before pushing it back; when something fails, the whole tower comes down and it builds itself up again.',
    '垒垒是一摞字母积木，脸长在最上面那块。进度在它身上是看得见的：你忙一点，它就往上垒高一点。点它一下，它会自己玩叠叠乐，抽出一块晃悠半天再推回去；事情搞砸了，整座塔哗啦倒下，然后它再一块块垒回来。'
  ),
  traits: { en: ['Grows with progress', 'Plays Jenga', 'Builds itself back up'], zh: ['进度就是高度', '自己玩叠叠乐', '倒了能重来'] },
  physics: physics({ morphStiffness: 200, morphDamping: 20, softStiffness: 480, softDamping: 26, softSmoothing: 50, squashiness: 0.35, hopPower: 3.2, gravity: 14, stretch: 0.4, breath: 0.008 }),
  eyes: { w: 0.16, h: 0.24, corner: 1, spacing: 0.58, lift: 0.02, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.055,
  straight: true,
  thicken: false,
  splash: false,
  rest: () => stack(3),
  shapes: {
    stack2: () => stack(2),
    stack3: () => stack(3),
    stack4: () => stack(4),
    ...Object.fromEntries([2, 3, 4].flatMap((n) => Array.from({ length: n - 1 }, (_, k) => [`gap${n}_${k}`, () => stack(n, k)]))),
    pile,
    row,
    wide: row,
    tall: () => stack(4)
  },
  palettes: [
    { id: 'toy', body: '#ff6b6b', accent: '#4dabf7', core: '#ffd43b', cheek: '#51cf66', eye: '#2b2118', outline: '#2b2118', mark: '#2b2118' },
    { id: 'pastel', body: '#ffc9c9', accent: '#a5d8ff', core: '#fff3bf', cheek: '#b2f2bb', eye: '#2b2118', outline: '#2b2118', mark: '#2b2118' },
    { id: 'wood', body: '#d9a066', accent: '#b07d4f', core: '#ecc796', cheek: '#c58f5c', eye: '#2b1a0e', outline: '#2b1a0e', mark: '#2b1a0e' },
    { id: 'mono', body: '#495057', accent: '#adb5bd', core: '#e9ecef', cheek: '#868e96', eye: '#101113', outline: '#101113', mark: '#495057' }
  ],
  accessories: pickAccessories('cap', 'crown', 'sprout'),
  paintBody: paintBlocks,
  paintFace: flag,
  update(a) {
    if (a.cues.pushAt && a.time > a.cues.pushAt) {
      a.cues.pushAt = 0
      const { n, flat } = layout(a)
      setStack(a, flat ? 3 : n, { squish: 1.5 })
      a.flash('happy', 0.6)
    }
    if (layout(a).pulled >= 0) a.lean.target = Math.sin(a.time * 9) * 0.05
  },
  react: {
    tap(a, n) {
      if (n >= 3) {
        a.morph('pile', { squash: 0 })
        crumble(a)
        a.flash('dizzy', 1.2)
        a.cues.pushAt = a.time + 1.3
        return true
      }
      pull(a)
      return true
    }
  },
  actions: {
    thinking: variant('thinking', {
      tick(a, t) {
        a.lean.target = Math.sin(t * 1.6) * 0.06
      },
      front: thoughtDots
    }),
    working: variant('working', {
      // stacks itself up and down, like a progress bar that breathes
      enter(a) {
        a.express('focused')
        setStack(a, 2)
      },
      tick(a, t, dt) {
        if (every(t, dt, 1.1, 1.1)) {
          const seq = [2, 3, 4, 3]
          const n = seq[Math.floor(t / 1.1) % seq.length]
          setStack(a, n)
          if (n > 2) a.squish(4)
        }
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('proud')
        setStack(a, 4)
        a.cues.flagUntil = a.time + 2
        a.hop(0.6)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.45)) sparkles(a, 8, '#ffd43b')
        if (at(t, dt, 1.8)) setStack(a, 3)
      },
      front: undefined
    }),
    error: variant('error', {
      duration: 2.6,
      enter(a) {
        a.express('dizzy')
        a.morph('pile', { squash: 0 })
        crumble(a)
        a.shake(0.05, 24, 2)
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.5)) setStack(a, 2)
        if (at(t, dt, 1.9)) {
          setStack(a, 3)
          a.express('worried')
        }
      }
    }),
    sleep: variant('sleep', {
      enter(a) {
        a.express('closed')
        a.morph('row')
      },
      front: zzz
    }),
    stack: {
      kind: 'once',
      duration: 3,
      label: label('Stack up', '往上垒'),
      enter(a) {
        a.express('focused')
        setStack(a, 2)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.5)) setStack(a, 3)
        if (at(t, dt, 1.0)) {
          setStack(a, 4)
          a.cues.flagUntil = a.time + 1.4
          a.express('proud')
          sparkles(a, 5, '#ffd43b')
        }
        if (at(t, dt, 2.4)) setStack(a, 3)
      }
    },
    jenga: {
      kind: 'once',
      duration: 2.2,
      label: label('Jenga', '抽一块'),
      enter(a) {
        pull(a)
      }
    },
    topple: {
      kind: 'once',
      duration: 3,
      label: label('Topple', '塌了'),
      enter(a) {
        a.express('surprised')
        a.lean.target = 0.35
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) {
          a.lean.target = 0
          a.morph('pile', { squash: 0 })
          crumble(a)
          a.express('dizzy')
        }
        if (at(t, dt, 1.6)) setStack(a, 2)
        if (at(t, dt, 2.1)) {
          setStack(a, 3)
          a.express('happy')
        }
      }
    },
    shuffle: {
      kind: 'once',
      duration: 2,
      label: label('Shuffle colours', '换个颜色'),
      enter(a) {
        a.express('excited')
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.3) && t < 1.3) {
          a.cues.shift = ((a.cues.shift ?? 0) + 1) % 4
          a.squish(2)
        }
      }
    }
  },
  signature: ['stack', 'jenga', 'topple', 'shuffle'],
  fidgets: ['jenga', 'shuffle', 'look-around', 'bounce']
}
