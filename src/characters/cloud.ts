import { UNIVERSAL, at, doneBadge, errorBadge, every, sparkles, variant } from '../engine/behaviors'
import { blip, chime, note, patter, whoosh } from '../engine/sound'
import { TAU, clamp } from '../engine/math'
import { scallop, transform } from '../engine/shapes'
import type { Actor } from '../engine/actor'
import type { CharacterDef, RenderCtx } from '../engine/types'
import { label, physics, pickAccessories } from './kit'

const rest = () => scallop(11, 0.1)

function rain(a: Actor, heavy = false) {
  const c = a.bodyCenter()
  a.emit({
    kind: 'rain',
    x: c.x + (a.rand() - 0.5) * 1.4,
    y: c.y + 0.6,
    vy: heavy ? 6 : 4,
    ay: 4,
    life: 0.9,
    size: 0.08,
    color: '#4dabf7',
    back: true,
    lands: true
  })
}

function bolt(r: RenderCtx, t: number, alpha: number) {
  const flash = (t > 0.45 && t < 0.62) || (t > 0.8 && t < 0.9)
  if (!flash) return
  const { g, R, bx, by } = r
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = '#ffd43b'
  g.strokeStyle = '#141414'
  g.lineWidth = Math.max(1, R * 0.04)
  g.lineJoin = 'round'
  const x = bx + R * 0.1
  const y = by + R * 0.75
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(x - R * 0.26, y + R * 0.55)
  g.lineTo(x - R * 0.04, y + R * 0.52)
  g.lineTo(x - R * 0.2, y + R * 1.02)
  g.lineTo(x + R * 0.22, y + R * 0.38)
  g.lineTo(x + R * 0.0, y + R * 0.41)
  g.lineTo(x + R * 0.14, y)
  g.closePath()
  g.fill()
  g.stroke()
  g.restore()
}

function sun(r: RenderCtx, t: number, alpha: number) {
  const { g, R, cx, cy } = r
  const x = cx + R * 1.35
  const y = cy - R * 1.55
  g.save()
  g.globalAlpha = alpha
  g.translate(x, y)
  g.rotate(t * 0.5)
  g.strokeStyle = '#fab005'
  g.lineWidth = R * 0.05
  g.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    g.rotate(TAU / 8)
    g.beginPath()
    g.moveTo(R * 0.3, 0)
    g.lineTo(R * 0.42, 0)
    g.stroke()
  }
  g.fillStyle = '#ffd43b'
  g.beginPath()
  g.arc(0, 0, R * 0.22, 0, TAU)
  g.fill()
  g.restore()
}

