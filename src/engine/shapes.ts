import { TAU, type Vec } from './math'

/**
 * Every silhouette is the same number of outline points, in unit space
 * (rest radius about 1, centred on the origin, y down), starting at the top
 * and running clockwise on screen. So any shape morphs into any other point
 * for point, with no path-morphing library (the idea comes from bloub and from
 * Inky's original SwiftUI engine).
 */
export const POINTS = 96

export type Shape = Vec[]

/** Outline from a radius function of the screen angle, starting at the top. */
export function polar(radius: (angle: number) => number): Shape {
  return Array.from({ length: POINTS }, (_, i) => {
    const a = -Math.PI / 2 + (i / POINTS) * TAU
    const r = radius(a)
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  })
}

/**
 * Even arc-length resample of any closed outline to `POINTS`, starting at
 * the top-most point with clockwise winding, so morphs never twist.
 */
export function resample(input: Vec[]): Shape {
  if (input.length < 3) return circle()
  let top = 0
  for (let i = 1; i < input.length; i++) if (input[i].y < input[top].y) top = i
  const pts = [...input.slice(top), ...input.slice(0, top), input[top]]
  const lengths = [0]
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const total = Math.max(lengths[lengths.length - 1], 1e-6)
  const out: Shape = []
  let seg = 1
  for (let step = 0; step < POINTS; step++) {
    const d = (total * step) / POINTS
    while (seg < pts.length - 1 && lengths[seg] < d) seg++
    const span = Math.max(lengths[seg] - lengths[seg - 1], 1e-6)
    const t = (d - lengths[seg - 1]) / span
    const a = pts[seg - 1]
    const b = pts[seg]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  if (signedArea(out) < 0) return [out[0], ...out.slice(1).reverse()]
  return out
}

/**
 * Outline of a polygon with an outline point exactly on every corner, so
 * straight-edged bodies (paper, pixels) keep crisp corners. Points are shared
 * among the edges by length.
 */
export function polygon(vertices: Vec[]): Shape {
  const n = vertices.length
  const lengths = vertices.map((v, i) => Math.hypot(vertices[(i + 1) % n].x - v.x, vertices[(i + 1) % n].y - v.y))
  const total = lengths.reduce((s, l) => s + l, 0)
  const ideal = lengths.map((l) => (l / total) * POINTS)
  const counts = ideal.map((x) => Math.max(1, Math.round(x)))
  let diff = POINTS - counts.reduce((s, c) => s + c, 0)
  while (diff !== 0) {
    let pick = -1
    for (let i = 0; i < n; i++) {
      if (diff < 0 && counts[i] <= 1) continue
      const gap = diff > 0 ? ideal[i] - counts[i] : counts[i] - ideal[i]
      if (pick < 0 || gap > (diff > 0 ? ideal[pick] - counts[pick] : counts[pick] - ideal[pick])) pick = i
    }
    counts[pick] += Math.sign(diff)
    diff -= Math.sign(diff)
  }
  let out: Vec[] = []
  vertices.forEach((v, i) => {
    const w = vertices[(i + 1) % n]
    for (let k = 0; k < counts[i]; k++) out.push({ x: v.x + ((w.x - v.x) * k) / counts[i], y: v.y + ((w.y - v.y) * k) / counts[i] })
  })
  if (signedArea(out) < 0) out = [out[0], ...out.slice(1).reverse()]
  let top = 0
  for (let i = 1; i < out.length; i++) if (out[i].y < out[top].y - 1e-9) top = i
  return [...out.slice(top), ...out.slice(0, top)]
}

export function signedArea(pts: Vec[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

/** Cyclic shift of `target` that best pairs its points with `current`. */
export function align(target: Shape, current: Shape): Shape {
  const n = target.length
  let best = 0
  let bestCost = Infinity
  for (let shift = 0; shift < n; shift++) {
    let cost = 0
    for (let i = 0; i < n; i += 3) {
      const a = current[i]
      const b = target[(i + shift) % n]
      cost += (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    }
    if (cost < bestCost) {
      bestCost = cost
      best = shift
    }
  }
  if (best === 0) return target
  return Array.from({ length: n }, (_, i) => target[(i + best) % n])
}

export function transform(shape: Shape, sx = 1, sy = 1, dx = 0, dy = 0): Shape {
  return shape.map((p) => ({ x: p.x * sx + dx, y: p.y * sy + dy }))
}

/** Scale so the farthest point sits at `max`. */
export function normalize(shape: Shape, max = 1): Shape {
  let peak = 0
  for (const p of shape) peak = Math.max(peak, Math.hypot(p.x, p.y))
  const k = peak > 0 ? max / peak : 1
  return shape.map((p) => ({ x: p.x * k, y: p.y * k }))
}

/* ------------------------------------------------------------- primitives */

export const circle = (r = 1) => polar(() => r)

export const pebble = () =>
  polar((a) => 1 + 0.07 * Math.cos(2 * a + 0.5) + 0.03 * Math.cos(3 * a + 2.1))

export const squircle = (n = 4.2, size = 0.92) =>
  polar((a) => (Math.abs(Math.cos(a)) ** n + Math.abs(Math.sin(a)) ** n) ** (-1 / n) * size)

/** Pointed top, round bottom. `point` grows the tip. */
export const droplet = (point = 0.5) =>
  polar((a) => 0.92 + point * Math.max(0, -Math.sin(a)) ** 6).map((p) => ({ x: p.x * 0.95, y: p.y + 0.12 }))

/** Teardrop with a pointed top and a round bottom; `lean` bends the tip sideways. */
export function teardrop(width = 1, height = 1.25, lean = 0): Shape {
  const raw: Vec[] = []
  for (let i = 0; i < 240; i++) {
    const t = (i / 240) * TAU
    const y = -Math.cos(t)
    const x = Math.sin(t) * Math.sin(t / 2) ** 1.35
    const up = Math.max(0, -y)
    raw.push({ x: x * width + lean * up * up, y: y * height * 0.82 + 0.18 })
  }
  return resample(raw)
}

/** Flame: a teardrop whose tip leans a little. */
export const flame = (lean = 0.12) => teardrop(1.05, 1.28, lean)

/** Melted flat on the ground. */
export const puddle = (width = 1.55) => transform(circle(), width, 0.42, 0, 0.58)

export const egg = () => polar((a) => 1 - 0.12 * Math.sin(a)).map((p) => ({ x: p.x * 0.86, y: p.y * 1.05 }))

export const star = (points = 5, inner = 0.55) =>
  polar((a) => {
    const k = ((a + Math.PI / 2) / TAU) * points
    const frac = k - Math.floor(k)
    return inner + (1 - inner) * Math.abs(Math.cos(frac * Math.PI)) ** 3
  })

export function heart(): Shape {
  const raw: Vec[] = []
  for (let i = 0; i < 240; i++) {
    const t = (i / 240) * TAU
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    raw.push({ x: x / 16, y: -y / 15 + 0.1 })
  }
  return resample(raw)
}

export function moon(): Shape {
  const outer: Vec[] = []
  for (let i = 0; i < 48; i++) {
    const a = Math.PI * (0.38 + (i / 47) * 1.24)
    outer.push({ x: Math.cos(a) - 0.15, y: Math.sin(a) })
  }
  const inner: Vec[] = []
  for (let i = 1; i < 30; i++) {
    const a = Math.PI * (1.56 - (i / 30) * 1.12)
    inner.push({ x: 0.4 + Math.cos(a) * 0.95, y: Math.sin(a) * 0.95 })
  }
  return resample([...outer, ...inner])
}

/**
 * Radial profile of a union of discs: the farthest ray/circle hit. Exact as
 * long as the origin is inside the union. Gives clouds without path booleans.
 */
export function discs(list: Array<{ x: number; y: number; r: number }>): Shape {
  return polar((a) => {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let best = 0
    for (const c of list) {
      const b = dx * c.x + dy * c.y
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r)
      if (disc < 0) continue
      best = Math.max(best, b + Math.sqrt(disc))
    }
    return best
  })
}

/** Scalloped puff: `bumps` round lobes around a body, like Puff. */
export function scallop(bumps = 11, depth = 0.11, squash = 1): Shape {
  const ring: Array<{ x: number; y: number; r: number }> = [{ x: 0, y: 0, r: 0.8 }]
  for (let i = 0; i < bumps; i++) {
    const a = -Math.PI / 2 + (i / bumps) * TAU
    const r = 0.27 + depth
    ring.push({ x: Math.cos(a) * (1 - r), y: Math.sin(a) * (1 - r) * squash, r })
  }
  return normalize(discs(ring), 1.02)
}

/* -------------------------------------------------- shapes from glyphs */

/**
 * Silhouette of any text (a digit, an emoji, a "!") by tracing the rendered
 * glyph's outer contours. Several separate pieces are joined by zero-width
 * bridges so the result stays one morphable outline. Browser only.
 */
export function fromText(text: string, font = '900 120px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'): Shape {
  if (typeof document === 'undefined') return circle()
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) return circle()
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#000'
  g.fillText(text, size, size / 2 + 6)
  const data = g.getImageData(0, 0, size * 2, size).data
  const w = size * 2
  const h = size
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 110
  const contours = traceOuterContours(solid, w, h)
  if (!contours.length) return circle()
  contours.sort((a, b) => a[0].x - b[0].x)
  let joined = contours[0]
  for (const next of contours.slice(1)) {
    let best = { a: 0, b: 0, d: Infinity }
    for (let i = 0; i < joined.length; i += 2) {
      for (let j = 0; j < next.length; j += 2) {
        const d = Math.hypot(joined[i].x - next[j].x, joined[i].y - next[j].y)
        if (d < best.d) best = { a: i, b: j, d }
      }
    }
    const rotated = [...next.slice(best.b), ...next.slice(0, best.b), next[best.b]]
    joined = [...joined.slice(0, best.a + 1), ...rotated, ...joined.slice(best.a)]
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of joined) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const scale = (2 / Math.max(maxX - minX, maxY - minY)) * 0.95
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const pts = joined.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }))
  return resample(smoothClosed(pts, 2))
}

