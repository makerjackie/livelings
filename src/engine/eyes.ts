import { lerp } from './math'

/**
 * Eye geometry, in face-radius units. Rounded rectangles whose top and bottom
 * can be cut away ("lids") to make arcs, lines and squints. Every field is
 * continuous, so any expression springs into any other.
 */
export interface Eyes {
  w: number
  h: number
  /** 0 = square corners, 1 = fully round */
  corner: number
  /** distance between the two eye centres */
  spacing: number
  /** eye line above the face centre */
  lift: number
  /** fraction of the eye hidden from the top (1 = closed) */
  topLid: number
  /** happy arcs: an elliptical bite from below */
  bottomLid: number
  /** radians, mirrored per eye (positive = outer corners up) */
  tilt: number
  /** slope of the top lid, mirrored: positive = angry (inner side down), negative = sad */
  slant: number
  /** right eye grows by this fraction (curious, skeptical) */
  asym: number
}

export const EYE_KEYS: Array<keyof Eyes> = ['w', 'h', 'corner', 'spacing', 'lift', 'topLid', 'bottomLid', 'tilt', 'slant', 'asym']

export const DEFAULT_EYES: Eyes = {
  w: 0.23,
  h: 0.34,
  corner: 0.55,
  spacing: 0.56,
  lift: 0.08,
  topLid: 0,
  bottomLid: 0,
  tilt: 0,
  slant: 0,
  asym: 0
}

/**
 * An expression changes a character's own eyes rather than replacing them:
 * `w` and `h` are multipliers, the rest are absolute values. So Puff's tiny
 * dots and Inky's tall capsules both get a readable "happy".
 */
export type Expression = Partial<Eyes>

export const EXPRESSIONS = {
  neutral: {},
  happy: { w: 1.05, h: 0.75, corner: 1, bottomLid: 0.55 },
  excited: { w: 1.05, h: 1.15, corner: 0.7, lift: 0.13 },
  proud: { w: 1.1, h: 0.6, corner: 1, lift: 0.12, bottomLid: 0.6, tilt: -0.15 },
  sleepy: { w: 1.1, h: 0.6, corner: 1, lift: 0.02, topLid: 0.78 },
  closed: { w: 1.15, h: 0.5, corner: 1, topLid: 0.9 },
  curious: { w: 0.9, h: 0.95, asym: 0.35 },
  surprised: { w: 1.1, h: 0.75, corner: 1, spacing: 0.6, lift: 0.13 },
  shy: { w: 0.8, h: 0.65, corner: 0.7, spacing: 0.46, lift: -0.04, bottomLid: 0.35 },
  focused: { w: 1.1, h: 0.42, corner: 0.5, topLid: 0.1 },
  soft: { w: 0.95, h: 0.78, corner: 0.8, topLid: 0.3, tilt: 0.12 },
  sad: { w: 0.95, h: 0.9, corner: 0.8, lift: 0.0, topLid: 0.32, slant: -0.55 },
  worried: { w: 0.95, h: 1, corner: 0.75, topLid: 0.18, slant: -0.4, lift: 0.1 },
  angry: { w: 1.08, h: 0.85, corner: 0.6, topLid: 0.34, slant: 0.7 },
  dizzy: { w: 1, h: 1, corner: 1, asym: -0.3, tilt: 0.3 },
  wink: { w: 1.05, h: 0.9, asym: 0 }
} satisfies Record<string, Expression>

export type ExpressionName = keyof typeof EXPRESSIONS

export function resolveEyes(base: Eyes, expr: Expression): Eyes {
  return {
    w: base.w * (expr.w ?? 1),
    h: base.h * (expr.h ?? 1),
    corner: expr.corner ?? base.corner,
    spacing: expr.spacing !== undefined ? base.spacing * (expr.spacing / DEFAULT_EYES.spacing) : base.spacing,
    lift: expr.lift ?? base.lift,
    topLid: expr.topLid ?? base.topLid,
    bottomLid: expr.bottomLid ?? base.bottomLid,
    tilt: expr.tilt ?? base.tilt,
    slant: expr.slant ?? base.slant,
    asym: expr.asym ?? base.asym
  }
}

export function lerpEyes(a: Eyes, b: Eyes, t: number): Eyes {
  const out = { ...a }
  for (const k of EYE_KEYS) out[k] = lerp(a[k], b[k], t)
  return out
}
