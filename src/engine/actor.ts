import { UNIVERSAL, floatGlyph, sparkles, steam } from './behaviors'
import { DEFAULT_EYES, EXPRESSIONS, EYE_KEYS, resolveEyes, type Expression, type ExpressionName, type Eyes } from './eyes'
import { Spring, clamp, createRng, hashString, wander, type Vec } from './math'
import { named } from './library'
import { align, faceAnchor, type FaceAnchor, type Shape } from './shapes'
import type { Accessory, Behavior, CharacterDef, Palette, Particle, ParticleSpec } from './types'

/**
 * Longest simulation step. Each frame is split into equal steps no longer
 * than this, so motion follows the display's real frame times at 60 Hz,
 * 120 Hz or anything else without stutter. The same seed and the same
 * sequence of `advance()` calls always give the same frames.
 */
export const STEP = 1 / 120

/** Wall-clock seconds, for pointer speed (pointer events arrive between frames). */
const wall = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0)

/** Shapes are immutable, so every actor of a character shares them (and their face anchors). */
const restShapes = new WeakMap<CharacterDef, Shape>()
const ownShapes = new WeakMap<CharacterDef, Map<string, Shape>>()
function restOf(def: CharacterDef): Shape {
  let s = restShapes.get(def)
  if (!s) {
    s = def.rest()
    restShapes.set(def, s)
  }
  return s
}

export interface ActorOptions {
  /** any string: picks a palette and accessory, and seeds every random choice */
  seed?: string
  /** force a palette by id (otherwise the seed picks; no seed = the signature palette) */
  palette?: string
  /** force an accessory by id, or `null` for none */
  accessory?: string | null
  /** play small idle moves now and then (default true) */
  fidget?: boolean
  /** start in this state */
  state?: string
}

interface Overlay {
  b: Behavior
  t: number
  alpha: Spring
  dying: boolean
}

const faceCache = new WeakMap<Shape, FaceAnchor>()
function anchorOf(shape: Shape): FaceAnchor {
  let a = faceCache.get(shape)
  if (!a) {
    a = faceAnchor(shape)
    faceCache.set(shape, a)
  }
  return a
}

/**
 * One living character: a soft body made of springs, a face, and a small
 * state machine of behaviours.
 *
 * Behaviours never animate the body directly. They only move *targets* (the
 * silhouette, the eyes, the lean, the hover height...) and give impulses
 * (hop, poke, spin). Springs do the rest. So a state change can land at any
 * moment, even halfway through another one, and position and velocity stay
 * continuous: nothing ever jumps or cross-fades.
 */
export class Actor {
  readonly def: CharacterDef
  readonly behaviors: Record<string, Behavior>
  palette: Palette
  accessory: Accessory | null
  readonly seed: string
  time = 0
  /** set by the host when the user prefers reduced motion */
  calm = false
  fidget: boolean

  private readonly rng: () => number
  private readonly phase: number

  readonly rest: Shape
  private target: Shape
  private targetKey = 'rest'
  private targetFace: FaceAnchor
  readonly base: Vec[]
  private readonly baseV: Vec[]
  readonly off: Vec[]
  private readonly offV: Vec[]
  readonly faceX: Spring
  readonly faceY: Spring
  readonly faceR: Spring
  readonly thicken: Spring

  eyes: Eyes
  private eyeV: Record<keyof Eyes, number>
  private eyeTarget: Eyes
  mood: Expression = {}

  height = 0
  vy = 0
  airborne = false
  readonly squash: Spring
  spin = 0
  private spinV = 0
  readonly lean = new Spring(0, 90, 14)
  /** leaning towards a pointer that comes close */
  readonly leanIn = new Spring(0, 55, 10)
  readonly rootX = new Spring(0, 70, 13)
  readonly scale = new Spring(1, 120, 15)
  readonly hover: Spring
  readonly tint = new Spring(0, 40, 11)
  tintColor = '#000000'
  readonly fluff: Spring
  private readonly effects = new Map<string, { s: Spring; rest: number }>()
  /** moments a character's own drawing keys off (when a glint started) */
  readonly cues: Record<string, number> = {}
  private readonly lookX = new Spring(0, 70, 15)
  private readonly lookY = new Spring(0, 70, 15)
  private pointerLook: Vec | null = null
  private behaviorLook: Vec | null = null
  private shakeAmp = 0
  private shakeFreq = 0
  private shakeDecay = 0
  private shakePhase = 0
  wobbleBoost = 0
  private blinkNext = 1.6
  private blinkAt = -10
  private grabbed: { index: number; anchor: Vec; target: Vec } | null = null
  petting = false
  /** last hard landing, for splashes */
  landing: { time: number; strength: number } | null = null

