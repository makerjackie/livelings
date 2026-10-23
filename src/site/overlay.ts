import { onFrame } from '../engine/mascot'

/**
 * One transparent canvas over the whole page, above everything and deaf to
 * the pointer. Stages that opt in draw their characters here instead of on
 * their own canvas, so a hop, a BOO! or a shower of confetti can leave its
 * card or tile. The canvas is cleared at the start of every frame, before any
 * stage draws: this ticker is registered first, and the ticker runs in order.
 */
let canvas: HTMLCanvasElement | null = null
let g: CanvasRenderingContext2D | null = null
let dpr = 1

function ensure() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'page-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)
  g = canvas.getContext('2d')
}

onFrame({
  visible: true,
  tick() {
    if (!canvas || !g) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round(innerWidth * dpr)
    const h = Math.round(innerHeight * dpr)
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, h)
  }
})

/** The overlay context, set up so (0, 0) is the top left of `rect` in CSS pixels. */
export function overlayAt(rect: DOMRect): CanvasRenderingContext2D {
  ensure()
  g!.setTransform(dpr, 0, 0, dpr, rect.left * dpr, rect.top * dpr)
  return g!
}