function smoothClosed(pts: Vec[], passes: number): Vec[] {
  let cur = pts
  for (let k = 0; k < passes; k++) {
    cur = cur.map((p, i) => {
      const a = cur[(i - 1 + cur.length) % cur.length]
      const b = cur[(i + 1) % cur.length]
      return { x: (a.x + p.x * 2 + b.x) / 4, y: (a.y + p.y * 2 + b.y) / 4 }
    })
  }
  return cur
}

/** Moore-neighbour tracing of the outer boundary of every blob larger than a few pixels. */
function traceOuterContours(solid: (x: number, y: number) => boolean, w: number, h: number): Vec[][] {
  const seen = new Uint8Array(w * h)
  const out: Vec[][] = []
  const dirs = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
  ]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) || seen[y * w + x]) continue
      // flood-fill the blob so its inner pixels never start a new trace
      const stack = [x, y]
      let count = 0
      while (stack.length) {
        const py = stack.pop()!
        const px = stack.pop()!
        if (px < 0 || py < 0 || px >= w || py >= h) continue
        const idx = py * w + px
        if (seen[idx] || !solid(px, py)) continue
        seen[idx] = 1
        count++
        stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1)
      }
      if (count < 30) continue
      // (x, y) is the top-left-most pixel of this blob: trace from it
      const contour: Vec[] = []
      let cx = x
      let cy = y
      let dir = 7
      const limit = w * h
      for (let guard = 0; guard < limit; guard++) {
        contour.push({ x: cx, y: cy })
        let found = false
        for (let k = 0; k < 8; k++) {
          const d = (dir + 6 + k) % 8
          const nx = cx + dirs[d][0]
          const ny = cy + dirs[d][1]
          if (solid(nx, ny)) {
            cx = nx
            cy = ny
            dir = d
            found = true
            break
          }
        }
        if (!found || (cx === x && cy === y && contour.length > 2)) break
      }
      if (contour.length > 8) out.push(contour)
    }
  }
  return out
}

