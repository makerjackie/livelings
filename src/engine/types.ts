import type { Actor } from './actor'
import type { Eyes } from './eyes'
import type { Vec } from './math'
import type { Shape } from './shapes'

export interface Text {
  en: string
  zh: string
}

/** How a material moves. All numbers are per second in body-radius units. */
export interface Physics {
  /** shape morph springs: higher = snappier, lower damping = more jelly overshoot */
  morphStiffness: number
  morphDamping: number
  /** soft-body dents (pokes, drags, landings) */
  softStiffness: number
  softDamping: number
  /** how strongly neighbouring outline points pull each other smooth */
  softSmoothing: number
  gravity: number
  hopPower: number
  /** fraction of landing speed kept as a bounce (jelly bounces, ink does not) */
  bounce: number
  squashiness: number
  squashStiffness: number
  squashDamping: number
  /** hovers instead of standing on the ground */
  floaty: boolean
  hover: number
  eyeStiffness: number
  /** constant idle jiggle of the outline */
  wobble: number
  breath: number
  /** how far a drag can pull one point of the outline */
  stretch: number
  /** rocks side to side while airborne, like a sheet of paper falling */
  flutter: number
}

export interface Palette {
  id: string
  body: string
  eye: string
  accent: string
  outline?: string
  /** a second body tone (flame core, jelly shine, mochi powder) */
  core?: string
  cheek?: string
  /** colour for marks drawn around the body (dots, z's); defaults to `body` */
  mark?: string
}

export interface RenderCtx {
  g: CanvasRenderingContext2D
  actor: Actor
  /** pixels per body-radius unit */
  R: number
  /** rest body centre, in pixels */
  cx: number
  cy: number
  /** current body centre after hops, shakes and squash, in pixels */
  bx: number
  by: number
  palette: Palette
  /** current outline in pixels */
  outline: Vec[]
  bodyPath: Path2D
  /** face centre and face unit, in pixels */
  face: { x: number; y: number; u: number } | null
  time: number
  /** body-space point (rest radius 1) to pixels, with the current hop, squash, spin and lean */
  toPx(x: number, y: number): Vec
  /** current outline bounds, in pixels */
  box: { x: number; y: number; w: number; h: number }
}

export interface Behavior {
  kind: 'loop' | 'once'
  /** seconds, for `once` */
  duration?: number
  label?: Text
  /** `resumed` is true when a one-shot hands control back to this loop */
  enter?(a: Actor, resumed: boolean): void
  tick?(a: Actor, t: number, dt: number): void
  /** drawn behind the body; fades in and out with the behaviour */
  back?(r: RenderCtx, t: number, alpha: number): void
  /** drawn in front of the body */
  front?(r: RenderCtx, t: number, alpha: number): void
}

export interface Accessory {
  id: string
  label: Text
  draw(r: RenderCtx, top: Vec, angle: number): void
}

export interface CharacterDef {
  id: string
  name: Text
  material: Text
  tagline: Text
  bio: Text
  traits: { en: string[]; zh: string[] }
  /** where this character first lived, if anywhere */
  origin?: Text
  physics: Physics
  eyes: Eyes
  /** `hole`: eyes are cut out of the body; `ink`: eyes are painted in `palette.eye` */
  eyeMode: 'hole' | 'ink'
  /** outline stroke width in body-radius units (Puff's ink line) */
  outlineWidth?: number
  /** straight edges between outline points instead of a smooth curve (paper, pixels) */
  straight?: boolean
  /** grow the body around a face that barely fits (default true; off for hard-edged bodies) */
  thicken?: boolean
  /** render as pixel art: `cells` pixels across the body, redrawn `fps` times a second */
  pixel?: { cells: number; fps: number; colors?: string[] }
  /** drops thrown sideways on a hard landing (default true) */
  splash?: boolean
  /** glossy highlight in ink eyes, 0 to 1 */
  eyeShine?: number
  /** the character's own effect springs, read with `actor.fx(name)` */
  effects?: Record<string, { rest: number; stiffness?: number; damping?: number }>
  rest(): Shape
  /** this character's take on shared shape names ('wide', 'tall', 'puddle'...) */
  shapes?: Record<string, () => Shape>
  palettes: Palette[]
  accessories?: Accessory[]
  /** resting fur amount (0 = none) */
  fur?: number
  sheen?: number
  /** render-time outline deformation (a flame's flicker) */
  outlineMod?(pts: Vec[], t: number, a: Actor): void
  /** extra painting inside the body (clipped), e.g. a flame's hot core */
  paintBody?(r: RenderCtx): void
  /** painting behind the body */
  paintBack?(r: RenderCtx): void
  /** painting over the body and eyes, not clipped (marker strokes, glints) */
  paintFace?(r: RenderCtx): void
  /** draws the whole face instead of the standard eyes (a die's pips) */
  drawFace?(r: RenderCtx): void
  /** where the face sits on the rest shape, instead of the largest circle that fits */
  face?: { x: number; y: number; r: number }
  /** runs every simulation step, whatever the state (watching for the pointer leaving) */
  update?(a: Actor, dt: number): void
  /**
   * The character's own answer to being touched. Each returns true when it
   * handled the moment, replacing the shared reaction.
   */
  react?: {
    tap?(a: Actor, count: number): boolean
    startle?(a: Actor, dx: number): boolean
    purr?(a: Actor): boolean
    giggle?(a: Actor): boolean
    /** the pointer came back after being away for `away` seconds */
    arrive?(a: Actor, away: number): void
  }
  actions: Record<string, Behavior>
  /** this character's own actions, in display order */
  signature: string[]
  /** small idle moves played now and then while idle */
  fidgets: string[]
}

export interface ParticleSpec {
  kind: 'drop' | 'rain' | 'spark' | 'smoke' | 'puff' | 'z' | 'heart' | 'note' | 'flake' | 'bubble' | 'glyph' | 'dust' | 'star' | 'bead' | 'coin' | 'square'
  x: number
  y: number
  vx?: number
  vy?: number
  ax?: number
  ay?: number
  drag?: number
  life: number
  size: number
  grow?: number
  color?: string
  rot?: number
  vrot?: number
  glyph?: string
  back?: boolean
  /** lands and flattens on the ground instead of falling through */
  lands?: boolean
}

export interface Particle extends Required<Omit<ParticleSpec, 'glyph' | 'color'>> {
  glyph: string
  color: string
  age: number
  landed: boolean
}
