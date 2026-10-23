import { at, every, floatGlyph, sparkles, thoughtDots, variant, zzz } from '../engine/behaviors'
import { blip, chime, whoosh } from '../engine/sound'
import { clamp, type Vec } from '../engine/math'
import { resample } from '../engine/shapes'
import type { Actor } from '../engine/actor'
import type { CharacterDef } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

/** A sheet with a round top and a wavy hem. */
const sheet = () => {
  const pts: Vec[] = []
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (i / 40) * Math.PI
    pts.push({ x: Math.cos(a) * 0.82, y: Math.sin(a) * 0.86 - 0.08 })
  }
  pts.push({ x: 0.84, y: 0.3 })
  for (let i = 0; i <= 48; i++) {
    const x = 0.86 - (i / 48) * 1.72
    pts.push({ x, y: 0.82 - Math.abs(Math.sin((i / 48) * Math.PI * 3)) * 0.16 })
  }
  pts.push({ x: -0.84, y: 0.3 })
  return resample(pts)
}

/** The hem never stops rippling, as if there were a draught. */
function ripple(pts: Vec[], t: number, a: Actor) {
  const k = a.calm ? 0.4 : 1
  for (const p of pts) {
    const below = clamp((p.y - 0.25) / 0.6)
    if (below <= 0) continue
    p.x += Math.sin(p.y * 6 + t * 5) * 0.04 * below * k
    p.y += Math.sin(p.x * 7 - t * 6) * 0.05 * below * k
  }
}

const AWAY = 2.2
/** Scared off, or left alone (only once it has met a pointer, so touch screens still see it). */
const fading = (a: Actor) => a.time < (a.cues.hideUntil ?? -1) || (!!a.cues.seen && !a.pointerHere && a.time - a.pointerSince > AWAY)

/** Pops out at you: big eyes, a lunge, and a BOO. */
function boo(a: Actor) {
  a.fx('opacity').snap(1)
  a.flash('excited', 1.1)
  a.scale.velocity += 4
  a.hop(0.9)
  a.squish(-5)
  floatGlyph(a, 'BOO!', 'glyph', a.palette.mark ?? '#2b2d42', 0.3)
}

