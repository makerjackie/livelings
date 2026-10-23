import type { Actor } from './actor'
import { TAU, clamp, mixHex, parseHex, withAlpha, type Vec } from './math'
import { drawGlyph } from './text'
import type { Particle, RenderCtx } from './types'

export interface RenderOptions {
  /** rest body centre, CSS pixels */
  cx: number
  cy: number
  /** body radius, CSS pixels */
  R: number
  shadow?: boolean
}

interface SmoothOptions extends RenderOptions {
  /** pixel art draws its own eyes on the grid */
  eyes?: boolean
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
}

/** Closed polygon through the outline: crisp folds and corners. */
export function straightPath(pts: Vec[], path = new Path2D()): Path2D {
  if (pts.length < 3) return path
  path.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y)
  path.closePath()
  return path
}

/** Smooth closed curve through the outline (Catmull-Rom as cubic Béziers). */
export function smoothPath(pts: Vec[], path = new Path2D()): Path2D {
  const n = pts.length
  if (n < 3) return path
  path.moveTo(pts[0].x, pts[0].y)
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    path.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y)
  }
  path.closePath()
  return path
}

/**
 * Body transform shared by the outline, the face and accessories: squash and
 * scale about the ground point, spin about the centre, lean about the ground,
 * then hops and shakes.
 */
function bodyTransform(a: Actor) {
  const p = a.def.physics
  const breath = Math.sin(a.time * 2.2) * p.breath * (a.calm ? 0.5 : 1)
  const sx = (1 + a.squash.value + breath * 0.6) * a.scale.value
  const sy = (1 - a.squash.value - breath) * a.scale.value
  const anchorY = p.floaty ? 0 : 1
  const spin = a.spinAngle
  const lean = a.lean.value + a.sway + a.leanIn.value
  const cs = Math.cos(spin)
  const ss = Math.sin(spin)
  const cl = Math.cos(lean)
  const sl = Math.sin(lean)
  const c = a.bodyCenter()
  const apply = (x: number, y: number): Vec => {
    // squash + scale about the anchor
    let px = x * sx
    let py = (y - anchorY) * sy + anchorY
    // spin about the body centre
    const qx = px * cs - py * ss
    const qy = px * ss + py * cs
    px = qx
    py = qy
    // lean about the anchor
    const dy = py - anchorY
    const rx = px * cl - dy * sl
    const ry = px * sl + dy * cl + anchorY
    return { x: rx + c.x, y: ry + c.y }
  }
  return { apply, sx, sy, angle: spin + lean, center: apply(0, 0) }
}

export function renderActor(g: CanvasRenderingContext2D, a: Actor, o: RenderOptions) {
  if (a.def.pixel) renderPixel(g, a, o)
  else renderSmooth(g, a, o)
}