export const cloud: CharacterDef = {
  id: 'cloud',
  // a puff of air, rain on a window, a far-off rumble
  sounds: {
    hello: (s) => {
      whoosh(s, 600, 1600, 0.25, 0.1)
      blip(s, note(79), note(84), 0.12, 0.08, 0.05)
    },
    tap: (s) => {
      s.noise({ dur: 0.14, gain: 0.14, type: 'lowpass', f: 900, to: 400 })
      blip(s, 520, 380, 0.07, 0.06)
    },
    rain: (s) => {
      patter(s, 42, 2.3, 4200, 0.05, 0.3, 7)
      s.noise({ dur: 2.4, gain: 0.03, at: 0.3, type: 'highpass', f: 5000, attack: 0.5 })
    },
    thunder: (s) => {
      s.noise({ dur: 0.08, gain: 0.22, at: 0.45, type: 'highpass', f: 2500 })
      s.noise({ dur: 1.6, gain: 0.38, at: 0.47, type: 'lowpass', f: 220, to: 70, q: 0.7, attack: 0.05 })
      patter(s, 20, 0.9, 4200, 0.05, 0.5, 3)
    },
    poof: (s) => {
      whoosh(s, 300, 2500, 0.4, 0.14, 0.25)
      blip(s, 600, 900, 0.1, 0.08, 1.4)
    },
    drift: (s) => whoosh(s, 700, 300, 1.6, 0.06, 0.2),
    sunbathe: (s) => chime(s, [72, 76, 79], 0.12, 0.07, 0.2, 1.1),
    tidy: (s) => {
      for (let i = 0; i < 4; i++) s.noise({ dur: 0.16, gain: 0.06, at: i * 0.3, type: 'bandpass', f: 2500, to: 1200, q: 1.5 })
    },
    done: (s) => {
      whoosh(s, 600, 1400, 0.2, 0.06)
      chime(s, [76, 79, 84], 0.08, 0.1, 0.05)
    },
    error: (s) => {
      patter(s, 14, 1.2, 4000, 0.05, 0.2, 2)
      s.tone({ f: note(67), to: note(62), dur: 0.5, gain: 0.07, type: 'triangle' })
    }
  },
  name: label('Puff', '小云'),
  material: label('Cloud', '云'),
  tagline: label('A small cloud that tidies up after you.', '一朵帮你收拾房间的小云。'),
  bio: label(
    "Puff floats a little above everything. It rains when it's sad, rumbles when it's cross, and drifts off when nobody is watching. Give it a job and it gets oddly serious about it.",
    '小云总是比别的东西飘高一点。难过会下雨，生气会打雷，没人看着就慢慢飘走。交给它一件事，它会认真得有点过头。'
  ),
  traits: { en: ['Floats', 'Weather = mood', 'Drifts off'], zh: ['会飘', '心情写在天气上', '一不留神就飘走'] },
  origin: label('OneTidy', 'OneTidy 收纳 App'),
  physics: physics({
    floaty: true,
    hover: 0.32,
    gravity: 0,
    hopPower: 2.6,
    morphStiffness: 95,
    morphDamping: 11,
    softStiffness: 150,
    softDamping: 9,
    softSmoothing: 140,
    squashiness: 0.8,
    eyeStiffness: 170,
    wobble: 0.006,
    breath: 0.03,
    stretch: 0.5
  }),
  eyes: { w: 0.13, h: 0.21, corner: 1, spacing: 0.42, lift: 0.02, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.075,
  rest,
  shapes: {
    wide: () => transform(rest(), 1.22, 0.76, 0, 0.18),
    tall: () => transform(rest(), 0.84, 1.22, 0, -0.18),
    puddle: () => transform(rest(), 1.45, 0.5, 0, 0.45)
  },
  palettes: [
    { id: 'sky', body: '#ffffff', eye: '#141414', outline: '#141414', accent: '#4dabf7', mark: '#141414' },
    { id: 'peach', body: '#ffe3d6', eye: '#141414', outline: '#141414', accent: '#ff922b', mark: '#141414' },
    { id: 'mint', body: '#e3fafc', eye: '#141414', outline: '#141414', accent: '#20c997', mark: '#141414' },
    { id: 'lavender', body: '#f1ebff', eye: '#141414', outline: '#141414', accent: '#845ef7', mark: '#141414' },
    { id: 'sunset', body: '#fff3bf', eye: '#141414', outline: '#141414', accent: '#f76707', mark: '#141414' }
  ],
  accessories: pickAccessories('bow', 'flower', 'sprout', 'crown'),
  actions: {
    thinking: variant('thinking', {
      enter(a) {
        UNIVERSAL.thinking.enter?.(a, false)
        a.hover.target = 0.5
      },
      tick(a, t, dt) {
        a.lean.target = Math.sin(t * 1.1) * 0.08
        if (every(t, dt, 0.9, 0.4)) {
          const c = a.bodyCenter()
          a.emit({ kind: 'puff', x: c.x + 0.8, y: c.y - 0.85, vx: 0.15, vy: -0.45, life: 1.6, size: 0.1, grow: 0.05, color: a.palette.outline ?? '#141414' })
        }
      },
      front: undefined
    }),
    working: variant('working', {
      enter(a) {
        a.express('focused')
        a.lookAt(0, 1)
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 1.8) * 0.45
        a.lean.target = Math.cos(t * 1.8) * 0.12
        if (every(t, dt, 0.3)) {
          const c = a.bodyCenter()
          a.emit({ kind: 'dust', x: c.x + (a.rand() - 0.5) * 1.2, y: 1, vx: (a.rand() - 0.5) * 1.4, vy: -0.6, drag: 1.5, life: 0.8, size: 0.05, color: '#ced4da' })
        }
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('happy')
        a.hover.target = 0.6
        a.spinBy(1)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) sparkles(a, 8, '#ffd43b')
      },
      back: sun,
      front: doneBadge
    }),
    error: variant('error', {
      enter(a) {
        a.express('sad')
        a.tintColor = '#adb5bd'
        a.tint.target = 0.6
        a.hover.target = 0.42
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.08, 0.2) && t < 1.4) rain(a)
      },
      front: errorBadge
    }),
    sleep: {
      ...UNIVERSAL.sleep,
      enter(a) {
        a.express('closed')
        a.hover.target = 0.08
        a.morph('wide')
      },
      tick(a, t) {
        a.scale.target = 1 + Math.sin(t * 1.4) * 0.025
      }
    },
    rain: {
      kind: 'once',
      duration: 3.2,
      label: label('Rain', '下雨'),
      enter(a) {
        a.express('sad')
        a.tintColor = '#adb5bd'
        a.tint.target = 0.55
        a.hover.target = 0.42
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.07, 0.3) && t < 2.6) rain(a)
        if (at(t, dt, 2.6)) a.express('soft')
      }
    },
    thunder: {
      kind: 'once',
      duration: 2,
      label: label('Thunder', '打雷'),
      enter(a) {
        a.express('angry')
        a.tintColor = '#495057'
        a.tint.target = 0.75
        a.scale.target = 1.08
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.45)) a.shake(0.06, 34, 2.4)
        if (every(t, dt, 0.05, 0.45) && t < 1.4) rain(a, true)
      },
      front: bolt
    },
    poof: {
      kind: 'once',
      duration: 2.6,
      label: label('Poof', '散开'),
      enter(a) {
        a.express('surprised')
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.3)) {
          a.scale.target = 0.2
          const c = a.bodyCenter()
          for (let i = 0; i < 9; i++) {
            const ang = (i / 9) * TAU + a.rand() * 0.3
            a.emit({
              kind: 'puff',
              x: c.x + Math.cos(ang) * 0.5,
              y: c.y + Math.sin(ang) * 0.5,
              vx: Math.cos(ang) * 2.2,
              vy: Math.sin(ang) * 2.2,
              drag: 2.6,
              life: 1.5,
              size: 0.18 + a.rand() * 0.12,
              grow: -0.08,
              color: a.palette.outline ?? '#141414'
            })
          }
        }
        if (at(t, dt, 1.4)) {
          a.scale.target = 1
          a.express('happy')
        }
      }
    },
    drift: {
      kind: 'once',
      duration: 3.6,
      label: label('Drift away', '飘走'),
      enter(a) {
        a.express('soft')
      },
      tick(a, t) {
        const k = clamp(t / 1.6) - clamp((t - 2) / 1.4)
        a.rootX.target = k * 0.9
        a.lean.target = k * 0.18 * (t < 2 ? 1 : -1)
        a.lookAt(t < 2 ? 1 : -1, 0)
        a.hover.target = 0.32 + k * 0.25
        if (t > 2) a.express('surprised')
      }
    },
    sunbathe: {
      kind: 'once',
      duration: 3,
      label: label('Sunbathe', '晒太阳'),
      enter(a) {
        a.express({ ...{ w: 1.05, h: 0.75, corner: 1, bottomLid: 0.55 } })
        a.lookAt(0.8, -0.8)
      },
      tick(a, t, dt) {
        a.scale.target = 1 - clamp(t / 2) * 0.16
        if (every(t, dt, 0.5, 0.8)) {
          const c = a.bodyCenter()
          a.emit({ kind: 'smoke', x: c.x + (a.rand() - 0.5), y: c.y - 0.8, vy: -0.8, life: 1, size: 0.08, grow: 0.12, color: '#ced4da' })
        }
      },
      back: sun
    },
    tidy: {
      kind: 'loop',
      label: label('Tidying', '收拾'),
      enter(a) {
        a.express('focused')
        a.lookAt(0, 1)
      },
      tick(a, t, dt) {
        a.rootX.target = Math.sin(t * 1.8) * 0.45
        a.lean.target = Math.cos(t * 1.8) * 0.12
        if (every(t, dt, 0.3)) {
          const c = a.bodyCenter()
          a.emit({ kind: 'dust', x: c.x + (a.rand() - 0.5) * 1.2, y: 1, vx: (a.rand() - 0.5) * 1.4, vy: -0.6, drag: 1.5, life: 0.8, size: 0.05, color: '#ced4da' })
        }
      }
    }
  },
  signature: ['rain', 'thunder', 'poof', 'drift', 'sunbathe', 'tidy'],
  fidgets: ['drift', 'look-around', 'wiggle', 'yawn', 'bounce']
}