  particles: Particle[] = []
  overlays: Overlay[] = []
  loopId = 'idle'
  loopT = 0
  onceId: string | null = null
  onceT = 0
  private nextFidget = 5

  constructor(def: CharacterDef, opts: ActorOptions = {}) {
    this.def = def
    this.behaviors = { ...UNIVERSAL, ...def.actions }
    this.seed = opts.seed ?? ''
    const h = hashString(`${def.id}:${this.seed}`)
    this.rng = createRng(h)
    this.phase = (h % 1000) / 159
    this.fidget = opts.fidget ?? true

    const pick = <T>(list: T[]): T => list[Math.floor(createRng(h ^ 0x9e37)() * list.length) % list.length]
    this.palette =
      def.palettes.find((p) => p.id === opts.palette) ?? (this.seed ? pick(def.palettes) : def.palettes[0])
    const accessories = def.accessories ?? []
    if (opts.accessory === null) this.accessory = null
    else if (opts.accessory) this.accessory = accessories.find((x) => x.id === opts.accessory) ?? null
    else if (this.seed && accessories.length) {
      const roll = createRng(h ^ 0x51ed)()
      this.accessory = roll < 0.45 ? null : accessories[Math.floor(roll * 997) % accessories.length]
    } else this.accessory = null

    const p = def.physics
    this.rest = restOf(def)
    this.target = this.rest
    this.targetFace = this.faceOf(this.rest)
    this.base = this.rest.map((q) => ({ ...q }))
    this.baseV = this.rest.map(() => ({ x: 0, y: 0 }))
    this.off = this.rest.map(() => ({ x: 0, y: 0 }))
    this.offV = this.rest.map(() => ({ x: 0, y: 0 }))
    this.faceX = new Spring(this.targetFace.x, p.morphStiffness, p.morphDamping * 1.3)
    this.faceY = new Spring(this.targetFace.y, p.morphStiffness, p.morphDamping * 1.3)
    this.faceR = new Spring(this.targetFace.r, p.morphStiffness, p.morphDamping * 1.3)
    this.thicken = new Spring(0, p.morphStiffness, p.morphDamping * 1.3)
    this.eyes = { ...def.eyes }
    this.eyeTarget = { ...def.eyes }
    this.eyeV = Object.fromEntries(EYE_KEYS.map((k) => [k, 0])) as Record<keyof Eyes, number>
    this.squash = new Spring(0, p.squashStiffness, p.squashDamping)
    this.hover = new Spring(p.floaty ? p.hover : 0, 30, 9)
    if (p.floaty) this.height = -p.hover
    this.fluff = new Spring(def.fur ?? 0, 110, 9)
    for (const [name, e] of Object.entries(def.effects ?? {})) {
      this.effects.set(name, { s: new Spring(e.rest, e.stiffness ?? 70, e.damping ?? 12), rest: e.rest })
    }
    this.nextFidget = 3 + this.rng() * 4

    const start = opts.state && this.behaviors[opts.state] ? opts.state : 'idle'
    this.loopId = this.behaviors[start].kind === 'loop' ? start : 'idle'
    this.addOverlay(this.behaviors[this.loopId])
    this.behaviors[this.loopId].enter?.(this, false)
    if (this.behaviors[start].kind === 'once') this.play(start)
  }

  /* ------------------------------------------------------------- control */