function renderSmooth(g: CanvasRenderingContext2D, a: Actor, o: SmoothOptions): { x: number; y: number; u: number } {
  const { cx, cy, R } = o
  const def = a.def
  const pal = a.palette
  const tf = bodyTransform(a)
  const toPx = (x: number, y: number): Vec => {
    const q = tf.apply(x, y)
    return { x: cx + q.x * R, y: cy + q.y * R }
  }

  // outline in body units, with dents, then any material deformation
  const local: Vec[] = a.base.map((b, i) => ({ x: b.x + a.off[i].x, y: b.y + a.off[i].y }))
  def.outlineMod?.(local, a.time, a)
  const outline = local.map((p) => toPx(p.x, p.y))
  const bodyPath = def.straight ? straightPath(outline) : smoothPath(outline)
  const bodyColor = a.tint.value > 0.005 ? mixHex(pal.body, a.tintColor, a.tint.value) : pal.body
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of outline) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  const eyeScale = Math.max(a.faceR.value + a.thicken.value, 0.55)
  const faceC = tf.apply(a.faceX.value, a.faceY.value)
  const u = R * eyeScale * Math.sqrt(Math.abs(tf.sx * tf.sy))
  const face = { x: cx + faceC.x * R, y: cy + faceC.y * R, u }

  const ctx: RenderCtx = {
    g,
    actor: a,
    R,
    cx,
    cy,
    bx: cx + tf.center.x * R,
    by: cy + tf.center.y * R,
    palette: { ...pal, body: bodyColor },
    outline,
    bodyPath,
    face,
    time: a.time,
    toPx,
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  for (const ov of a.overlays) ov.b.back?.(ctx, ov.t, clamp(ov.alpha.value))

  if (o.shadow !== false) {
    const lift = clamp(-a.height / 1.8)
    const w = R * (1.6 - lift * 0.7) * a.scale.value
    g.save()
    g.fillStyle = 'rgba(20,20,20,' + (0.09 * (1 - lift * 0.6)).toFixed(3) + ')'
    g.beginPath()
    g.ellipse(cx + a.rootX.value * R, cy + R * 1.04, w / 2, R * 0.07, 0, 0, TAU)
    g.fill()
    g.restore()
  }

  def.paintBack?.(ctx)
  drawParticles(g, a.particles, cx, cy, R, true)

  // eyes cut out of the body (Inky) are a clip: everything that makes up the
  // body is drawn through a mask with two eye-shaped holes in it
  const aspect = tf.sx / Math.max(tf.sy, 0.01)
  const holes = def.eyeMode === 'hole' && o.eyes !== false && !def.drawFace ? eyeHoles(a, face, tf.angle, aspect) : null
  const L = g
  const lctx = ctx
  // a see-through body (a ghost fading away); the eyes keep their own opacity
  const opacity = def.effects?.opacity ? clamp(a.fxValue('opacity')) : 1
  L.save()
  L.globalAlpha *= opacity
  if (holes) {
    const mask = new Path2D()
    mask.rect(minX - R * 4, minY - R * 4, maxX - minX + R * 8, maxY - minY + R * 8)
    mask.addPath(holes)
    L.save()
    L.clip(mask, 'evenodd')
  }

  const fur = a.fluff.value
  if (fur > 0.02) {
    L.fillStyle = withAlpha(bodyColor.startsWith('#') ? bodyColor : '#000000', 0.5)
    L.fill(furPath(outline, R, a, Math.min(fur, 1.6)))
  }
  L.fillStyle = bodyColor
  L.fill(bodyPath)
  if (fur > 0.02) {
    L.fillStyle = bodyColor
    L.fill(furPath(outline, R, a, Math.min(fur, 1.6) * 0.82))
  }
  if (a.thicken.value > 0.005 && def.thicken !== false) {
    L.strokeStyle = bodyColor
    L.lineWidth = a.thicken.value * 2 * R
    L.lineJoin = 'round'
    L.stroke(bodyPath)
  }

  L.save()
  L.clip(bodyPath)
  def.paintBody?.(lctx)
  if (def.sheen) drawSheen(L, outline, R, def.sheen)
  L.restore()

  if (def.outlineWidth) {
    L.strokeStyle = pal.outline ?? '#141414'
    L.lineWidth = def.outlineWidth * R
    L.lineJoin = 'round'
    L.stroke(bodyPath)
  }
  if (holes) L.restore()
  L.restore()

  L.save()
  if (def.effects?.eyesOpacity) L.globalAlpha *= clamp(a.fxValue('eyesOpacity'))
  if (o.eyes !== false && def.drawFace) def.drawFace(lctx)
  else if (o.eyes !== false && !holes) drawEyes(L, a, face, tf.angle, aspect, pal.eye, def.eyeShine ?? 0)
  L.restore()
  def.paintFace?.(lctx)

  if (a.accessory) {
    let top = outline[0]
    for (const p of outline) if (p.y < top.y) top = p
    a.accessory.draw(lctx, top, tf.angle)
  }

  if (def.splash !== false) drawSplash(g, a, cx, cy, R, bodyColor)
  drawParticles(g, a.particles, cx, cy, R, false)
  for (const ov of a.overlays) ov.b.front?.(ctx, ov.t, clamp(ov.alpha.value))
  return face
}

