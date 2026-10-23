import type { Actor } from './actor'
import { TAU, clamp, withAlpha } from './math'
import { drawGlyph } from './text'
import type { Behavior, RenderCtx } from './types'

/* ----------------------------------------------------------- helpers */

/** Colour for marks drawn around a character (dots, z's, "!"), readable on light pages. */
export function markColor(r: RenderCtx): string {
  return r.palette.mark ?? r.palette.body
}

/** Fires `fn` once when local time `t` crosses `at`. */
export function at(t: number, dt: number, when: number): boolean {
  return t >= when && t - dt < when
}

/** Fires every `period` seconds (first at `offset`). */
export function every(t: number, dt: number, period: number, offset = 0): boolean {
  if (t < offset) return false
  const k = Math.floor((t - offset) / period)
  const prev = Math.floor((t - dt - offset) / period)
  return k !== prev || at(t, dt, offset)
}

export function sparkles(a: Actor, count = 8, color?: string, spread = 1) {
  const c = a.bodyCenter()
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (a.rand() - 0.5) * Math.PI * 1.6 * spread
    const speed = 2.2 + a.rand() * 2
    a.emit({
      kind: 'spark',
      x: c.x + Math.cos(ang) * 0.9,
      y: c.y + Math.sin(ang) * 0.9,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      drag: 3.2,
      life: 0.7 + a.rand() * 0.3,
      size: 0.09 + a.rand() * 0.06,
      color: color ?? a.palette.accent,
      rot: a.rand() * TAU,
      vrot: (a.rand() - 0.5) * 8
    })
  }
}

export function confetti(a: Actor, count = 22) {
  const colors = ['#ffd43b', '#ff6b6b', '#4dabf7', '#51cf66', '#cc5de8', a.palette.accent]
  const c = a.bodyCenter()
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (a.rand() - 0.5) * 2.4
    const speed = 3 + a.rand() * 3
    a.emit({
      kind: 'glyph',
      glyph: 'rect',
      x: c.x,
      y: c.y - 0.6,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ay: 7,
      drag: 1.6,
      life: 1.6 + a.rand() * 0.6,
      size: 0.1 + a.rand() * 0.05,
      color: colors[i % colors.length],
      rot: a.rand() * TAU,
      vrot: (a.rand() - 0.5) * 14
    })
  }
}

export function floatGlyph(a: Actor, glyph: string, kind: 'glyph' | 'heart' | 'note' = 'glyph', color?: string, size = 0.32) {
  const c = a.bodyCenter()
  a.emit({
    kind,
    glyph,
    x: c.x + 0.75 + a.rand() * 0.2,
    y: c.y - 0.9,
    vx: 0.25 + a.rand() * 0.2,
    vy: -0.9,
    drag: 0.6,
    life: 1.4,
    size,
    color,
    rot: (a.rand() - 0.5) * 0.4
  })
}

export function sweat(a: Actor) {
  const c = a.bodyCenter()
  a.emit({ kind: 'drop', x: c.x + 0.62, y: c.y - 0.55, vx: 0.4, vy: -0.6, ay: 6, life: 0.9, size: 0.09, color: '#74c0fc' })
}

export function steam(a: Actor, count = 3) {
  const c = a.bodyCenter()
  for (let i = 0; i < count; i++) {
    a.emit({
      kind: 'smoke',
      x: c.x + (a.rand() - 0.5) * 0.7,
      y: c.y - 1,
      vx: (a.rand() - 0.5) * 0.4,
      vy: -1.2 - a.rand() * 0.6,
      drag: 0.8,
      life: 1,
      size: 0.12,
      grow: 0.22,
      color: '#adb5bd'
    })
  }
}

/** Little dots that bob above-right of the head. */
export function thoughtDots(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  g.fillStyle = withAlpha(markColor(r), 0.85 * alpha)
  for (let i = 0; i < 3; i++) {
    const bob = Math.sin(t * 4.2 - i * 0.8) * R * 0.06
    const s = R * (0.07 + i * 0.035) * (0.6 + 0.4 * alpha)
    g.beginPath()
    g.arc(bx + R * (0.82 + i * 0.24), by - R * (0.95 + i * 0.22) + bob, s, 0, TAU)
    g.fill()
  }
  g.restore()
}