export const ghost: CharacterDef = {
  id: 'ghost',
  // a breathy wooo, air going the wrong way
  sounds: {
    hello: (s) => s.tone({ f: 380, to: 520, dur: 0.45, gain: 0.08, vibrato: [6, 14] }),
    tap: (s) => s.tone({ f: 620, to: 430, dur: 0.3, gain: 0.08, vibrato: [7, 10] }),
    boo: (s) => {
      whoosh(s, 300, 1800, 0.3, 0.12, 0.4)
      s.tone({ f: 260, to: 430, dur: 0.6, gain: 0.16, at: 0.45, type: 'sawtooth', filter: { type: 'lowpass', f: 1100 }, vibrato: [5, 18] })
    },
    vanish: (s) => {
      whoosh(s, 2400, 400, 0.9, 0.1)
      blip(s, 400, 800, 0.14, 0.08, 2.1)
    },
    phase: (s) => {
      whoosh(s, 500, 300, 1.0, 0.07, 0.3)
      blip(s, 500, 900, 0.1, 0.08, 1.4)
    },
    haunt: (s) => s.tone({ f: 440, to: 540, dur: 1.4, gain: 0.07, at: 0.6, vibrato: [5, 22] }),
    peekaboo: (s) => {
      blip(s, 500, 1000, 0.12, 0.12, 1.2)
      chime(s, [84, 88], 0.08, 0.08, 1.35)
    },
    done: (s) => chime(s, [79, 83, 86], 0.09, 0.08, 0, 0.8)
  },
  name: label('Boo', '飘飘'),
  material: label('Ghost', '幽灵'),
  tagline: label('Fades when you leave. Jumps out when you come back.', '你一走它就隐身，你一回来它就吓你。'),
  bio: label(
    'Boo is a little ghost that only half believes in you. Look away for a moment and it fades until only its eyes are left; come back and it jumps out with a BOO. Rush at it and it is the one that vanishes. It drifts through walls, and if you pull on it, it stretches into a wisp of smoke.',
    '飘飘是一只半信半疑的小幽灵。你一走开，它就慢慢隐身，只剩一双眼睛；你一回来，它就「哇」地扑出来吓你。你冲它冲得太快，反倒是它先吓得没影。它能穿墙，拽它一下会被拉成一缕烟。'
  ),
  traits: { en: ['Disappears when you leave', 'BOO!', 'Walks through walls'], zh: ['你走它就隐身', '突然吓人', '会穿墙'] },
  physics: physics({ floaty: true, hover: 0.34, hopPower: 2.6, softStiffness: 140, softDamping: 6, softSmoothing: 150, stretch: 1.7, squashiness: 1.2, wobble: 0.006 }),
  eyes: { w: 0.19, h: 0.3, corner: 1, spacing: 0.56, lift: 0.08, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.05,
  splash: false,
  rest: sheet,
  shapes: {
    tall: () => sheet().map((p) => ({ x: p.x * 0.78, y: p.y * 1.3 - 0.2 })),
    wide: () => sheet().map((p) => ({ x: p.x * 1.2, y: p.y * 0.76 + 0.18 }))
  },
  palettes: [
    { id: 'sheet', body: '#f8f9fa', eye: '#2b2d42', accent: '#b197fc', outline: '#2b2d42', mark: '#2b2d42' },
    { id: 'mint', body: '#d3f9d8', eye: '#163a1f', accent: '#69db7c', outline: '#163a1f', mark: '#163a1f' },
    { id: 'peach', body: '#ffe3e3', eye: '#4a1d1d', accent: '#ff8787', outline: '#4a1d1d', mark: '#4a1d1d' },
    { id: 'lilac', body: '#e5dbff', eye: '#2b1f4a', accent: '#9775fa', outline: '#2b1f4a', mark: '#2b1f4a' },
    { id: 'shadow', body: '#3b3f46', eye: '#ffffff', accent: '#ffd43b', outline: '#101113', mark: '#3b3f46' }
  ],
  accessories: pickAccessories('bow', 'tuft', 'cap'),
  effects: { opacity: { rest: 0.94, stiffness: 18, damping: 7 } },
  outlineMod: ripple,
  update(a) {
    // fade away when nobody is looking, or after a fright
    if (!a.onceId && a.loopId !== 'sleep') a.fx('opacity').target = fading(a) ? 0.06 : 0.94
  },
  react: {
    arrive(a, away) {
      if (a.cues.seen && away > AWAY && a.time > (a.cues.hideUntil ?? -1)) boo(a)
      a.cues.seen = 1
    },
    startle(a, dx) {
      // it is the one that gets scared: gone in a blink, then back
      a.cues.hideUntil = a.time + 1.4
      a.fx('opacity').target = 0.06
      a.flash('surprised', 1.4)
      a.rootX.velocity -= Math.sign(dx || 1) * 2
      return true
    },
    tap(a, n) {
      if (n >= 3) {
        a.cues.hideUntil = a.time + 1.2
        a.fx('opacity').target = 0.06
        a.flash('dizzy', 1.2)
        return true
      }
      a.flash('happy', 0.6)
      a.jiggle(0.8)
      a.hop(0.5)
      return true
    }
  },
  actions: {
    thinking: variant('thinking', {
      enter(a) {
        a.express('curious')
        a.lookAt(0.7, -0.9)
        a.hover.target = 0.55
      },
      tick(a, t) {
        a.lean.target = Math.sin(t * 1.2) * 0.12
      },
      front: thoughtDots
    }),
    working: variant('working', {
      // zips around in loops
      enter(a) {
        a.express('focused')
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 2.2) * 0.55
        a.hover.target = 0.34 + Math.sin(t * 4.4) * 0.12
        a.lean.target = Math.cos(t * 2.2) * 0.2
        if (every(t, dt, 0.25)) {
          const c = a.bodyCenter()
          a.emit({ kind: 'smoke', x: c.x - Math.cos(t * 2.2) * 0.6, y: c.y + 0.5, vy: 0.2, life: 0.7, size: 0.1, grow: 0.15, color: '#dee2e6', back: true })
        }
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        boo(a)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) sparkles(a, 8, a.palette.accent)
      },
      front: undefined
    }),
    error: variant('error', {
      enter(a) {
        a.express('sad')
      },
      tick(a, t) {
        // flickers like a bad signal
        a.fx('opacity').target = t < 1.3 && Math.sin(t * 40) > 0.2 ? 0.15 : 0.94
      }
    }),
    sleep: variant('sleep', {
      enter(a) {
        a.express('closed')
        a.morph('wide')
        a.hover.target = 0.12
        a.fx('opacity').target = 0.55
      },
      front: zzz
    }),
    boo: {
      kind: 'once',
      duration: 1.8,
      label: label('BOO!', '吓你一跳'),
      enter(a) {
        a.fx('opacity').snap(0.06)
        a.express('closed')
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.45)) boo(a)
      }
    },
    vanish: {
      kind: 'once',
      duration: 3,
      label: label('Vanish', '隐身'),
      enter(a) {
        a.express('shy')
        a.fx('opacity').target = 0.06
      },
      tick(a, t, dt) {
        if (t > 0.6 && t < 2) a.lookAt(Math.sin(t * 3), 0)
        if (at(t, dt, 2.1)) {
          a.fx('opacity').target = 0.94
          a.express('happy')
          a.lookFree()
        }
      }
    },
    phase: {
      kind: 'once',
      duration: 3.2,
      label: label('Through the wall', '穿墙'),
      enter(a) {
        a.express('excited')
        a.rootX.target = 1.9
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.4)) {
          a.rootX.target = 0
          a.express('happy')
        }
      }
    },
    haunt: {
      kind: 'once',
      duration: 3,
      label: label('Wooo', '呜~'),
      enter(a) {
        a.express('soft')
        floatGlyph(a, 'wooo', 'glyph', a.palette.mark ?? '#2b2d42', 0.26)
      },
      tick(a, t, dt) {
        a.rootX.target = t < 2.6 ? Math.sin(t * 2.4) * 0.4 : 0
        a.hover.target = 0.34 + Math.cos(t * 2.4) * 0.15
        a.fx('opacity').target = 0.5 + 0.44 * Math.abs(Math.cos(t * 1.6))
        if (at(t, dt, 1.4)) floatGlyph(a, 'wooo', 'glyph', a.palette.mark ?? '#2b2d42', 0.22)
      }
    },
    peekaboo: {
      kind: 'once',
      duration: 2.6,
      label: label('Peekaboo', '躲猫猫'),
      enter(a) {
        a.express('closed')
        a.hover.target = -0.9
      },
      tick(a, t, dt) {
        if (at(t, dt, 1.2)) {
          a.hover.target = 0.34
          a.express('excited')
        }
        if (at(t, dt, 1.5)) a.flash('happy', 0.8)
      }
    }
  },
  signature: ['boo', 'vanish', 'phase', 'haunt', 'peekaboo'],
  fidgets: ['haunt', 'peekaboo', 'look-around', 'wiggle']
}