/* -------------------------------------------------------------- pixel art */

interface PixelFrame {
  frame: number
  key: string
  hi: HTMLCanvasElement | OffscreenCanvas
  lo: HTMLCanvasElement | OffscreenCanvas
}
const pixelFrames = new WeakMap<Actor, PixelFrame>()

/** Each art pixel is decided by a vote of SUB × SUB samples. */
const SUB = 4

/**
 * Pixel-art characters are drawn exactly like the others, at four samples per
 * art pixel; each art pixel then takes the colour most of its samples agree on
 * (snapped to a few flat colours) and is scaled up without smoothing. So edges
 * and eyes come out as clean blocks instead of blurry in-between colours. The
 * grid is fixed to the stage, so a moving body steps a whole pixel at a time,
 * and the art only updates `fps` times a second, like an old handheld.
 * Physics keep running at full rate underneath.
 */
function renderPixel(g: CanvasRenderingContext2D, a: Actor, o: RenderOptions) {
  const spec = a.def.pixel!
  const { cx, cy, R } = o
  const cell = (2 * R) / spec.cells
  const left = Math.ceil((3.2 * R) / cell)
  const up = Math.ceil((3.4 * R) / cell)
  const down = Math.ceil((1.4 * R) / cell)
  const cols = left * 2
  const rows = up + down
  const x0 = cx - left * cell
  const y0 = cy - up * cell
  const frame = Math.floor(a.time * spec.fps)
  const key = `${cols}x${rows}:${x0.toFixed(1)},${y0.toFixed(1)}:${cell.toFixed(3)}:${a.palette.id}`
  let pf = pixelFrames.get(a)
  if (!pf || pf.key !== key || pf.frame !== frame) {
    const same = pf && pf.lo.width === cols && pf.lo.height === rows
    const hi = same ? pf!.hi : makeCanvas(cols * SUB, rows * SUB)
    const lo = same ? pf!.lo : makeCanvas(cols, rows)
    const hg = hi.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    hg.setTransform(1, 0, 0, 1, 0, 0)
    hg.clearRect(0, 0, hi.width, hi.height)
    const k = SUB / cell
    hg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k)
    const face = renderSmooth(hg, a, { cx, cy, R, shadow: false, eyes: false })
    hg.setTransform(1, 0, 0, 1, 0, 0)
    const pal = a.palette
    const colors = [pal.body, pal.eye, pal.accent, pal.core, pal.mark, pal.cheek, ...(spec.colors ?? [])]
      .filter((c): c is string => !!c && c.startsWith('#'))
      .map(parseHex)
    const img = vote(hg.getImageData(0, 0, hi.width, hi.height).data, cols, rows, colors)
    pixelEyes(img, a, face, x0, y0, cell, parseHex(pal.eye))
    const glitch = a.fxValue('glitch')
    if (glitch > 0.05) tear(img, cols, rows, colors, glitch, frame)
    ;(lo.getContext('2d') as CanvasRenderingContext2D).putImageData(img, 0, 0)
    pf = { frame, key, hi, lo }
    pixelFrames.set(a, pf)
  }

  if (o.shadow !== false) {
    const lift = clamp(-a.height / 1.8)
    const w = Math.round((R * (1.5 - lift * 0.7) * a.scale.value) / cell) * cell
    const x = Math.round((cx + a.rootX.value * R - w / 2 - x0) / cell) * cell + x0
    g.fillStyle = 'rgba(20,20,20,' + (0.1 * (1 - lift * 0.6)).toFixed(3) + ')'
    g.fillRect(x + cell, cy + R * 0.96, w - 2 * cell, cell)
  }
  // a respawning sprite blinks, the way old games show it cannot be hurt
  if (a.fxValue('flicker') > 0.5 && frame % 2 === 0) return
  g.save()
  g.imageSmoothingEnabled = false
  g.drawImage(pf.lo, x0, y0, cols * cell, rows * cell)
  g.restore()
}

