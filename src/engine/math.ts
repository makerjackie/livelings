export interface Vec {
  x: number
  y: number
}

export const TAU = Math.PI * 2

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (t: number) => {
  const k = clamp(t)
  return k * k * (3 - 2 * k)
}

/** 32-bit string hash (FNV-1a), used to turn seeds into numbers. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32). Same seed, same sequence. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth, looping 1D noise from a few incommensurate sines: cheap and stateless. */
export function wander(t: number, period: number, phase: number): number {
  const w = TAU / period
  return (Math.sin(t * w + phase) * 0.6 + Math.sin(t * w * 2.37 + phase * 1.7) * 0.3 + Math.sin(t * w * 4.11 + phase * 0.3) * 0.1)
}

/**
 * Damped spring for one value. Semi-implicit Euler, stepped at a fixed dt by
 * the actor, so it is stable and deterministic. Changing `target` never jumps
 * the value: position and velocity stay continuous, which is what keeps every
 * state change smooth however it interrupts the last one.
 */
export class Spring {
  value: number
  velocity = 0
  target: number

  constructor(
    value: number,
    public stiffness = 170,
    public damping = 22
  ) {
    this.value = value
    this.target = value
  }

  step(dt: number) {
    this.velocity += ((this.target - this.value) * this.stiffness - this.velocity * this.damping) * dt
    this.value += this.velocity * dt
  }

  snap(value: number) {
    this.value = value
    this.target = value
    this.velocity = 0
  }
}

export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * clamp(t)))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const v = parseInt(h, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${clamp(alpha)})`
}
