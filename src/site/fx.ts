import type { Actor } from '../engine/actor'
import { TAU, clamp, type Vec } from '../engine/math'
import { align, type Shape } from '../engine/shapes'
import { smoothPath } from '../engine/render'
import type { CharacterDef } from '../engine/types'
import { Stage, type Placement } from './stage'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Where one character stands on screen: its tile, its body, its tone. Viewport coordinates. */
export interface Slot {
  box: Box
  place: Placement
  tone: string
}

const INK = '#171614'
const mix = (a: number, b: number, k: number) => a + (b - a) * k
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3
export const easeInOut = (t: number) => {
  const k = clamp(t)
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
}

const dotPatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>()
function dots(g: CanvasRenderingContext2D): CanvasPattern | null {
  if (!dotPatterns.has(g)) {
    const c = document.createElement('canvas')
    c.width = c.height = 18
    const cg = c.getContext('2d')!
    cg.fillStyle = 'rgba(23,22,20,0.08)'
    cg.beginPath()
    cg.arc(9, 9, 1.1, 0, TAU)
    cg.fill()
    dotPatterns.set(g, g.createPattern(c, 'repeat'))
  }
  return dotPatterns.get(g) ?? null
}

/** The shared tile look: a block of tone with a faint dot grid (cards, grid tiles and flights). */
export function paintTile(g: CanvasRenderingContext2D, b: Box, tone: string, opts: { r?: number; alpha?: number; edge?: number; shade?: number } = {}) {
  if (b.w < 1 || b.h < 1) return
  g.save()
  g.globalAlpha = opts.alpha ?? 1
  g.beginPath()
  g.roundRect(b.x, b.y, b.w, b.h, opts.r ?? 14)
  g.fillStyle = tone
  g.fill()
  const p = dots(g)
  if (p) {
    g.fillStyle = p
    g.fill()
  }
  if (opts.shade) {
    g.fillStyle = `rgba(23,22,20,${opts.shade})`
    g.fill()
  }
  if (opts.edge) {
    g.lineWidth = opts.edge
    g.strokeStyle = INK
    g.stroke()
  }
  g.restore()
}

const lerpBox = (a: Box, b: Box, k: number): Box => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), w: mix(a.w, b.w, k), h: mix(a.h, b.h, k) })

/**
 * Full-page canvases for flights and wipes, made once and reused: a fresh
 * retina-sized canvas costs a noticeable hitch right as a transition starts.
 */
const spare: HTMLCanvasElement[] = []

function overlay(): HTMLCanvasElement {
  const c = spare.pop() ?? Object.assign(document.createElement('canvas'), { className: 'flight' })
  c.setAttribute('aria-hidden', 'true')
  c.style.display = ''
  if (!c.isConnected) document.body.append(c)
  return c
}

function release(c: HTMLCanvasElement) {
  c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
  c.style.display = 'none'
  c.className = 'flight'
  spare.push(c)
}

/** Make the overlay canvas ahead of time, while nothing is moving. */
export function warmUp() {
  release(overlay())
}

/**
 * Fly characters from one set of slots to another over the whole page, on a
 * canvas laid above everything. `split: 'out'` makes the copies grow out of
 * the first one (one card becoming a grid), `'in'` shrinks them back into it.
 * The actors keep living while they fly; the caller pauses their own stage.
 */
export function fly(o: {
  actors: Actor[]
  from: () => Slot[]
  to: () => Slot[]
  duration?: number
  stagger?: number
  split?: 'out' | 'in'
  radius?: [number, number]
  onLand?(i: number): void
  done(): void
}): () => void {
  const canvas = overlay()
  const n = o.actors.length
  const dur = o.duration ?? 0.6
  const stagger = o.stagger ?? 0.02
  let t = 0
  let boxes: Box[] = []
  let tones: string[] = []
  const landed = new Set<number>()
  const progress = (i: number) => easeOut((t - (o.split === 'in' ? n - 1 - i : i) * stagger) / dur)
  const r0 = o.radius?.[0] ?? 14
  const r1 = o.radius?.[1] ?? 12
  const stage = new Stage(canvas, o.actors, {
    layout: () => {
      const A = o.from()
      const B = o.to()
      boxes = []
      tones = []
      return o.actors.map((_, i) => {
        const a = A[i] ?? A[0]
        const b = B[i] ?? B[0]
        const k = progress(i)
        boxes.push(lerpBox(a.box, b.box, k))
        tones.push(k < 0.5 ? a.tone : b.tone)
        let R = mix(a.place.R, b.place.R, k)
        if (i > 0 && o.split === 'out') R *= clamp(k * 1.6)
        if (i > 0 && o.split === 'in') R *= clamp((1 - k) * 1.6)
        return { cx: mix(a.place.cx, b.place.cx, k), cy: mix(a.place.cy, b.place.cy, k), R }
      })
    },
    interactive: false,
    paint(g) {
      // the first slot on top, so a split looks like copies sliding out from under it
      for (let i = boxes.length - 1; i >= 0; i--) paintTile(g, boxes[i], tones[i], { r: mix(r0, r1, progress(i)) })
    }
  })
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    o.done()
    stage.destroy()
    release(canvas)
  }
  stage.every((dt) => {
    t += dt
    stage.relayoutNow()
    for (let i = 0; i < n; i++) {
      if (!landed.has(i) && progress(i) >= 0.97) {
        landed.add(i)
        o.onLand?.(i)
      }
    }
    if (t >= dur + stagger * (n - 1) + 0.02) finish()
  })
  return finish
}