function vote(src: Uint8ClampedArray, cols: number, rows: number, colors: Array<[number, number, number]>): ImageData {
  const W = cols * SUB
  const out = new ImageData(cols, rows)
  const d = out.data
  const counts = new Int32Array(colors.length)
  const memo = new Map<number, number>()
  const nearest = (i: number) => {
    const key = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2]
    let best = memo.get(key)
    if (best !== undefined) return best
    let bestD = Infinity
    best = 0
    colors.forEach((c, k) => {
      const dr = src[i] - c[0]
      const dg = src[i + 1] - c[1]
      const db = src[i + 2] - c[2]
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
      if (dist < bestD) {
        bestD = dist
        best = k
      }
    })
    memo.set(key, best)
    return best
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      counts.fill(0)
      let clear = 0
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const i = ((y * SUB + sy) * W + x * SUB + sx) * 4
          if (src[i + 3] < 120) clear++
          else counts[nearest(i)]++
        }
      }
      // a pixel is filled once a good third of it is covered, so thin marks survive
      if (clear > SUB * SUB * 0.62) continue
      let pick = 0
      for (let k = 1; k < counts.length; k++) if (counts[k] > counts[pick]) pick = k
      const o = (y * cols + x) * 4
      d[o] = colors[pick][0]
      d[o + 1] = colors[pick][1]
      d[o + 2] = colors[pick][2]
      d[o + 3] = 255
    }
  }
  return out
}

/**
 * Eyes drawn straight onto the grid in whole pixels, so both always match:
 * blocks when open, one row when closed, little arches when happy, a corner
 * knocked off for angry or sad. Only drawn over the body.
 */
function pixelEyes(img: ImageData, a: Actor, face: { x: number; y: number; u: number }, x0: number, y0: number, cell: number, color: [number, number, number]) {
  const { width: cols, height: rows, data: d } = img
  const e = a.eyes
  const u = face.u
  const look = a.look
  const lid = clamp(Math.max(e.topLid, a.lid * 0.92))
  const put = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    const i = (y * cols + x) * 4
    if (d[i + 3] !== 255) return
    d[i] = color[0]
    d[i + 1] = color[1]
    d[i + 2] = color[2]
  }
  for (const side of [-1, 1]) {
    const grow = side > 0 ? 1 + e.asym : 1
    const wc = Math.max(1, Math.round((e.w * u * grow) / cell))
    const hc = Math.max(1, Math.round((e.h * u * grow) / cell))
    const ex = face.x + look.x * u + (side * e.spacing * u) / 2
    const ey = face.y + (-e.lift + look.y) * u
    const xs = Math.round((ex - x0) / cell - wc / 2)
    const ys = Math.round((ey - y0) / cell - hc / 2)
    if (e.bottomLid > 0.3 && lid < 0.6) {
      const top = ys + Math.floor(hc * 0.35)
      for (let x = xs; x < xs + wc; x++) put(x, top)
      put(xs - 1, top + 1)
      put(xs + wc, top + 1)
      continue
    }
    const shown = Math.max(1, Math.round(hc * (1 - lid)))
    const first = ys + hc - shown
    for (let y = first; y < ys + hc; y++) {
      for (let x = xs; x < xs + wc; x++) {
        const inner = side < 0 ? x === xs + wc - 1 : x === xs
        const outer = side < 0 ? x === xs : x === xs + wc - 1
        if (y === first && shown > 1 && wc > 1 && ((e.slant > 0.3 && inner) || (e.slant < -0.3 && outer))) continue
        put(x, y)
      }
    }
  }
}