export function badge(r: RenderCtx, t: number, alpha: number, glyph: string, fill: string, ink: string) {
  const { g, R, bx, by } = r
  const pop = clamp(t / 0.25)
  const s = R * 0.3 * (pop < 1 ? 0.4 + pop * 0.75 : 1 + Math.sin(t * 5) * 0.04)
  const x = bx + R * 0.8
  const y = by - R * 0.92 + Math.sin(t * 3) * R * 0.03
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = fill
  g.beginPath()
  g.arc(x, y, s, 0, TAU)
  g.fill()
  g.fillStyle = ink
  g.strokeStyle = ink
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.lineWidth = s * 0.26
  if (glyph === '!') {
    g.beginPath()
    g.moveTo(x, y - s * 0.48)
    g.lineTo(x, y + s * 0.1)
    g.stroke()
    g.beginPath()
    g.arc(x, y + s * 0.45, s * 0.14, 0, TAU)
    g.fill()
  } else if (glyph === 'check') {
    const k = clamp((t - 0.15) / 0.3)
    g.beginPath()
    g.moveTo(x - s * 0.42, y + s * 0.02)
    const mx = x - s * 0.1
    const my = y + s * 0.32
    if (k < 0.4) g.lineTo(x - s * 0.42 + (mx - (x - s * 0.42)) * (k / 0.4), y + s * 0.02 + (my - y - s * 0.02) * (k / 0.4))
    else {
      g.lineTo(mx, my)
      const k2 = (k - 0.4) / 0.6
      g.lineTo(mx + (s * 0.5) * k2, my - s * 0.72 * k2)
    }
    g.stroke()
  } else if (glyph === 'x') {
    g.beginPath()
    g.moveTo(x - s * 0.32, y - s * 0.32)
    g.lineTo(x + s * 0.32, y + s * 0.32)
    g.moveTo(x + s * 0.32, y - s * 0.32)
    g.lineTo(x - s * 0.32, y + s * 0.32)
    g.stroke()
  }
  g.restore()
}

export function zzz(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  for (let i = 0; i < 3; i++) {
    const phase = ((t / 2.4 + i / 3) % 1 + 1) % 1
    g.globalAlpha = alpha * (phase < 0.15 ? phase / 0.15 : 1 - (phase - 0.15) / 0.85)
    const size = R * (0.22 + phase * 0.22)
    drawGlyph(g, 'z', bx + R * (0.7 + phase * 0.55 + Math.sin(phase * 6) * 0.06) + size * 0.3, by - R * (0.55 + phase * 0.95) - size * 0.3, size, markColor(r))
  }
  g.restore()
}

function orbiters(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  for (let i = 0; i < 2; i++) {
    const ang = t * 3.4 + i * Math.PI
    const x = bx + Math.cos(ang) * R * 1.42
    const y = by + Math.sin(ang) * R * 0.42 - R * 0.05
    const front = Math.sin(ang) > 0
    if (!front) continue
    g.globalAlpha = alpha
    g.fillStyle = r.palette.accent
    g.beginPath()
    g.arc(x, y, R * 0.09, 0, TAU)
    g.fill()
  }
  g.restore()
}

function orbitersBack(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  g.strokeStyle = withAlpha(markColor(r), 0.16 * alpha)
  g.lineWidth = Math.max(1, R * 0.025)
  g.beginPath()
  g.ellipse(bx, by - R * 0.05, R * 1.42, R * 0.42, 0, 0, TAU)
  g.stroke()
  for (let i = 0; i < 2; i++) {
    const ang = t * 3.4 + i * Math.PI
    if (Math.sin(ang) > 0) continue
    g.globalAlpha = alpha * 0.8
    g.fillStyle = r.palette.accent
    g.beginPath()
    g.arc(bx + Math.cos(ang) * R * 1.42, by + Math.sin(ang) * R * 0.42 - R * 0.05, R * 0.075, 0, TAU)
    g.fill()
  }
  g.restore()
}

