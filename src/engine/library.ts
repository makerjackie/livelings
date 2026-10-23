import * as S from './shapes'
import type { Shape } from './shapes'

const cache = new Map<string, Shape>()

const builders: Record<string, () => Shape> = {
  circle: () => S.circle(),
  pebble: S.pebble,
  squircle: () => S.squircle(),
  droplet: () => S.droplet(),
  flame: () => S.flame(),
  puddle: () => S.puddle(),
  egg: S.egg,
  star: () => S.star(),
  heart: S.heart,
  moon: S.moon,
  tall: () => S.transform(S.circle(), 0.78, 1.28, 0, -0.28),
  wide: () => S.transform(S.circle(), 1.3, 0.74, 0, 0.26),
  pancake: () => S.transform(S.pebble(), 1.55, 0.5, 0, 0.5),
  tiny: () => S.transform(S.circle(), 0.42, 0.42, 0, 0.58),
  bean: () => S.polar((a) => 1 + 0.12 * Math.cos(2 * a) - 0.1 * Math.sin(a)).map((p) => ({ x: p.x * 0.9, y: p.y * 1.02 }))
}

/**
 * Shared silhouettes by name. `text:…` traces any glyph ("text:3", "text:!",
 * "text:♪"). Results are cached, and the same array is returned each time, so
 * the actor can recognise a target it already has.
 */
export function named(key: string): Shape {
  let s = cache.get(key)
  if (s) return s
  if (key.startsWith('text:')) s = S.fromText(key.slice(5))
  else s = (builders[key] ?? builders.circle)()
  cache.set(key, s)
  return s
}