/** Glitch: tear a few rows sideways and swap a band to the accent colour. */
function tear(img: ImageData, cols: number, rows: number, colors: Array<[number, number, number]>, glitch: number, frame: number) {
  const d = img.data
  const rnd = (k: number) => {
    const x = Math.sin(frame * 91.7 + k * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  const row = new Uint8ClampedArray(cols * 4)
  for (let y = 0; y < rows; y++) {
    if (rnd(y) > glitch * 0.45) continue
    const shift = Math.round((rnd(y + 500) - 0.5) * 8 * glitch)
    if (!shift) continue
    row.set(d.subarray(y * cols * 4, (y + 1) * cols * 4))
    for (let x = 0; x < cols; x++) {
      const from = (((x - shift) % cols) + cols) % cols
      for (let k = 0; k < 4; k++) d[(y * cols + x) * 4 + k] = row[from * 4 + k]
    }
  }
  const band = Math.floor(rnd(999) * rows)
  const tint = colors[2] ?? colors[0]
  for (let y = band; y < Math.min(rows, band + 2); y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4
      if (d[i + 3] && d[i] === colors[0][0] && d[i + 1] === colors[0][1] && d[i + 2] === colors[0][2]) {
        d[i] = tint[0]
        d[i + 1] = tint[1]
        d[i + 2] = tint[2]
      }
    }
  }
}

/** Keep the part of a convex polygon where `side(p) >= 0` (Sutherland–Hodgman, one edge). */
function clipHalf(poly: Vec[], side: (p: Vec) => number): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if (sa >= 0 !== sb >= 0) {
      const k = sa / (sa - sb)
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
    }
  }
  return out
}

/** A rounded rectangle centred on the origin, as a polygon. */
function roundRectPoly(w: number, h: number, r: number): Vec[] {
  const pts: Vec[] = []
  const rr = Math.min(r, w / 2, h / 2)
  const corners = [
    { x: w / 2 - rr, y: -h / 2 + rr, a: -Math.PI / 2 },
    { x: w / 2 - rr, y: h / 2 - rr, a: 0 },
    { x: -w / 2 + rr, y: h / 2 - rr, a: Math.PI / 2 },
    { x: -w / 2 + rr, y: -h / 2 + rr, a: Math.PI }
  ]
  for (const c of corners) {
    for (let k = 0; k <= 6; k++) {
      const t = c.a + (k / 6) * (Math.PI / 2)
      pts.push({ x: c.x + Math.cos(t) * rr, y: c.y + Math.sin(t) * rr })
    }
  }
  return pts
}

/**
 * The two eye holes as a path, the same shapes `drawEyes` paints: rounded
 * rectangles cut by the lids, then placed, tilted and squashed with the face.
 */