function waves(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  g.strokeStyle = markColor(r)
  g.lineCap = 'round'
  g.lineWidth = Math.max(1.2, R * 0.06)
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.9 + i / 3) % 1 + 1) % 1
    g.globalAlpha = alpha * (1 - k) * 0.8
    g.beginPath()
    g.arc(bx - R * 1.0, by - R * 0.1, R * (0.25 + k * 0.5), -0.75 + Math.PI, 0.75 + Math.PI)
    g.stroke()
  }
  g.restore()
}

function typingDots(r: RenderCtx, t: number, alpha: number) {
  const { g, R, bx, by } = r
  g.save()
  for (let i = 0; i < 3; i++) {
    const k = Math.max(0, Math.sin(t * 5 - i * 0.9))
    g.globalAlpha = alpha * (0.35 + 0.65 * k)
    g.fillStyle = markColor(r)
    g.beginPath()
    g.arc(bx + R * (1.05 + i * 0.22), by - R * (0.35 + k * 0.08), R * 0.07, 0, TAU)
    g.fill()
  }
  g.restore()
}

function blush(r: RenderCtx, _t: number, alpha: number) {
  const { g } = r
  const f = r.actor
  if (!r.face) return
  g.save()
  g.globalAlpha = alpha * 0.55
  g.fillStyle = r.palette.cheek ?? '#ff8fab'
  const { x, y, u } = r.face
  for (const side of [-1, 1]) {
    g.beginPath()
    g.ellipse(x + side * (f.eyes.spacing / 2 + 0.12) * u, y + u * 0.28, u * 0.13, u * 0.07, 0, 0, TAU)
    g.fill()
  }
  g.restore()
}

export const doneBadge = (r: RenderCtx, t: number, alpha: number) => badge(r, t, alpha, 'check', '#51cf66', '#ffffff')
export const errorBadge = (r: RenderCtx, t: number, alpha: number) => badge(r, t, alpha, 'x', '#ff6b6b', '#ffffff')
export const helpBadge = (r: RenderCtx, t: number, alpha: number) => badge(r, t, alpha, '!', '#ffd43b', '#1a1a1a')

/** A character's own version of a shared action: same id, label and kind, its own motion. */
export function variant(id: string, over: Partial<Behavior>): Behavior {
  return { ...UNIVERSAL[id], ...over }
}

/* ------------------------------------------------------------ states */

const label = (en: string, zh: string) => ({ en, zh })

