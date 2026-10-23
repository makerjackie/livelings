import { Actor } from '../engine/actor'
import { onFrame } from '../engine/mascot'
import { renderActor } from '../engine/render'
import { overlayAt } from './overlay'
import type { Vec } from '../engine/math'

export interface Placement {
  cx: number
  cy: number
  R: number
  /** keep everything this actor draws inside a rounded box (grid tiles) */
  clip?: { x: number; y: number; w: number; h: number; r: number }
}

export interface StageOptions {
  /** where each actor stands, recomputed on resize */
  layout(w: number, h: number, count: number): Placement[]
  /** every actor's eyes follow the pointer anywhere on the stage */
  followPointer?: boolean
  interactive?: boolean
  shadow?: boolean
  /** paint behind the actors (labels, floor lines) */
  paint?(g: CanvasRenderingContext2D, w: number, h: number, places: Placement[]): void
  onTap?(index: number): void
  /** a tap that missed every actor */
  onTapEmpty?(): void
  /** cursor over the canvas but not over an actor */
  emptyCursor?: string
  /** a tap at a canvas point (index = actor hit, or -1); return true to skip the default poke */
  beforeTap?(p: Vec, index: number): boolean
  /** cursor for a canvas point, overriding the defaults */
  cursor?(p: Vec, index: number): string | null
  /** a canvas point under the pointer, or null when it leaves */
  onHover?(p: Vec | null): void
  /**
   * Draw the characters on the page overlay, above everything, so they can
   * leave their box. `margin` keeps them within that many pixels of this
   * canvas (default: anywhere on the page). Tile clips are ignored.
   */
  overlay?: { margin?: number }
}

/** Several actors sharing one canvas: the hero, the state matrix, variant strips. */
export class Stage {
  actors: Actor[]
  visible = true
  /** frozen: actors neither advance nor draw (another stage is animating them) */
  paused = false
  /** solid fill behind everything (for video capture, where transparency turns black) */
  background: string | null = null
  /** draw the characters on this canvas too, with their clips (for PNG and video export) */
  inline = false
  /** opacity of the characters on the overlay (a page fading out) */
  alpha = 1
  private g: CanvasRenderingContext2D
  private w = 1
  private h = 1
  private dpr = 1
  private places: Placement[] = []
  private stop: () => void
  private ro: ResizeObserver
  private io: IntersectionObserver
  private grabbed = -1
  private down: { x: number; y: number; id: number; index: number; t: number } | null = null
  private petTimer = 0
  /** recent drag positions (body units, seconds), to throw on release */
  private trail: Array<{ x: number; y: number; t: number }> = []
  private hooks: Array<(dt: number) => void> = []

  constructor(
    readonly canvas: HTMLCanvasElement,
    actors: Actor[],
    private opts: StageOptions
  ) {
    this.actors = actors
    this.g = canvas.getContext('2d')!
    canvas.style.touchAction = opts.interactive === false ? 'auto' : 'pan-y'
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    this.io = new IntersectionObserver((es) => es.forEach((e) => (this.visible = e.isIntersecting)), { rootMargin: '80px' })
    this.io.observe(canvas)
    this.resize()
    if (opts.interactive !== false) this.bind()
    else if (opts.followPointer) this.bindFollowOnly()
    this.stop = onFrame(this)
  }

  /** Run something every frame before drawing (choreography). */
  every(fn: (dt: number) => void) {
    this.hooks.push(fn)
  }

  setActors(actors: Actor[]) {
    this.actors = actors
    this.relayout()
  }

  /** Eyes follow a point anywhere on the page (client coordinates), or wander with `null`. */
  lookAtClient(x: number | null, y = 0) {
    if (x === null) return this.follow(null)
    const r = this.canvas.getBoundingClientRect()
    this.follow({ x: x - r.left, y: y - r.top })
  }

  /** Change layout, painting or tap handling in place (listeners stay bound). */
  update(opts: Partial<StageOptions>) {
    this.opts = { ...this.opts, ...opts }
    this.relayout()
  }

  placement(i: number): Placement | undefined {
    return this.places[i]
  }

  /** Draw immediately, e.g. right after taking over actors from another stage. */
  render() {
    this.relayout()
    this.draw()
  }

  /** Recompute the layout now (for layouts that animate). */
  relayoutNow() {
    this.relayout()
  }

  get size() {
    return { w: this.w, h: this.h }
  }

  tick(dt: number) {
    if (this.paused) return
    for (const h of this.hooks) h(dt)
    for (const a of this.actors) a.advance(dt)
    this.draw()
  }

  destroy() {
    this.stop()
    this.ro.disconnect()
    this.io.disconnect()
  }

  private relayout() {
    this.places = this.opts.layout(this.w, this.h, this.actors.length)
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = Math.max(1, r.width)
    this.h = Math.max(1, r.height)
    // resizing a canvas reallocates it, so only when the size really changed
    const cw = Math.round(this.w * this.dpr)
    const ch = Math.round(this.h * this.dpr)
    if (this.canvas.width !== cw) this.canvas.width = cw
    if (this.canvas.height !== ch) this.canvas.height = ch
    this.relayout()
    this.draw()
  }

