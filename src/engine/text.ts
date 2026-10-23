/**
 * Text drawn on a canvas every frame is slow (fonts are shaped and laid out
 * each time, CJK especially), so each label is rendered once into a small
 * bitmap at the screen's pixel density and stamped from then on.
 */
interface Sprite {
  c: HTMLCanvasElement | OffscreenCanvas
  w: number
  ascent: number
  descent: number
  h: number
}

const cache = new Map<string, Sprite>()
let measurer: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

function make(w: number, h: number) {
  return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
}

function sprite(text: string, font: string, color: string, density: number): Sprite {
  const key = `${density}|${font}|${color}|${text}`
  let s = cache.get(key)
  if (s) return s
  measurer ??= make(4, 4).getContext('2d') as CanvasRenderingContext2D
  measurer.font = font
  const m = measurer.measureText(text)
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent
  const pad = 2
  const w = Math.ceil(m.width) + pad * 2
  const h = Math.ceil(ascent + descent) + pad * 2
  const c = make(Math.max(1, Math.ceil(w * density)), Math.max(1, Math.ceil(h * density)))
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.scale(density, density)
  g.font = font
  g.fillStyle = color
  g.textBaseline = 'alphabetic'
  g.fillText(text, pad, pad + ascent)
  s = { c, w, ascent: ascent + pad, descent: descent + pad, h }
  if (cache.size > 600) cache.delete(cache.keys().next().value!)
  cache.set(key, s)
  return s
}

export function drawText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: { font: string; color: string; align?: 'left' | 'center' | 'right'; baseline?: 'alphabetic' | 'middle'; maxWidth?: number }
) {
  if (!text) return
  const t = g.getTransform()
  const density = Math.round(Math.hypot(t.a, t.b) * 2) / 2 || 1
  const s = sprite(text, o.font, o.color, density)
  const w = o.maxWidth !== undefined ? Math.min(s.w, o.maxWidth + 4) : s.w
  const left = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x - 2
  const top = o.baseline === 'middle' ? y - s.h / 2 : y - s.ascent
  g.drawImage(s.c, left, top, w, s.h)
}

const REF = 128

/** A single glyph (a heart, a "z", a "!") at any size, centred on x, y, stamped from one large bitmap. */
export function drawGlyph(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  if (!text || size < 0.5) return
  const s = sprite(text, `800 ${REF}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`, color, 1)
  const k = size / REF
  g.drawImage(s.c, x - (s.w * k) / 2, y - (s.h * k) / 2, s.w * k, s.h * k)
}