function eyeHoles(a: Actor, face: { x: number; y: number; u: number }, angle: number, aspect: number): Path2D {
  const e = a.eyes
  const u = face.u
  const look = a.look
  const lid = clamp(Math.max(e.topLid, a.lid * 0.92))
  const sx = Math.sqrt(aspect)
  const sy = 1 / Math.sqrt(aspect)
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const path = new Path2D()
  for (const side of [-1, 1]) {
    const grow = side > 0 ? 1 + e.asym : 1
    const w = Math.max(0.01, e.w * u * grow)
    const h = Math.max(0.01, e.h * u * grow)
    const corner = (Math.min(w, h) / 2) * clamp(e.corner)
    const slope = -side * e.slant * 0.6
    const yBot = h / 2 - h * clamp(e.bottomLid)
    const yTop = Math.min(-h / 2 + h * lid, yBot - Math.max(u * 0.045, 1.2))
    let poly = roundRectPoly(w, h, corner)
    poly = clipHalf(poly, (p) => p.y - (yTop + slope * p.x))
    poly = clipHalf(poly, (p) => yBot - p.y)
    if (poly.length < 3) continue
    const tx = look.x * u + (side * e.spacing * u) / 2
    const ty = (-e.lift + look.y) * u
    const ct = Math.cos(e.tilt * side)
    const st = Math.sin(e.tilt * side)
    poly.forEach((p, i) => {
      const x1 = (p.x * ct - p.y * st + tx) * sx
      const y1 = (p.x * st + p.y * ct + ty) * sy
      const x = face.x + x1 * ca - y1 * sa
      const y = face.y + x1 * sa + y1 * ca
      if (i === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    })
    path.closePath()
  }
  return path
}

function drawEyes(
  g: CanvasRenderingContext2D,
  a: Actor,
  face: { x: number; y: number; u: number },
  angle: number,
  aspect: number,
  ink: string | null,
  shine = 0
) {
  const e = a.eyes
  const u = face.u
  const look = a.look
  const blink = a.lid
  g.save()
  g.translate(face.x, face.y)
  g.rotate(angle)
  g.scale(Math.sqrt(aspect), 1 / Math.sqrt(aspect))
  const ex = look.x * u
  const ey = (-e.lift + look.y) * u
  if (ink) g.fillStyle = ink
  else {
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = '#000'
  }
  for (const side of [-1, 1]) {
    const grow = side > 0 ? 1 + e.asym : 1
    const w = Math.max(0.01, e.w * u * grow)
    const h = Math.max(0.01, e.h * u * grow)
    const lid = clamp(Math.max(e.topLid, blink * 0.92))
    g.save()
    g.translate(ex + (side * e.spacing * u) / 2, ey)
    g.rotate(e.tilt * side)
    const corner = (Math.min(w, h) / 2) * clamp(e.corner)
    // visible band: below the (possibly slanted) top lid, above the bottom lid
    const slope = -side * e.slant * 0.6
    const yBot = h / 2 - h * clamp(e.bottomLid)
    // closed eyes keep a visible slit, so a sleeping face still reads as a face
    const yTop = Math.min(-h / 2 + h * lid, yBot - Math.max(u * 0.045, 1.2))
    {
      g.beginPath()
      g.moveTo(-w, yTop - slope * w)
      g.lineTo(w, yTop + slope * w)
      g.lineTo(w, yBot)
      g.lineTo(-w, yBot)
      g.closePath()
      g.clip()
      g.beginPath()
      g.roundRect(-w / 2, -h / 2, w, h, corner)
      g.fill()
      if (ink && shine > 0) {
        g.fillStyle = `rgba(255,255,255,${shine})`
        g.beginPath()
        g.ellipse(w * 0.16, -h * 0.2, Math.min(w, h) * 0.2, Math.min(w, h) * 0.24, 0, 0, TAU)
        g.fill()
        g.fillStyle = ink
      }
    }
    g.restore()
  }
  g.restore()
}

function drawSheen(g: CanvasRenderingContext2D, outline: Vec[], R: number, amount: number) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of outline) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const w = maxX - minX
  const h = maxY - minY
  const flat = clamp(1 - (h / Math.max(w, 1)) * 1.6 + 0.6)
  const width = w * (0.32 + 0.25 * flat)
  const height = h * (0.12 + 0.05 * flat)
  const x = minX + w * (0.3 + 0.1 * flat)
  const y = minY + h * (0.2 + 0.08 * flat)
  g.save()
  g.strokeStyle = `rgba(255,255,255,${(amount * (0.22 + 0.12 * flat)).toFixed(3)})`
  g.lineWidth = Math.max(1.2, R * 0.07)
  g.lineCap = 'round'
  g.beginPath()
  const rr = Math.hypot(width * 0.5, height * 2.2)
  g.arc(x + width * 0.5, y + height * 2.2, rr, (-150 * Math.PI) / 180, (-112 * Math.PI) / 180)
  g.stroke()
  g.restore()
}