/* ---------------------------------------------------------- face anchor */

export interface FaceAnchor {
  x: number
  y: number
  r: number
}

/**
 * Where the eyes go: the centre and radius of the largest circle that fits
 * inside the shape, nudged up and to the middle. Keeps a face readable on a
 * crescent, a star or the stroke of a digit.
 */
export function faceAnchor(shape: Shape): FaceAnchor {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of shape) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  let best = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, r: 0, score: -Infinity }
  const steps = 26
  for (let gx = 0; gx <= steps; gx++) {
    for (let gy = 0; gy <= steps; gy++) {
      const p = { x: minX + ((maxX - minX) * gx) / steps, y: minY + ((maxY - minY) * gy) / steps }
      if (!inside(shape, p)) continue
      const d = edgeDistance(shape, p)
      const score = d - Math.abs(p.x - (minX + maxX) / 2) * 0.08 - ((p.y - minY) / Math.max(maxY - minY, 0.01)) * 0.06
      if (score > best.score) best = { x: p.x, y: p.y, r: d, score }
    }
  }
  return { x: best.x, y: best.y, r: Math.max(best.r, 0.12) }
}

function inside(poly: Vec[], p: Vec): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

function edgeDistance(poly: Vec[], p: Vec): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / Math.max(ex * ex + ey * ey, 1e-9)))
    best = Math.min(best, Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t)))
  }
  return best
}
