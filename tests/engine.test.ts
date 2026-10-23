import { describe, expect, it } from 'vitest'
import { Actor, STEP } from '../src/engine/actor'
import { EYE_KEYS } from '../src/engine/eyes'
import { FAMILY } from '../src/characters'
const EVERYONE = FAMILY

function snapshot(a: Actor) {
  return {
    pts: a.base.map((p, i) => ({ x: p.x + a.off[i].x, y: p.y + a.off[i].y })),
    eyes: { ...a.eyes },
    height: a.height,
    x: a.rootX.value,
    scale: a.scale.value
  }
}

/** Largest movement of any outline point, eye parameter or root value in one fixed step. */
function stepDelta(a: Actor): number {
  const before = snapshot(a)
  a.advance(STEP)
  const after = snapshot(a)
  let d = 0
  for (let i = 0; i < before.pts.length; i++) {
    d = Math.max(d, Math.hypot(after.pts[i].x - before.pts[i].x, after.pts[i].y - before.pts[i].y))
  }
  for (const k of EYE_KEYS) d = Math.max(d, Math.abs(after.eyes[k] - before.eyes[k]))
  d = Math.max(d, Math.abs(after.height - before.height), Math.abs(after.x - before.x), Math.abs(after.scale - before.scale))
  return d
}

function finite(a: Actor) {
  const s = snapshot(a)
  const values = [...s.pts.flatMap((p) => [p.x, p.y]), ...Object.values(s.eyes), s.height, s.x, s.scale]
  return values.every(Number.isFinite)
}

describe('family', () => {
  it('every character has its own signature actions', () => {
    expect(FAMILY.map((c) => c.id)).toEqual(['cloud', 'inky', 'dice', 'ghost', 'duck', 'blocks', 'moon'])
    for (const c of EVERYONE) {
      expect(c.signature.length).toBeGreaterThanOrEqual(4)
      const known = new Actor(c).behaviors
      for (const id of [...c.signature, ...c.fidgets]) expect(id in known, `${c.id}:${id}`).toBe(true)
    }
  })

  it('every action of every character runs to completion without NaN', () => {
    for (const def of EVERYONE) {
      const a = new Actor(def, { fidget: false })
      for (const id of Object.keys(a.behaviors)) {
        a.play(id)
        for (let i = 0; i < 120 * 4; i++) a.advance(STEP)
        expect(finite(a), `${def.id}:${id}`).toBe(true)
      }
    }
  })
})

describe('determinism', () => {
  it('same seed and same input timeline give the same frames', () => {
    const run = () => {
      const a = new Actor(FAMILY[0], { seed: 'ada' })
      const script: Array<[number, string]> = [[30, 'thinking'], [200, 'done'], [260, 'working'], [400, 'error'], [420, 'celebrate']]
      for (let i = 0; i < 700; i++) {
        for (const [at, id] of script) if (at === i) a.play(id)
        a.advance(STEP)
      }
      return snapshot(a)
    }
    expect(run()).toEqual(run())
  })

  it('the seed picks palettes and accessories, and no seed gives the signature look', () => {
    for (const def of FAMILY) {
      const plain = new Actor(def)
      expect(plain.palette.id).toBe(def.palettes[0].id)
      expect(plain.accessory).toBeNull()
    }
    const looks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => new Actor(FAMILY[0], { seed: s }).palette.id))
    expect(looks.size).toBeGreaterThan(2)
  })
})

describe('transitions', () => {
  it('switching state at any moment never teleports anything', () => {
    for (const def of EVERYONE) {
      const a = new Actor(def, { seed: 'x', fidget: false })
      const ids = Object.keys(a.behaviors)
      let worstSwitch = 0
      let worstSteady = 0
      let k = 7
      for (let step = 0; step < 120 * 30; step++) {
        // pseudo-random interruptions, often landing mid-transition
        if (step % (17 + (k % 41)) === 0) {
          k = (k * 1103515245 + 12345) % 2147483647
          a.play(ids[k % ids.length])
          worstSwitch = Math.max(worstSwitch, stepDelta(a))
        } else worstSteady = Math.max(worstSteady, stepDelta(a))
      }
      console.log(`${def.id}: worst step after a switch ${worstSwitch.toFixed(4)}, during play ${worstSteady.toFixed(4)}`)
      // the step right after a switch is no bigger than ordinary motion
      expect(worstSwitch, def.id).toBeLessThanOrEqual(Math.max(worstSteady, 0.05) * 1.05)
      // and nothing moves more than a quarter of a body radius in 1/120 s
      expect(worstSteady, def.id).toBeLessThan(0.25)
    }
  })

  it('soft bodies dent smoothly instead of growing spikes', () => {
    // second difference of the dents around the outline: large = a jagged edge
    const roughness = (a: Actor) => {
      const n = a.off.length
      let worst = 0
      for (let i = 0; i < n; i++) {
        const p = a.off[(i - 1 + n) % n]
        const q = a.off[i]
        const r = a.off[(i + 1) % n]
        worst = Math.max(worst, Math.hypot(p.x - 2 * q.x + r.x, p.y - 2 * q.y + r.y))
      }
      return worst
    }
    for (const def of EVERYONE) {
      const a = new Actor(def, { fidget: false })
      let worst = 0
      for (let k = 0; k < 6; k++) {
        a.poke(1.4)
        a.jiggle(1.4)
        a.hop(1.2)
        for (let i = 0; i < 90; i++) {
          a.advance(STEP)
          worst = Math.max(worst, roughness(a))
        }
      }
      expect(worst, def.id).toBeLessThan(0.02)
    }
  })

  it('a held shape survives state changes, then lets go', () => {
    const a = new Actor(FAMILY[0], { fidget: false })
    a.holdShape('star', 1)
    a.play('hello')
    a.play('excited')
    for (let i = 0; i < 60; i++) a.advance(STEP)
    const spread = (x: Actor) => Math.max(...x.base.map((p) => Math.hypot(p.x, p.y))) - Math.min(...x.base.map((p) => Math.hypot(p.x, p.y)))
    expect(spread(a)).toBeGreaterThan(0.3) // still a star, not the rest circle
    for (let i = 0; i < 240; i++) a.advance(STEP)
    expect(spread(a)).toBeLessThan(0.3)
  })

  it('a one-shot hands control back to the running loop', () => {
    const a = new Actor(FAMILY[0], { fidget: false })
    a.play('working')
    a.play('done')
    expect(a.state).toBe('done')
    for (let i = 0; i < 120 * 3; i++) a.advance(STEP)
    expect(a.state).toBe('working')
  })
})