  /** Play an action by id. Loops become the new state; one-shots play once and hand back. */
  play(id: string): boolean {
    const b = this.behaviors[id]
    if (!b) return false
    if (b.kind === 'loop') {
      if (id === this.loopId && !this.onceId) return true
      this.fadeOverlay(this.behaviors[this.loopId])
      if (this.onceId) this.fadeOverlay(this.behaviors[this.onceId])
      this.onceId = null
      this.loopId = id
      this.loopT = 0
      this.resetTargets()
      b.enter?.(this, false)
      this.addOverlay(b)
    } else {
      if (this.onceId) this.fadeOverlay(this.behaviors[this.onceId])
      this.onceId = id
      this.onceT = 0
      this.resetTargets()
      b.enter?.(this, false)
      this.addOverlay(b)
    }
    return true
  }

  get state(): string {
    return this.onceId ?? this.loopId
  }

  /** A persistent mood layered on the resting face (e.g. "sleepy" all day). */
  setMood(expr: ExpressionName | Expression | null) {
    this.mood = expr === null ? {} : typeof expr === 'string' ? EXPRESSIONS[expr] : expr
    if (this.state === 'idle') this.express(this.mood)
  }

  /* ---------------------------------------------- verbs for behaviours */

  rand(): number {
    return this.rng()
  }

  morph(shape: Shape | string, opts: { blink?: boolean; squash?: number } = {}) {
    const key = typeof shape === 'string' ? shape : ''
    if (key && key === this.targetKey) return
    const s = typeof shape === 'string' ? this.shapeNamed(shape) : shape
    this.targetKey = key
    this.target = align(s, this.base)
    this.targetFace = this.faceOf(s)
    this.squash.velocity -= (opts.squash ?? 3) * this.def.physics.squashiness
    if (opts.blink !== false) this.blink()
  }

  private held: { key: string; until: number } | null = null

  /**
   * Hold a shape for a while, through any state changes (an unread count, a
   * score). Behaviours that morph on their own still win while they run.
   */
  holdShape(key: string, seconds: number) {
    this.held = { key, until: this.time + seconds }
    this.morph(key)
  }


  /** Resolve a shape name, preferring this character's own version of it. */
  shapeNamed(key: string): Shape {
    if (key === 'rest') return this.rest
    const own = this.def.shapes?.[key]
    if (!own) return named(key)
    let cache = ownShapes.get(this.def)
    if (!cache) {
      cache = new Map()
      ownShapes.set(this.def, cache)
    }
    let s = cache.get(key)
    if (!s) {
      s = own()
      cache.set(key, s)
    }
    return s
  }

  /** Name of the shape it is turning into ('rest', 'wide', 'text:7'…), or '' for an unnamed one. */
  get shapeKey(): string {
    return this.targetKey
  }

  private faceOf(s: Shape): FaceAnchor {
    return s === this.rest && this.def.face ? this.def.face : anchorOf(s)
  }

  /** Name of the expression showing ('custom' for a one-off), for characters that draw their own face. */
  expression = 'neutral'

  express(expr: ExpressionName | Expression) {
    const e = resolveEyes(this.def.eyes, typeof expr === 'string' ? EXPRESSIONS[expr] : expr)
    const name = typeof expr === 'string' ? expr : Object.keys(expr).length ? 'custom' : 'neutral'
    // during a flash the new face waits until the flash is over
    if (this.flashBack) {
      this.flashBack = e
      this.flashName = name
    } else {
      this.eyeTarget = e
      this.expression = name
    }
  }

  private flashBack: Eyes | null = null
  private flashName = 'neutral'
  private flashUntil = 0

  /** A brief face on top of whatever is going on (a flinch, a giggle); the old face comes back. */
  flash(expr: ExpressionName | Expression, seconds: number) {
    if (!this.flashBack) {
      this.flashBack = this.eyeTarget
      this.flashName = this.expression
    }
    this.eyeTarget = resolveEyes(this.def.eyes, typeof expr === 'string' ? EXPRESSIONS[expr] : expr)
    this.expression = typeof expr === 'string' ? expr : 'custom'
    this.flashUntil = this.time + seconds
  }

  hop(strength = 1) {
    const p = this.def.physics
    if (p.floaty) {
      this.vy -= p.hopPower * strength * 0.8
      this.squash.velocity -= 6 * strength * p.squashiness
      return
    }
    if (this.airborne && this.height < -0.05) return
    this.airborne = true
    this.vy = -p.hopPower * strength
    this.squash.velocity -= 7 * strength * p.squashiness
  }