export const UNIVERSAL: Record<string, Behavior> = {
  idle: {
    kind: 'loop',
    label: label('Idle', '待机')
  },

  thinking: {
    kind: 'loop',
    label: label('Thinking', '思考'),
    enter(a) {
      a.express({ h: 0.86, topLid: 0.14, w: 0.95 })
      a.lookAt(0.7, -0.9)
    },
    tick(a, t, dt) {
      a.lean.target = Math.sin(t * 1.3) * 0.06
      if (every(t, dt, 2.6, 1.2)) a.squish(-1.5)
    },
    front: thoughtDots
  },

  working: {
    kind: 'loop',
    label: label('Working', '工作中'),
    enter(a, resumed) {
      a.express('focused')
      a.lean.target = 0.07
      a.lookAt(0.3, 0.6)
      if (!resumed) a.hop(0.35)
    },
    tick(a, t, dt) {
      if (every(t, dt, 0.42)) a.squish(2.2)
      a.rootX.target = Math.sin(t * 7) * 0.025
      if (every(t, dt, 1.1, 0.5)) sparkles(a, 2, undefined, 0.5)
    },
    back: orbitersBack,
    front: orbiters
  },

  waiting: {
    kind: 'loop',
    label: label('Waiting', '等待'),
    enter(a) {
      a.express('soft')
    },
    tick(a, t, dt) {
      const side = Math.floor(t / 2.2) % 2 === 0 ? -1 : 1
      a.lookAt(side * 0.8, 0.1)
      if (every(t, dt, 2.2, 1.0)) a.squish(2.5)
    },
    front: typingDots
  },

  blocked: {
    kind: 'loop',
    label: label('Needs help', '需要帮忙'),
    enter(a) {
      a.express('worried')
      a.hop(0.5)
      a.lookAt(0, 0.2)
    },
    tick(a, t, dt) {
      if (every(t, dt, 2.4, 2.4)) {
        a.hop(0.45)
        a.shake(0.04, 26, 3)
      }
      a.lean.target = Math.sin(t * 2) * 0.05
    },
    front: helpBadge
  },

  listening: {
    kind: 'loop',
    label: label('Listening', '聆听'),
    enter(a) {
      a.express({ w: 1.08, h: 1.08, lift: 0.1 })
      a.lean.target = -0.08
      a.lookAt(-0.6, -0.1)
    },
    tick(a, t, dt) {
      if (every(t, dt, 1.6)) a.squish(-1.2)
    },
    front: waves
  },

  sleep: {
    kind: 'loop',
    label: label('Sleeping', '睡觉'),
    enter(a) {
      a.express('closed')
      a.morph('wide')
      a.hover.target = a.def.physics.floaty ? a.def.physics.hover * 0.45 : 0
    },
    tick(a, t) {
      a.scale.target = 1 + Math.sin(t * 1.4) * 0.025
    },
    front: zzz
  },

  /* --------------------------------------------------------- one-shots */

  acknowledge: {
    kind: 'once',
    duration: 0.9,
    label: label('Got it', '收到'),
    enter(a) {
      a.express('surprised')
      a.hop(0.5)
      a.lookAt(0, 0.15)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.3)) a.express('happy')
    }
  },

  done: {
    kind: 'once',
    duration: 2,
    label: label('Done!', '完成'),
    enter(a) {
      a.express('proud')
      a.hop(1)
      a.spinBy(1)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.55)) sparkles(a, 10)
    },
    front: doneBadge
  },

  error: {
    kind: 'once',
    duration: 1.8,
    label: label('Error', '出错了'),
    enter(a) {
      a.express('sad')
      a.morph('wide', { blink: false })
      a.shake(0.07, 18, 2.2)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.4)) sweat(a)
    },
    front: errorBadge
  },

  poked: {
    kind: 'once',
    duration: 0.9,
    label: label('Poked', '被戳'),
    enter(a) {
      a.express('surprised')
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.35)) a.express('happy')
    }
  },

  happy: {
    kind: 'once',
    duration: 1.6,
    label: label('Happy', '开心'),
    enter(a) {
      a.express('happy')
      a.hop(0.7)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.6)) a.hop(0.55)
    }
  },

  excited: {
    kind: 'once',
    duration: 1.7,
    label: label('Excited', '兴奋'),
    enter(a) {
      a.express('excited')
      a.hop(0.5)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.42) || at(t, dt, 0.84)) a.hop(0.5)
      if (at(t, dt, 0.9)) sparkles(a, 6)
      a.lean.target = Math.sin(t * 14) * 0.06
    }
  },

  proud: {
    kind: 'once',
    duration: 1.9,
    label: label('Proud', '骄傲'),
    enter(a) {
      a.express('proud')
      a.scale.target = 1.08
      a.lean.target = -0.09
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.5)) sparkles(a, 4, '#ffd43b')
    }
  },

  love: {
    kind: 'once',
    duration: 2.2,
    label: label('Love', '喜欢'),
    enter(a) {
      a.express('happy')
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.15)) a.morph('heart')
      if (every(t, dt, 0.45, 0.3) && t < 1.7) floatGlyph(a, '♥', 'heart', '#ff6b8a', 0.26)
      if (at(t, dt, 1.75)) a.morph('rest')
    }
  },

  surprised: {
    kind: 'once',
    duration: 1.3,
    label: label('Surprised', '吃惊'),
    enter(a) {
      a.express('surprised')
      a.hop(0.9)
      a.scale.velocity += 1.5
      floatGlyph(a, '!', 'glyph', undefined, 0.38)
    }
  },

  shy: {
    kind: 'once',
    duration: 2.2,
    label: label('Shy', '害羞'),
    enter(a) {
      a.express('shy')
      a.lean.target = 0.12
      a.rootX.target = -0.12
      a.scale.target = 0.93
      a.lookAt(-0.6, 0.7)
    },
    front: blush
  },

  sad: {
    kind: 'once',
    duration: 2.4,
    label: label('Sad', '难过'),
    enter(a) {
      a.express('sad')
      a.scale.target = 0.94
      a.morph('wide', { blink: false, squash: 1 })
      a.lookAt(0, 0.8)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.7)) {
        const c = a.bodyCenter()
        a.emit({ kind: 'drop', x: c.x - 0.2, y: c.y - 0.1, vy: 0.2, ay: 5, life: 1.1, size: 0.07, color: '#74c0fc', lands: true })
      }
    }
  },

  angry: {
    kind: 'once',
    duration: 1.9,
    label: label('Angry', '生气'),
    enter(a) {
      a.express('angry')
      a.tintColor = '#e03131'
      a.tint.target = 0.35
      a.shake(0.05, 30, 1.6)
      a.scale.target = 1.06
    },
    tick(a, t, dt) {
      if (every(t, dt, 0.4, 0.2) && t < 1.4) steam(a, 2)
    }
  },

  confused: {
    kind: 'once',
    duration: 2,
    label: label('Confused', '困惑'),
    enter(a) {
      a.express('dizzy')
      floatGlyph(a, '?', 'glyph', undefined, 0.38)
    },
    tick(a, t) {
      a.lean.target = Math.sin(t * 3.2) * 0.14
    }
  },

  nod: {
    kind: 'once',
    duration: 1,
    label: label('Yes', '点头'),
    enter(a) {
      a.express('happy')
      a.squish(5)
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.4)) a.squish(5)
    }
  },

  no: {
    kind: 'once',
    duration: 1.1,
    label: label('No', '摇头'),
    enter(a) {
      a.express({ w: 1.05, h: 0.6, topLid: 0.15 })
      a.shake(0.09, 15, 2)
    }
  },

  hello: {
    kind: 'once',
    duration: 1.7,
    label: label('Hello', '打招呼'),
    enter(a) {
      a.express('happy')
      a.hop(0.6)
      a.lookAt(0, 0.1)
    },
    tick(a, t) {
      a.lean.target = Math.sin(t * 9) * 0.12 * clamp(1.4 - t)
    }
  },

  celebrate: {
    kind: 'once',
    duration: 2.3,
    label: label('Celebrate', '庆祝'),
    enter(a) {
      a.express('excited')
      a.hop(1.15)
      a.spinBy(-1)
      confetti(a)
    },
    tick(a, t, dt) {
      if (at(t, dt, 1.1)) a.hop(0.5)
    }
  },

  /* ------------------------------------------------------------ fidgets */

  'look-around': {
    kind: 'once',
    duration: 2.6,
    label: label('Look around', '东张西望'),
    tick(a, t) {
      if (t < 0.9) a.lookAt(-1, 0)
      else if (t < 1.8) a.lookAt(1, -0.2)
      else a.lookFree()
    }
  },

  yawn: {
    kind: 'once',
    duration: 2.2,
    label: label('Yawn', '打哈欠'),
    enter(a) {
      a.express('sleepy')
    },
    tick(a, t, dt) {
      if (at(t, dt, 0.35)) {
        a.morph('tall', { blink: false })
        a.express('closed')
      }
      if (at(t, dt, 1.35)) {
        a.morph('rest', { blink: false })
        a.express('sleepy')
      }
    }
  },

  bounce: {
    kind: 'once',
    duration: 1,
    label: label('Hop', '蹦一下'),
    enter(a) {
      a.hop(0.65)
      a.express('happy')
    }
  },

  wiggle: {
    kind: 'once',
    duration: 1.2,
    label: label('Wiggle', '扭一扭'),
    enter(a) {
      a.jiggle(0.8)
    },
    tick(a, t) {
      a.lean.target = Math.sin(t * 11) * 0.09 * clamp(1.1 - t)
    }
  }
}

export const UNIVERSAL_STATES = ['idle', 'thinking', 'working', 'waiting', 'blocked', 'listening', 'sleep']
export const UNIVERSAL_EVENTS = ['acknowledge', 'done', 'error', 'poked']
export const EMOTIONS = ['happy', 'excited', 'proud', 'love', 'surprised', 'shy', 'sad', 'angry', 'confused', 'nod', 'no', 'hello', 'celebrate']
export const FIDGETS = ['look-around', 'yawn', 'bounce', 'wiggle']