/**
 * A transition shaped like the character itself: its silhouette swells from
 * `origin` until it covers the page (an ink blot, a cloud), `cover` swaps the
 * content underneath, then it morphs into the next character's silhouette
 * and shrinks away.
 */
export function wipe(o: { from: CharacterDef; to: CharacterDef; origin: Vec; cover(): void; done?(): void }) {
  const canvas = overlay()
  canvas.classList.add('wipe')
  const g = canvas.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = window.innerWidth
  const H = window.innerHeight
  if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr)
  if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr)
  const a: Shape = o.from.rest()
  const b: Shape = align(o.to.rest(), a)
  const look = (d: CharacterDef) => ({ fill: d.palettes[0].body, line: d.outlineWidth ? (d.palettes[0].outline ?? INK) : null })
  const A = look(o.from)
  const B = look(o.to)
  // big enough that the smallest radius of the shape still clears every corner
  const reach = Math.hypot(Math.max(o.origin.x, W - o.origin.x), Math.max(o.origin.y, H - o.origin.y)) / 0.6
  const grow = 0.42
  const hold = 0.08
  const shrink = 0.46
  let start = 0
  let covered = false
  const frame = (now: number) => {
    if (!start) start = now
    const t = (now - start) / 1000
    let k: number
    let s: Shape
    let style: { fill: string; line: string | null }
    if (t < grow) {
      k = easeInOut(t / grow)
      s = a
      style = A
    } else if (t < grow + hold) {
      k = 1
      s = a
      style = A
      if (!covered) {
        covered = true
        o.cover()
      }
    } else {
      const u = clamp((t - grow - hold) / shrink)
      k = 1 - easeInOut(u)
      const m = easeInOut(clamp(u * 2.2))
      s = a.map((p, i) => ({ x: mix(p.x, b[i].x, m), y: mix(p.y, b[i].y, m) }))
      style = m < 0.5 ? A : B
    }
    const scale = Math.max(0.001, k * reach)
    const spin = (t - 0.4) * 0.6
    const pts = s.map((p) => {
      const x = p.x * Math.cos(spin) - p.y * Math.sin(spin)
      const y = p.x * Math.sin(spin) + p.y * Math.cos(spin)
      return { x: o.origin.x + x * scale, y: o.origin.y + y * scale }
    })
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const path = smoothPath(pts)
    g.fillStyle = style.fill
    g.fill(path)
    if (style.line) {
      g.lineWidth = Math.max(3, scale * 0.06)
      g.strokeStyle = style.line
      g.stroke(path)
    }
    if (t < grow + hold + shrink) requestAnimationFrame(frame)
    else {
      if (!covered) o.cover()
      release(canvas)
      o.done?.()
    }
  }
  requestAnimationFrame(frame)
}

/* ---------------------------------------------------------- hand-offs */

/** Set by the index when a card is opened; read once by the workbench. */
let outgoing: { id: string; slot: Slot; actor: Actor } | null = null
/** Set by the workbench when it closes; read once by the index. */
let returning: { id: string; slots: Slot[]; actors: Actor[] } | null = null

export function setOutgoing(v: typeof outgoing) {
  outgoing = v
}

export function takeOutgoing(id: string) {
  const v = outgoing && outgoing.id === id ? outgoing : null
  outgoing = null
  return v
}

export function setReturning(v: typeof returning) {
  returning = v
}

export function takeReturning() {
  const v = returning
  returning = null
  return v
}
