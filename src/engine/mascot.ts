import { Actor, type ActorOptions } from './actor'
import { renderActor } from './render'
import type { ExpressionName } from './eyes'
import type { CharacterDef } from './types'
import type { Vec } from './math'

/* ----------------------------------------------------- shared ticker */

type Tickable = { tick(dt: number, now: number): void; visible: boolean }
const live = new Set<Tickable>()
let last = 0
let raf = 0

function loop(now: number) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
  last = now
  for (const t of live) if (t.visible) t.tick(dt, now)
  raf = live.size ? requestAnimationFrame(loop) : 0
  if (!raf) last = 0
}

/** Register something to be ticked every animation frame (one rAF for the whole page). */
export function onFrame(t: Tickable): () => void {
  live.add(t)
  if (!raf) raf = requestAnimationFrame(loop)
  return () => live.delete(t)
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------ mascot */

export interface MascotOptions extends ActorOptions {
  character: CharacterDef
  /** react to hover, taps, drags and long presses (default true) */
  interactive?: boolean
  /** draw the ground shadow (default true) */
  shadow?: boolean
  /** body radius as a fraction of the available size (default fits the box) */
  zoom?: number
  /** called after an action is played through the pointer (tap, pet) */
  onInteract?(kind: 'tap' | 'pet' | 'drag'): void
}

/**
 * A character living in a `<canvas>` that fills `host`.
 *
 *   const m = createMascot(el, { character: inky })
 *   m.play('thinking')   // loops until another state
 *   m.play('done')       // one-shot, then back to thinking
 */
export class Mascot {
  readonly actor: Actor
  readonly canvas: HTMLCanvasElement
  visible = true
  private g: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private stop: () => void
  private ro: ResizeObserver
  private io: IntersectionObserver
  private opts: MascotOptions
  private cleanup: Array<() => void> = []
  private ownsCanvas: boolean

  constructor(host: HTMLElement, opts: MascotOptions) {
    this.opts = opts
    this.actor = new Actor(opts.character, opts)
    this.actor.calm = reducedMotion()
    this.canvas = host instanceof HTMLCanvasElement ? host : document.createElement('canvas')
    this.ownsCanvas = this.canvas !== host
    if (this.ownsCanvas) {
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'
      host.appendChild(this.canvas)
    }
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute('aria-label', `${opts.character.name.en}, ${opts.character.tagline.en}`)
    this.g = this.canvas.getContext('2d')!
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.canvas)
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) this.visible = e.isIntersecting
    })
    this.io.observe(this.canvas)
    this.resize()
    if (opts.interactive !== false) this.bindPointer()
    this.stop = onFrame(this)
  }

  /** Play an action: a loop becomes the state, a one-shot plays once. */
  play(id: string): boolean {
    return this.actor.play(id)
  }

  get state(): string {
    return this.actor.state
  }

  setMood(mood: ExpressionName | null) {
    this.actor.setMood(mood)
  }

  /** Become any short text (a digit, "!", "OK") for `hold` seconds, even if states change meanwhile. */
  morphText(text: string, hold = 1.6) {
    this.actor.holdShape(`text:${text}`, hold)
    this.actor.hop(0.5)
  }

  /** Make the eyes follow a point in client (page) coordinates, or let them wander with `null`. */
  lookAtClient(x: number | null, y?: number) {
    if (x === null || y === undefined) return this.actor.pointer(null)
    this.actor.pointer(this.toBody(x, y))
  }

  get layout() {
    const R = Math.min(this.w / 3.3, this.h / 3.3) * (this.opts.zoom ?? 1)
    return { R, cx: this.w / 2, cy: this.h * 0.84 - R }
  }

  tick(dt: number) {
    this.actor.advance(dt)
    this.draw()
  }

  draw() {
    const { g } = this
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const { R, cx, cy } = this.layout
    if (R > 1) renderActor(g, this.actor, { cx, cy, R, shadow: this.opts.shadow })
  }

  destroy() {
    this.stop()
    this.ro.disconnect()
    this.io.disconnect()
    for (const c of this.cleanup) c()
    if (this.ownsCanvas) this.canvas.remove()
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = Math.max(1, r.width)
    this.h = Math.max(1, r.height)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.draw()
  }

  private toBody(clientX: number, clientY: number): Vec {
    const r = this.canvas.getBoundingClientRect()
    const { R, cx, cy } = this.layout
    return { x: (clientX - r.left - cx) / R, y: (clientY - r.top - cy) / R }
  }

  private bindPointer() {
    const c = this.canvas
    const a = this.actor
    let down: { x: number; y: number; t: number; id: number } | null = null
    let dragging = false
    let petTimer = 0
    let trail: Array<{ x: number; y: number; t: number }> = []
    const onMove = (e: PointerEvent) => {
      const p = this.toBody(e.clientX, e.clientY)
      a.pointer(p)
      if (!down || e.pointerId !== down.id) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      if (moved > 8) {
        window.clearTimeout(petTimer)
        if (a.petting) a.petting = false
        if (!dragging) {
          dragging = true
          a.grab(this.toBody(down.x, down.y))
          a.express('surprised')
          this.opts.onInteract?.('drag')
        }
        a.drag(p)
        const t = performance.now() / 1000
        trail = [...trail.filter((s) => t - s.t < 0.12), { ...p, t }]
      }
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
      dragging = false
      c.setPointerCapture(e.pointerId)
      petTimer = window.setTimeout(() => {
        a.petting = true
        a.express('happy')
        this.opts.onInteract?.('pet')
      }, 380)
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      window.clearTimeout(petTimer)
      const wasPet = a.petting
      a.petting = false
      if (dragging) {
        a.express(a.state === 'idle' ? a.mood : {})
        const first = trail[0]
        const last = trail[trail.length - 1]
        const dt = first && last ? last.t - first.t : 0
        a.release(dt > 0.01 ? { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt } : undefined)
      } else if (!wasPet) {
        a.tap()
        this.opts.onInteract?.('tap')
      } else a.express(a.state === 'idle' ? a.mood : {})
      down = null
      dragging = false
      trail = []
    }
    const onLeave = () => {
      if (!down) a.pointer(null)
    }
    c.addEventListener('pointermove', onMove)
    c.addEventListener('pointerdown', onDown)
    c.addEventListener('pointerup', onUp)
    c.addEventListener('pointercancel', onUp)
    c.addEventListener('pointerleave', onLeave)
    c.style.cursor = 'grab'
    this.cleanup.push(() => {
      c.removeEventListener('pointermove', onMove)
      c.removeEventListener('pointerdown', onDown)
      c.removeEventListener('pointerup', onUp)
      c.removeEventListener('pointercancel', onUp)
      c.removeEventListener('pointerleave', onLeave)
    })
  }
}

export function createMascot(host: HTMLElement, opts: MascotOptions): Mascot {
  return new Mascot(host, opts)
}