  /**
   * Squeeze the whole outline inward (a tap, a landing). Applied to every
   * point with a gentle wave so the dent is smooth: impulses on isolated
   * points excite high-frequency ripples that read as spikes on soft bodies.
   */
  poke(strength = 1) {
    const cx = this.faceX.value
    const cy = this.faceY.value
    const n = this.offV.length
    const phase = this.rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const k = 1.5 * strength * (1 + 0.35 * Math.sin((i / n) * Math.PI * 4 + phase))
      this.offV[i].x -= (this.base[i].x - cx) * k
      this.offV[i].y -= (this.base[i].y - cy) * k
    }
    this.squash.velocity += 4 * strength * this.def.physics.squashiness
  }

  /** A jiggle: a few smooth random waves around the outline, never spikes. */
  jiggle(strength = 1) {
    const n = this.offV.length
    const modes = [2, 3, 5].map((m) => ({ m, phase: this.rng() * Math.PI * 2, amp: (0.6 + this.rng() * 0.6) / m }))
    for (let i = 0; i < n; i++) {
      let w = 0
      for (const { m, phase, amp } of modes) w += Math.sin((i / n) * Math.PI * 2 * m + phase) * amp
      const dx = this.base[i].x - this.faceX.value
      const dy = this.base[i].y - this.faceY.value
      const len = Math.hypot(dx, dy) || 1
      this.offV[i].x += (dx / len) * w * 3 * strength
      this.offV[i].y += (dy / len) * w * 3 * strength
    }
  }

  squish(amount: number) {
    this.squash.velocity += amount * this.def.physics.squashiness
  }

  /** Full turns to spin through (sign = direction). */
  spinBy(turns: number) {
    this.spinV += turns * 14
  }

  shake(amplitude = 0.08, frequency = 22, decay = 3) {
    this.shakeAmp = amplitude
    this.shakeFreq = frequency
    this.shakeDecay = decay
    this.shakePhase = this.time
  }

  lookAt(x: number, y: number) {
    this.behaviorLook = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }
  }

  lookFree() {
    this.behaviorLook = null
  }

  blink() {
    this.blinkAt = this.time
  }

  bristle(strength = 1) {
    this.fluff.velocity += 13 * strength
  }

  /**
   * One of the character's own effect springs (a gear's teeth, a folded
   * corner), declared in `def.effects`. Like every other target, it goes back
   * to its rest value on each state change.
   */
  fx(name: string): Spring {
    let e = this.effects.get(name)
    if (!e) {
      e = { s: new Spring(0, 70, 12), rest: 0 }
      this.effects.set(name, e)
    }
    return e.s
  }

  /** Current value of an effect spring, 0 if the character has none by that name. */
  fxValue(name: string): number {
    return this.effects.get(name)?.s.value ?? 0
  }

  /** Remember this moment under `name`; `since(name)` reads how long ago it was. */
  cue(name: string) {
    this.cues[name] = this.time
  }

  since(name: string): number {
    return this.time - (this.cues[name] ?? -1e9)
  }

  /** Side-to-side rock of a fluttering body in the air. */
  get sway(): number {
    const f = this.def.physics.flutter
    if (!f || !this.airborne) return 0
    return Math.sin(this.time * 7) * f * clamp(-this.height * 1.5)
  }

  emit(spec: ParticleSpec) {
    this.particles.push({
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      drag: 0,
      grow: 0,
      rot: 0,
      vrot: 0,
      back: false,
      lands: false,
      ...spec,
      glyph: spec.glyph ?? '',
      color: spec.color ?? this.palette.body,
      age: 0,
      landed: false
    })
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220)
  }

  /** Current body centre (rest centre is 0,0), in body units. */
  bodyCenter(): Vec {
    return { x: this.rootX.value + this.shakeOffset(), y: this.height }
  }

  shakeOffset(): number {
    if (!this.shakeAmp) return 0
    const t = this.time - this.shakePhase
    return Math.sin(t * this.shakeFreq) * this.shakeAmp * Math.exp(-t * this.shakeDecay)
  }

  get spinAngle(): number {
    return this.spin
  }

  /* ------------------------------------------------------- pointer input */

  /** Pointer position in body units relative to the rest centre, or null when it leaves. */
  private ptr: { x: number; y: number; t: number } | null = null
  private hoverSince: number | null = null
  private lastPurr = -10
  private lastStartle = -10
  private lastTickle = -10
  private flips: number[] = []
  private lastDir = 0
  private taps: number[] = []

  /**
   * Where the pointer is, in body units from the rest centre (null when it
   * leaves). Besides moving the eyes, it is how a character notices you: it
   * leans towards a pointer that comes close, flinches when one whips past,
   * enjoys one that rests on it, and giggles when one rubs back and forth.
   */
  /** whether a pointer is over the stage, and since when (sim time) */
  pointerHere = false
  pointerSince = 0

  pointer(p: Vec | null) {
    if (!p) {
      this.pointerLook = null
      this.leanIn.target = 0
      this.hoverSince = null
      this.ptr = null
      if (this.pointerHere) {
        this.pointerHere = false
        this.pointerSince = this.time
      }
      return
    }
    if (!this.pointerHere) {
      const away = this.time - this.pointerSince
      this.pointerHere = true
      this.pointerSince = this.time
      this.def.react?.arrive?.(this, away)
    }
    const c = this.bodyCenter()
    const dx = p.x - c.x
    const dy = p.y - c.y
    const d = Math.hypot(dx, dy)
    this.pointerLook = { x: clamp(dx / 1.6, -1, 1), y: clamp(dy / 1.6, -1, 1) }
    const near = clamp(1 - (d - 1) / 1.8)
    this.leanIn.target = clamp(dx / 2, -1, 1) * 0.12 * near
    if (d < 0.95) this.hoverSince ??= this.time
    else this.hoverSince = null

    const now = wall()
    if (!this.ptr) {
      this.ptr = { x: p.x, y: p.y, t: now }
      return
    }
    const dt = now - this.ptr.t
    if (dt < 0.008) return
    const vx = (p.x - this.ptr.x) / dt
    const vy = (p.y - this.ptr.y) / dt
    this.ptr = { x: p.x, y: p.y, t: now }
    if (this.calm || this.grabbed) return
    if (Math.hypot(vx, vy) > 16 && d > 0.85 && d < 2.4 && this.time - this.lastStartle > 2.2) this.startle(dx)
    if (d < 1.15 && Math.abs(vx) > 2.5) {
      const dir = Math.sign(vx)
      if (this.lastDir && dir !== this.lastDir) this.flips = [...this.flips.filter((t) => now - t < 1), now]
      this.lastDir = dir
      if (this.flips.length >= 4 && this.time - this.lastTickle > 1.6) {
        this.flips = []
        this.giggle()
      }
    }
  }

  /** Something whipped past: flinch away, then look after it. */
  private startle(dx: number) {
    this.lastStartle = this.time
    if (this.def.react?.startle?.(this, dx)) return
    this.flash('surprised', 0.6)
    this.hop(0.4)
    this.squish(-3)
    this.rootX.velocity -= Math.sign(dx || 1) * 0.9
  }

  /** The pointer is resting on it: eyes close happily, it stretches into the hand. */
  private purr() {
    this.lastPurr = this.time
    if (this.def.react?.purr?.(this)) return
    this.flash('happy', 1.2)
    this.squish(-2.4)
    if (this.rng() < 0.5) floatGlyph(this, '♥', 'heart', '#ff6b8a', 0.18)
  }

  /** Rubbed back and forth: a fit of giggles. */
  private giggle() {
    this.lastTickle = this.time
    if (this.def.react?.giggle?.(this)) return
    this.flash('happy', 1.5)
    this.jiggle(0.9)
    this.hop(0.3)
    this.shake(0.035, 32, 2.5)
    floatGlyph(this, '♥', 'heart', '#ff6b8a', 0.22)
    sparkles(this, 3, '#ffd43b', 0.6)
  }

  /**
   * A tap on the body. Taps in quick succession escalate: a poke, a giggle,
   * then dizzy (three), then cross (five). Returns how many taps in a row.
   */
  tap(): number {
    this.taps = [...this.taps.filter((t) => this.time - t < 1.3), this.time]
    const n = this.taps.length
    if (this.def.react?.tap?.(this, n)) return n
    this.poke(1)
    this.bristle(0.7)
    if (n >= 5) {
      this.taps = []
      this.flash('angry', 1.8)
      this.shake(0.06, 30, 1.6)
      this.hop(0.5)
      steam(this, 3)
    } else if (n === 3) {
      this.flash('dizzy', 1.6)
      this.spinBy(1)
      this.hop(0.8)
      sparkles(this, 5, '#ffd43b')
    } else if (n === 4) {
      this.flash('worried', 0.9)
      this.hop(0.5)
    } else {
      this.flash(n === 1 ? 'surprised' : 'happy', 0.45)
      this.hop(0.6)
    }
    return n
  }

  grab(p: Vec) {
    const c = this.bodyCenter()
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < this.base.length; i++) {
      const d = Math.hypot(this.base[i].x + this.off[i].x + c.x - p.x, this.base[i].y + this.off[i].y + c.y - p.y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    const anchor = { x: this.base[best].x + this.off[best].x + c.x, y: this.base[best].y + this.off[best].y + c.y }
    this.grabbed = { index: best, anchor, target: anchor }
  }

  drag(p: Vec) {
    if (!this.grabbed) return
    const max = this.def.physics.stretch
    let dx = p.x - this.grabbed.anchor.x
    let dy = p.y - this.grabbed.anchor.y
    const len = Math.hypot(dx, dy)
    if (len > max) {
      dx = (dx / len) * max
      dy = (dy / len) * max
    }
    this.grabbed.target = { x: this.grabbed.anchor.x + dx, y: this.grabbed.anchor.y + dy }
  }

  /**
   * Let go after a drag. With a velocity (body units per second) it was
   * flung: off it goes, spinning, and comes back a little dizzy.
   */
  release(velocity?: Vec) {
    this.grabbed = null
    if (!velocity) return
    const speed = Math.hypot(velocity.x, velocity.y)
    if (speed < 5) return
    this.rootX.velocity += clamp(velocity.x * 0.35, -9, 9)
    this.hop(clamp(-velocity.y / 6, 0.4, 1.5))
    this.spinBy(Math.sign(velocity.x || 1) * Math.min(1.5, speed / 12))
    this.flash('dizzy', 1.4)
  }

  get isGrabbed(): boolean {
    return this.grabbed !== null
  }

  /* ---------------------------------------------------------- simulation */

  /** Advance by real seconds; internally stepped at a fixed rate. */
  advance(seconds: number) {
    const total = Math.min(Math.max(seconds, 0), 0.25)
    const n = Math.ceil(total / STEP - 1e-9)
    for (let i = 0; i < n; i++) this.step(total / n)
  }

  private step(dt: number) {
    this.time += dt
    if (this.held && this.time >= this.held.until) {
      if (this.targetKey === this.held.key) this.morph('rest')
      this.held = null
    }
    this.runBehaviors(dt)
    if (this.flashBack && this.time >= this.flashUntil) {
      this.eyeTarget = this.flashBack
      this.expression = this.flashName
      this.flashBack = null
    }
    this.def.update?.(this, dt)
    if (this.hoverSince !== null && this.time - this.hoverSince > 0.8 && this.time - this.lastPurr > 1.6 && !this.grabbed) this.purr()
    this.integrate(dt)
    this.updateParticles(dt)
    for (const o of this.overlays) {
      o.t += dt
      o.alpha.step(dt)
    }
    this.overlays = this.overlays.filter((o) => !(o.dying && o.alpha.value < 0.01))
  }

  private runBehaviors(dt: number) {
    if (this.onceId) {
      const b = this.behaviors[this.onceId]
      this.onceT += dt
      b.tick?.(this, this.onceT, dt)
      if (this.onceT >= (b.duration ?? 1.5)) {
        this.fadeOverlay(b)
        this.onceId = null
        this.resetTargets()
        this.behaviors[this.loopId].enter?.(this, true)
      }
    } else {
      this.loopT += dt
      this.behaviors[this.loopId].tick?.(this, this.loopT, dt)
      if (this.loopId === 'idle' && this.fidget && !this.calm && this.def.fidgets.length && this.time >= this.nextFidget) {
        const id = this.def.fidgets[Math.floor(this.rng() * this.def.fidgets.length)]
        this.nextFidget = this.time + 5 + this.rng() * 7
        if (!this.grabbed) this.play(id)
      }
    }
    if (this.time >= this.blinkNext) {
      this.blinkAt = this.time
      this.blinkNext = this.time + 1.9 + this.rng() * 2.8
      if (this.rng() < 0.18) this.blinkNext = this.time + 0.26
    }
  }

  private resetTargets() {
    this.morph(this.held ? this.held.key : 'rest', { squash: 1.5 })
    this.express(this.state === 'idle' ? this.mood : {})
    this.lean.target = 0
    this.scale.target = 1
    this.tint.target = 0
    for (const e of this.effects.values()) e.s.target = e.rest
    this.hover.target = this.def.physics.floaty ? this.def.physics.hover : 0
    this.fluff.target = this.def.fur ?? 0
    this.rootX.target = 0
    this.behaviorLook = null
    this.wobbleBoost = 0
  }

  private integrate(dt: number) {
    const p = this.def.physics
    const calm = this.calm ? 0.35 : 1

    // vertical motion: gravity and the ground, or a hover spring for floaty
    // bodies and for grounded ones a behaviour has lifted (a paper plane)
    const lifted = !p.floaty && (this.hover.target > 0 || this.hover.value > 0.02)
    if (p.floaty || lifted) {
      const bob = Math.sin(this.time * 1.6 + this.phase) * 0.05 * calm
      this.hover.step(dt)
      const target = -(this.hover.value + bob)
      this.vy += ((target - this.height) * 26 - this.vy * 6.5) * dt
      this.height += this.vy * dt
      // once the lift ends, gravity brings it the rest of the way down
      if (lifted) this.airborne = true
    } else if (this.airborne) {
      this.vy += p.gravity * dt
      this.height += this.vy * dt
      if (this.height >= 0) {
        this.height = 0
        const impact = Math.min(this.vy / p.hopPower, 1.4)
        if (impact > 0.35) this.landing = { time: this.time, strength: impact }
        this.squash.velocity += 10 * impact * p.squashiness
        this.poke(0.6 * impact)
        if (p.bounce > 0 && this.vy > 1.2) this.vy = -this.vy * p.bounce
        else {
          this.vy = 0
          this.airborne = false
        }
      }
    }

    this.squash.target = this.airborne || p.floaty ? -clamp(Math.abs(this.vy) / 30, 0, 0.12) : 0
    this.squash.step(dt)

    this.spinV -= this.spinV * 3 * dt
    this.spin += this.spinV * dt
    if (!this.airborne && Math.abs(this.spinV) < 4) {
      const nearest = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2
      this.spin += (nearest - this.spin) * Math.min(1, dt * 8)
    }
    this.lean.step(dt)
    this.leanIn.step(dt)
    this.rootX.step(dt)
    this.scale.step(dt)
    this.tint.step(dt)
    for (const e of this.effects.values()) e.s.step(dt)
    this.fluff.target = this.petting ? Math.max(1, this.def.fur ?? 0) : this.fluff.target
    this.fluff.step(dt)
    if (this.fluff.value < 0) this.fluff.value = 0

    // silhouette: every point springs toward the target shape with the same
    // constants, so the whole body moves as one (no half-morphed frames) yet
    // stays velocity-continuous when a new target arrives mid-flight
    const k = p.morphStiffness
    const c = p.morphDamping
    for (let i = 0; i < this.base.length; i++) {
      const b = this.base[i]
      const v = this.baseV[i]
      const t = this.target[i]
      v.x += ((t.x - b.x) * k - v.x * c) * dt
      v.y += ((t.y - b.y) * k - v.y * c) * dt
      b.x += v.x * dt
      b.y += v.y * dt
    }
    this.faceX.target = this.targetFace.x
    this.faceY.target = this.targetFace.y
    this.faceR.target = this.targetFace.r
    this.thicken.target = clamp(0.4 - this.targetFace.r, 0, 0.2)
    this.faceX.step(dt)
    this.faceY.step(dt)
    this.faceR.step(dt)
    this.thicken.step(dt)

    // soft-body dents spring back, smoothed with their neighbours
    const n = this.off.length
    const wob = (p.wobble + this.wobbleBoost) * calm
    const fx = this.faceX.value
    const fy = this.faceY.value
    const c0 = this.bodyCenter()
    for (let i = 0; i < n; i++) {
      const o = this.off[i]
      const v = this.offV[i]
      let tx = 0
      let ty = 0
      let stiff = p.softStiffness
      if (this.grabbed && this.grabbed.index === i) {
        tx = this.grabbed.target.x - c0.x - this.base[i].x
        ty = this.grabbed.target.y - c0.y - this.base[i].y
        stiff = p.softStiffness * 2.5
      } else if (wob > 0) {
        const dx = this.base[i].x - fx
        const dy = this.base[i].y - fy
        const len = Math.hypot(dx, dy) || 1
        const w = Math.sin(this.time * 5.2 + (i / n) * Math.PI * 6 + this.phase) * wob
        tx = (dx / len) * w
        ty = (dy / len) * w
      }
      const prev = this.off[(i - 1 + n) % n]
      const next = this.off[(i + 1) % n]
      const sx = (prev.x + next.x) / 2 - o.x
      const sy = (prev.y + next.y) / 2 - o.y
      v.x += ((tx - o.x) * stiff + sx * p.softSmoothing - v.x * p.softDamping) * dt
      v.y += ((ty - o.y) * stiff + sy * p.softSmoothing - v.y * p.softDamping) * dt
    }
    for (let i = 0; i < n; i++) {
      this.off[i].x += this.offV[i].x * dt
      this.off[i].y += this.offV[i].y * dt
    }

    // eyes: each parameter on its own spring, slightly underdamped
    const ek = p.eyeStiffness
    const ed = 2 * Math.sqrt(ek) * 0.82
    for (const key of EYE_KEYS) {
      this.eyeV[key] += ((this.eyeTarget[key] - this.eyes[key]) * ek - this.eyeV[key] * ed) * dt
      this.eyes[key] += this.eyeV[key] * dt
    }

    const look = this.pointerLook ?? this.behaviorLook
    if (look) {
      this.lookX.target = look.x * 0.13
      this.lookY.target = look.y * 0.09
    } else {
      this.lookX.target = wander(this.time, 9.3, this.phase) * 0.07 * calm
      this.lookY.target = wander(this.time, 7.1, this.phase + 2) * 0.04 * calm
    }
    this.lookX.step(dt)
    this.lookY.step(dt)
  }

  private updateParticles(dt: number) {
    for (const q of this.particles) {
      q.age += dt
      if (q.landed) continue
      q.vx += q.ax * dt
      q.vy += q.ay * dt
      if (q.drag) {
        q.vx *= 1 - Math.min(1, q.drag * dt)
        q.vy *= 1 - Math.min(1, q.drag * dt)
      }
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.rot += q.vrot * dt
      q.size = Math.max(0, q.size + q.grow * dt)
      if (q.lands && q.y >= 1 && q.vy > 0) {
        q.y = 1
        q.landed = true
        // a landed drop lingers briefly as a splash, then fades
        q.age = Math.max(q.age, q.life - 0.5)
      }
    }
    this.particles = this.particles.filter((q) => q.age < q.life)
  }

  /* ------------------------------------------------------- render inputs */

  /** Eye openness after blinks, 0 = closed. */
  get lid(): number {
    const k = (this.time - this.blinkAt) / 0.18
    if (k < 0 || k > 1) return 0
    return k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55
  }

  get look(): Vec {
    return { x: this.lookX.value, y: this.lookY.value }
  }

  private addOverlay(b: Behavior) {
    if (!b.back && !b.front) return
    const alpha = new Spring(0, 90, 19)
    alpha.target = 1
    this.overlays.push({ b, t: 0, alpha, dying: false })
  }

  private fadeOverlay(b: Behavior) {
    for (const o of this.overlays) {
      if (o.b === b && !o.dying) {
        o.dying = true
        o.alpha.target = 0
      }
    }
  }

  /** Default eyes for this character, for tooling. */
  static get defaultEyes(): Eyes {
    return { ...DEFAULT_EYES }
  }
}