/** Ink droplets thrown sideways when a heavy body lands hard. */
function drawSplash(g: CanvasRenderingContext2D, a: Actor, cx: number, cy: number, R: number, color: string) {
  const land = a.landing
  if (!land || a.def.physics.floaty) return
  const age = a.time - land.time
  if (age < 0 || age > 0.55) return
  const fade = age < 0.35 ? 1 : 1 - (age - 0.35) / 0.2
  g.save()
  g.globalAlpha = fade
  g.fillStyle = color
  const base = cx + a.rootX.value * R
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const spread = Math.floor(i / 2) * 0.35 + 0.4
    const f = Math.min(age, 0.3)
    const x = base + side * R * (0.7 + spread * f * 6 * land.strength)
    const y = cy + R * 0.95 - f * R * (2.2 - Math.floor(i / 2) * 0.5) + f * f * R * 14
    const r = R * 0.06 * (1 - f * 1.5) + 0.6
    g.beginPath()
    g.arc(x, y, Math.max(0.5, r), 0, TAU)
    g.fill()
  }
  g.restore()
}

/** Soft fur: short tapered tufts along the outline normals (from Inky's fluffy skin). */
function furPath(outline: Vec[], R: number, a: Actor, amount: number): Path2D {
  const path = new Path2D()
  const n = outline.length
  const fling = clamp(a.vy / 4, -1, 1)
  const flat = clamp(a.squash.value * 3)
  const t = a.time
  for (let layer = 0; layer < 3; layer++) {
    const per = layer === 0 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const prev = outline[(i - 1 + n) % n]
      const next = outline[(i + 1) % n]
      const here = outline[i]
      for (let k = 0; k < per; k++) {
        const uu = (k + layer * 0.33) / per
        const bx = here.x + (next.x - here.x) * uu
        const by = here.y + (next.y - here.y) * uu
        let tx = next.x - prev.x
        let ty = next.y - prev.y
        const tl = Math.max(Math.hypot(tx, ty), 0.0001)
        tx /= tl
        ty /= tl
        let nx = ty
        let ny = -tx
        const seed = (i * per + k) * 2 + layer
        const hash = Math.sin(seed * 12.9898) * 43758.5453
        const pat = hash - Math.floor(hash)
        const scale = [1, 0.72, 0.5][layer]
        const len = R * (0.08 + 0.08 * pat) * scale * (1 - flat * 0.6) * amount
        const sway = 0.2 * Math.sin(t * 1.9 + seed * 0.37) + fling * 0.45 * nx + (pat - 0.5) * 0.7
        const c = Math.cos(sway)
        const s = Math.sin(sway)
        ;[nx, ny] = [nx * c - ny * s, nx * s + ny * c]
        const width = R * (0.04 + 0.025 * pat) * (layer === 0 ? 1 : 1.3) * Math.min(1, 0.4 + amount * 0.6)
        const inset = R * 0.05
        const rx = bx - nx * inset
        const ry = by - ny * inset
        const tipX = bx + nx * len
        const tipY = by + ny * len
        const lx = rx - tx * width
        const ly = ry - ty * width
        const qx = rx + tx * width
        const qy = ry + ty * width
        path.moveTo(lx, ly)
        path.bezierCurveTo(lx + nx * len * 0.6, ly + ny * len * 0.6, tipX - tx * width * 0.25, tipY - ty * width * 0.25, tipX, tipY)
        path.bezierCurveTo(tipX + tx * width * 0.25, tipY + ty * width * 0.25, qx + nx * len * 0.6, qy + ny * len * 0.6, qx, qy)
        path.closePath()
      }
    }
  }
  return path
}