  private draw() {
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.background) {
      g.fillStyle = this.background
      g.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.opts.paint?.(g, this.w, this.h, this.places)
    if (this.opts.overlay && !this.inline) return this.drawOnOverlay(this.opts.overlay.margin)
    this.actors.forEach((a, i) => {
      const p = this.places[i]
      if (!p || p.R <= 1) return
      if (p.clip) {
        g.save()
        g.beginPath()
        g.roundRect(p.clip.x, p.clip.y, p.clip.w, p.clip.h, p.clip.r)
        g.clip()
      }
      renderActor(g, a, { cx: p.cx, cy: p.cy, R: p.R, shadow: this.opts.shadow })
      if (p.clip) g.restore()
    })
  }

  private drawOnOverlay(margin = Infinity) {
    const r = this.canvas.getBoundingClientRect()
    if (r.width < 1 || this.alpha <= 0) return
    const o = overlayAt(r)
    o.save()
    o.globalAlpha = this.alpha
    if (Number.isFinite(margin)) {
      o.beginPath()
      o.rect(-margin, -margin, this.w + margin * 2, this.h + margin * 2)
      o.clip()
    }
    this.actors.forEach((a, i) => {
      const p = this.places[i]
      if (!p || p.R <= 1) return
      // a tile that has slid out of view (the camera zoomed in) stays out of view
      const b = p.clip
      if (b && (b.x > this.w || b.y > this.h || b.x + b.w < 0 || b.y + b.h < 0)) return
      renderActor(o, a, { cx: p.cx, cy: p.cy, R: p.R, shadow: this.opts.shadow })
    })
    o.restore()
  }

  private local(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private toBody(i: number, p: Vec): Vec {
    const pl = this.places[i]
    return { x: (p.x - pl.cx) / pl.R, y: (p.y - pl.cy) / pl.R }
  }

  private hit(p: Vec): number {
    let best = -1
    let bestD = Infinity
    this.actors.forEach((a, i) => {
      const pl = this.places[i]
      if (!pl) return
      const c = a.bodyCenter()
      const d = Math.hypot(p.x - (pl.cx + c.x * pl.R), p.y - (pl.cy + c.y * pl.R)) / pl.R
      if (d < 1.35 && d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }

  private follow(p: Vec | null) {
    this.actors.forEach((a, i) => a.pointer(p && this.places[i] ? this.toBody(i, p) : null))
  }

  private bindFollowOnly() {
    const move = (e: PointerEvent) => this.follow(this.local(e))
    this.canvas.addEventListener('pointermove', move)
    this.canvas.addEventListener('pointerleave', () => this.follow(null))
  }

  private bind() {
    const c = this.canvas
    c.addEventListener('pointermove', (e) => {
      const p = this.local(e)
      this.opts.onHover?.(p)
      if (this.opts.followPointer) this.follow(p)
      else {
        const i = this.hit(p)
        this.actors.forEach((a, k) => a.pointer(k === i ? this.toBody(k, p) : null))
      }
      const over = this.hit(p)
      c.style.cursor = this.grabbed >= 0 ? 'grabbing' : (this.opts.cursor?.(p, over) ?? (over >= 0 ? 'grab' : (this.opts.emptyCursor ?? 'default')))
      if (!this.down || e.pointerId !== this.down.id || this.down.index < 0) return
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y)
      if (moved > 8) {
        window.clearTimeout(this.petTimer)
        const a = this.actors[this.down.index]
        a.petting = false
        if (this.grabbed < 0) {
          this.grabbed = this.down.index
          const r = c.getBoundingClientRect()
          a.grab(this.toBody(this.grabbed, { x: this.down.x - r.left, y: this.down.y - r.top }))
          a.express('surprised')
        }
        const q = this.toBody(this.grabbed, p)
        a.drag(q)
        const t = performance.now() / 1000
        this.trail = [...this.trail.filter((s) => t - s.t < 0.12), { ...q, t }]
      }
    })
    c.addEventListener('pointerdown', (e) => {
      const index = this.hit(this.local(e))
      this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, index, t: performance.now() }
      if (index < 0) return
      c.setPointerCapture(e.pointerId)
      this.petTimer = window.setTimeout(() => {
        const a = this.actors[index]
        a.petting = true
        a.express('happy')
      }, 380)
    })
    const up = (e: PointerEvent) => {
      if (!this.down || e.pointerId !== this.down.id) return
      window.clearTimeout(this.petTimer)
      const i = this.down.index
      const tap = this.grabbed < 0 && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 8
      if (tap && !(i >= 0 && this.actors[i].petting) && this.opts.beforeTap?.(this.local(e), i)) {
        if (i >= 0) this.actors[i].petting = false
        this.down = null
        return
      }
      if (i >= 0) {
        const a = this.actors[i]
        const wasPet = a.petting
        a.petting = false
        if (this.grabbed >= 0) {
          a.express(a.state === 'idle' ? a.mood : {})
          a.release(throwVelocity(this.trail))
        } else if (!wasPet) {
          a.tap()
          this.opts.onTap?.(i)
        } else a.express(a.state === 'idle' ? a.mood : {})
      } else if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 8) this.opts.onTapEmpty?.()
      this.grabbed = -1
      this.down = null
      this.trail = []
    }
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    c.addEventListener('pointerleave', () => {
      this.opts.onHover?.(null)
      if (!this.down) this.follow(null)
    })
  }
}

/** Speed of the last few drag samples, in body units per second. */
export function throwVelocity(trail: Array<{ x: number; y: number; t: number }>): Vec | undefined {
  if (trail.length < 2) return undefined
  const a = trail[0]
  const b = trail[trail.length - 1]
  const dt = b.t - a.t
  return dt > 0.01 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : undefined
}