function drawParticles(g: CanvasRenderingContext2D, list: Particle[], cx: number, cy: number, R: number, back: boolean) {
  for (const q of list) {
    if (q.back !== back) continue
    const life = q.age / q.life
    const fade = life < 0.12 ? life / 0.12 : life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1
    const x = cx + q.x * R
    const y = cy + q.y * R
    const s = q.size * R
    if (s <= 0.1) continue
    g.save()
    g.globalAlpha = clamp(fade)
    g.fillStyle = q.color
    g.strokeStyle = q.color
    g.translate(x, y)
    g.rotate(q.rot)
    switch (q.kind) {
      case 'drop':
        if (q.landed) {
          g.beginPath()
          g.ellipse(0, 0, s * 1.6, s * 0.4, 0, 0, TAU)
          g.fill()
        } else {
          g.beginPath()
          g.moveTo(0, -s * 1.5)
          g.bezierCurveTo(s * 0.9, -s * 0.2, s, s, 0, s)
          g.bezierCurveTo(-s, s, -s * 0.9, -s * 0.2, 0, -s * 1.5)
          g.fill()
        }
        break
      case 'rain':
        if (q.landed) {
          g.globalAlpha = clamp(fade) * 0.6
          g.beginPath()
          g.ellipse(0, 0, s * 1.4, s * 0.3, 0, 0, TAU)
          g.fill()
          break
        }
        g.lineWidth = s * 0.5
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(0, -s * 1.4)
        g.lineTo(0, s * 0.4)
        g.stroke()
        break
      case 'spark':
      case 'star': {
        g.beginPath()
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? s : s * 0.32
          const ang = (i / 8) * TAU
          g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r)
        }
        g.closePath()
        g.fill()
        break
      }
      case 'smoke':
        g.globalAlpha = clamp(fade) * 0.45
        g.beginPath()
        g.arc(0, 0, s, 0, TAU)
        g.fill()
        break
      case 'puff':
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.arc(0, 0, s, 0, TAU)
        g.fill()
        g.lineWidth = Math.max(1, R * 0.05)
        g.strokeStyle = q.color
        g.stroke()
        break
      case 'bubble':
        g.lineWidth = Math.max(1, s * 0.18)
        g.beginPath()
        g.arc(0, 0, s, 0, TAU)
        g.stroke()
        break
      case 'flake':
        g.lineWidth = Math.max(1, s * 0.22)
        g.lineCap = 'round'
        for (let i = 0; i < 3; i++) {
          g.rotate(Math.PI / 3)
          g.beginPath()
          g.moveTo(-s, 0)
          g.lineTo(s, 0)
          g.stroke()
        }
        break
      case 'dust':
        g.globalAlpha = clamp(fade) * 0.7
        g.beginPath()
        g.arc(0, 0, s, 0, TAU)
        g.fill()
        break
      case 'square':
        g.rotate(-q.rot)
        g.fillRect(-s / 2, -s / 2, s, s)
        break
      case 'coin': {
        // a coin spinning on its vertical axis
        const wide = Math.abs(Math.cos(q.rot)) * s + s * 0.12
        g.rotate(-q.rot)
        g.fillStyle = '#ffd43b'
        g.beginPath()
        g.ellipse(0, 0, wide, s, 0, 0, TAU)
        g.fill()
        g.fillStyle = '#e8a10c'
        g.beginPath()
        g.ellipse(0, 0, wide * 0.55, s * 0.6, 0, 0, TAU)
        g.fill()
        break
      }
      case 'bead': {
        // a little sphere of liquid metal
        g.rotate(-q.rot)
        const grad = g.createLinearGradient(0, -s, 0, s)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.45, '#c5ccd6')
        grad.addColorStop(0.52, '#3b414b')
        grad.addColorStop(1, '#aab2bd')
        g.fillStyle = grad
        g.beginPath()
        g.ellipse(0, 0, s * 1.08, s * 0.92, 0, 0, TAU)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,0.9)'
        g.beginPath()
        g.ellipse(-s * 0.38, -s * 0.42, s * 0.24, s * 0.14, -0.5, 0, TAU)
        g.fill()
        break
      }
      case 'glyph':
        if (q.glyph === 'rect') {
          g.fillRect(-s / 2, -s / 4, s, s / 2)
          break
        }
      // falls through to text
      case 'heart':
      case 'note':
      case 'z':
        drawGlyph(g, q.glyph || (q.kind === 'heart' ? '♥' : q.kind === 'note' ? '♪' : 'z'), 0, 0, s * 2, q.color)
        break
    }
    g.restore()
  }
}
