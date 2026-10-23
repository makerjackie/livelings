// Scenes for the Livelings launch film, drawn with the real engine at 1440×810.
//   /?scene=hook&lang=zh&t0=0
// t0 is where the scene starts in the film, so beats from beats.json can be
// turned into local time. Time comes from performance.now(), which the capture
// tool drives frame by frame.
import * as L from './livelings.js'
import toast from './characters/toast.js'
import { CODE, PROMPT, typedAt } from './cues.mjs'

const q = new URLSearchParams(location.search)
const id = q.get('scene') ?? 'hook'
const lang = q.get('lang') === 'en' ? 'en' : 'zh'
const t0 = Number(q.get('t0') ?? 0)
const { beats } = await (await fetch('./beats.json')).json()
/** local time of bar k (fractional bars are quarter notes) plus b beats */
const bar = (k, b = 0) => beats[1 + Math.round(4 * k) + b] - t0
const BEAT = beats[2] - beats[1]

const W = 1440
const H = 810
const canvas = document.getElementById('c')
const dpr = devicePixelRatio || 1
canvas.width = W * dpr
canvas.height = H * dpr
const g = canvas.getContext('2d')

const C = L.CHARACTERS
const FAMILY = [C.inky, C.doudou, C.dice, C.ghost, C.duck, C.blocks, C.moon]
const TONES = { inky: '#fbefc2', doudou: '#d9ecfb', dice: '#e9e4f7', ghost: '#dfe3ec', duck: '#dcf1fb', blocks: '#fbe9d8', moon: '#e6e4f5', toast: '#fde7c8' }
const INK = '#171614'
const MUTED = '#6b665c'
const PAPER = '#f4f0e6'
const ZH = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const BRAND = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
const tx = (t) => (t ? t[lang] : '')

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
const easeBack = (x) => {
  x = clamp01(x)
  const c = 1.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

/* ------------------------------------------------------------ drawing */

let dots = null
function paper(color = PAPER) {
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  if (!dots) {
    const c = document.createElement('canvas')
    c.width = c.height = 18 * dpr
    const d = c.getContext('2d')
    d.fillStyle = 'rgba(23,22,20,0.08)'
    d.beginPath()
    d.arc(9 * dpr, 9 * dpr, 1.1 * dpr, 0, Math.PI * 2)
    d.fill()
    dots = g.createPattern(c, 'repeat')
  }
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = dots
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.restore()
}

function rrect(x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

function text(str, x, y, { size = 40, weight = 700, color = INK, align = 'center', font = ZH, alpha = 1, base = 'alphabetic' } = {}) {
  g.save()
  g.globalAlpha *= alpha
  g.font = `${weight} ${size}px ${font}`
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = base
  g.fillText(str, x, y)
  g.restore()
}

/** A big line of copy: Chinese with a small English line under it, or English alone. */
function say(t, { zh, en }, x, y, { size = 64, appear = 0, gone = Infinity } = {}) {
  const k = easeBack((t - appear) / 0.32)
  const out = clamp01((t - gone) / 0.14)
  if (t < appear || out >= 1) return
  g.save()
  g.translate(x, y)
  const s = (0.86 + 0.14 * k) * (1 - 0.1 * out)
  g.scale(s, s)
  g.rotate((1 - k) * -0.05)
  g.globalAlpha = clamp01((t - appear) / 0.12) * (1 - out)
  if (lang === 'zh') {
    text(zh, 0, 0, { size, weight: 600 })
    text(en, 0, size * 0.72, { size: size * 0.4, weight: 600, color: MUTED, font: BRAND })
  } else text(en, 0, 0, { size, weight: 750, font: BRAND })
  g.restore()
}

/** A character on stage: an actor, where it stands, and an optional pop-in. */
class Cast {
  constructor(def, x, y, R, opts = {}) {
    this.a = new L.Actor(def, { fidget: false, ...opts })
    this.x = x
    this.y = y
    this.R = R
    this.shadow = opts.shadow ?? true
    this.from = opts.enter ?? -Infinity
    if (opts.enter !== undefined) this.a.scale.snap(0.05)
    this.a.advance(0.4)
  }
  enter() {
    this.a.scale.value = 0.05
    this.a.scale.target = 1
    this.a.hop(0.8)
  }
  draw() {
    L.renderActor(g, this.a, { cx: this.x, cy: this.y, R: this.R, shadow: this.shadow })
  }
}

/** Events at local times, run once each as time passes them. */
function timeline(list) {
  const done = new Set()
  return (t) => list.forEach((e, i) => {
    if (!done.has(i) && t >= e[0]) {
      done.add(i)
      e[1]()
    }
  })
}

/* ------------------------------------------------------------ scenes */

const SCENES = {
  /* a spinner turns into Inky */
  hook() {
    const b1 = bar(1)
    const inky = new Cast(C.inky, 720, 470, 122, { enter: b1 })
    let born = false
    const run = timeline([
      [b1, () => {
        born = true
        inky.enter()
        inky.a.flash('surprised', 0.5)
      }],
      [b1 + BEAT * 1.2, () => inky.a.lookAt(0, 0.1)],
      [bar(1, 2), () => inky.a.play('thinking')]
    ])
    return (t, dt) => {
      run(t)
      paper()
      say(t, { zh: '又在转圈圈？', en: 'Another spinner?' }, 720, 196, { size: 80, gone: b1 - 0.05 })
      say(t, { zh: '让它活过来。', en: 'Let it come alive.' }, 720, 196, { size: 80, appear: b1 + 0.08 })
      // the spinner: a grey arc that collapses into a dot when Inky arrives
      const k = clamp01((t - (b1 - 0.12)) / 0.16)
      if (k < 1) {
        const r = 74 * (1 - easeOut(k))
        const spin = t * Math.PI * 2 * 1.15
        g.save()
        g.translate(720, 450)
        g.rotate(spin)
        g.strokeStyle = '#bdb6a6'
        g.lineWidth = 13 * (1 - k * 0.5)
        g.lineCap = 'round'
        g.beginPath()
        g.arc(0, 0, Math.max(0.1, r), 0, Math.PI * 1.5 * (1 - k))
        g.stroke()
        g.restore()
      }
      text(lang === 'zh' ? '加载中…' : 'Loading…', 720, 580, { size: 22, weight: 500, color: '#a39d90', alpha: 1 - clamp01((t - b1) / 0.2), font: lang === 'zh' ? ZH : BRAND })
      if (born) {
        inky.a.advance(dt)
        inky.draw()
      }
    }
  },

  /* three plain status cards; each icon becomes a character acting it out */
  states() {
    const xs = [270, 720, 1170]
    const labels = lang === 'zh' ? ['思考中…', '出错了', '完成！'] : ['Thinking…', 'Something broke', 'Done!']
    const who = [
      new Cast(C.doudou, xs[0], 350, 86, { enter: 0 }),
      new Cast(C.dice, xs[1], 350, 78, { enter: 0 }),
      new Cast(C.duck, xs[2], 350, 84, { enter: 0 })
    ]
    const acts = ['thinking', 'error', 'done']
    const swap = [bar(3), bar(4), bar(5)]
    const live = [false, false, false]
    const run = timeline(
      swap.map((at, i) => [at, () => {
        live[i] = true
        who[i].enter()
        who[i].a.play(acts[i])
      }])
    )
    const again = [0, 0, 0]
    return (t, dt) => {
      run(t)
      // error and done are one-shots: act them again while the card is on screen
      who.forEach((c, i) => {
        if (!live[i] || i === 0 || c.a.onceId) return
        if ((again[i] += dt) > 0.5) {
          again[i] = 0
          c.a.play(acts[i])
        }
      })
      paper()
      xs.forEach((x, i) => {
        const inAt = BEAT * i * 0.5
        const k = easeBack((t - inAt) / 0.4)
        if (t < inAt) return
        g.save()
        g.translate(x, 395)
        g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k)
        g.rotate((1 - k) * -0.06)
        g.globalAlpha = clamp01((t - inAt) / 0.15)
        g.shadowColor = 'rgba(60,45,10,0.18)'
        g.shadowBlur = 40
        g.shadowOffsetY = 16
        g.fillStyle = '#fffdf8'
        rrect(-205, -190, 410, 380, 28)
        g.fill()
        g.restore()
        // the old icon shrinks away as the character arrives
        const gone = clamp01((t - swap[i] + 0.06) / 0.14)
        if (gone < 1 && t >= inAt) {
          g.save()
          g.translate(x, 355)
          g.scale(1.25 * (1 - gone), 1.25 * (1 - gone))
          if (i === 0) {
            g.rotate(t * Math.PI * 2.3)
            g.strokeStyle = '#bdb6a6'
            g.lineWidth = 9
            g.lineCap = 'round'
            g.beginPath()
            g.arc(0, 0, 34, 0, Math.PI * 1.5)
            g.stroke()
          } else {
            g.fillStyle = i === 1 ? '#e03131' : '#2f9e44'
            g.beginPath()
            g.arc(0, 0, 38, 0, Math.PI * 2)
            g.fill()
            g.strokeStyle = '#fff'
            g.lineWidth = 7
            g.lineCap = 'round'
            g.lineJoin = 'round'
            g.beginPath()
            if (i === 1) {
              g.moveTo(0, -17)
              g.lineTo(0, 5)
              g.moveTo(0, 17)
              g.lineTo(0, 17.5)
            } else {
              g.moveTo(-15, 1)
              g.lineTo(-4, 12)
              g.lineTo(16, -11)
            }
            g.stroke()
          }
          g.restore()
        }
        if (live[i]) {
          g.save()
          rrect(x - 205, 205, 410, 380, 28)
          g.clip()
          who[i].a.advance(dt)
          who[i].draw()
          g.restore()
        }
        text(labels[i], x, 530, { size: 32, weight: 600, alpha: clamp01((t - inAt) / 0.15), font: lang === 'zh' ? ZH : BRAND })
      })
    }
  },

  /* the name, then the family pops up one per beat */
  title() {
    const cast = FAMILY.map((def, i) => new Cast(def, 720 + (i - 3) * 176, 598, 62, { enter: 0 }))
    const shown = cast.map(() => false)
    const run = timeline(
      cast.map((c, i) => [bar(6, i + 1), () => {
        shown[i] = true
        c.enter()
        c.a.play('hello')
      }]).concat([[bar(7, 3) + BEAT * 0.6, () => cast.forEach((c) => c.a.play('happy'))]])
    )
    return (t, dt) => {
      run(t)
      paper()
      const k = easeBack(t / 0.36)
      g.save()
      g.translate(720, 300)
      g.scale(1.25 - 0.25 * k, 1.25 - 0.25 * k)
      g.rotate((1 - k) * -0.06)
      g.globalAlpha = clamp01(t / 0.1)
      if (lang === 'zh') {
        g.font = `600 128px ${ZH}`
        const a = g.measureText('活宝 ').width
        g.font = `800 128px ${BRAND}`
        const b = g.measureText('Livelings').width
        text('活宝', -(a + b) / 2, 0, { size: 128, weight: 600, align: 'left' })
        text('Livelings', -(a + b) / 2 + a, 0, { size: 128, weight: 800, align: 'left', font: BRAND })
      } else text('Livelings', 0, 0, { size: 150, weight: 800, font: BRAND })
      g.restore()
      const sub = clamp01((t - BEAT * 0.5) / 0.3)
      if (lang === 'zh') {
        text('会动、会回应的开源吉祥物', 720, 382, { size: 38, weight: 600, color: MUTED, alpha: sub })
        text('Open-source mascots that are alive', 720, 418, { size: 20, weight: 600, color: '#a39d90', alpha: sub, font: BRAND })
      } else text('Open-source mascots that are alive', 720, 386, { size: 40, weight: 600, color: MUTED, alpha: sub, font: BRAND })
      cast.forEach((c, i) => {
        if (!shown[i]) return
        c.a.advance(dt)
        c.draw()
      })
    }
  },

  /* each one's own trick, two at a time, then Inky on its own */
  tricks() {
    const pairs = [
      [['dice', 'lucky'], ['ghost', 'boo']],
      [['duck', 'flip'], ['blocks', 'topple']],
      [['moon', 'wax'], ['doudou', 'thunder']],
      [['inky', 'stamp']]
    ]
    let cur = []
    const run = timeline(
      pairs.map((pair, k) => [bar(20 + k) - 0.001, () => {
        const half = W / pair.length
        cur = pair.map(([cid, act], i) => {
          const c = new Cast(C[cid], half * i + half / 2, pair.length === 1 ? 430 : 455, pair.length === 1 ? 150 : 122)
          c.id = cid
          c.act = act
          c.x0 = half * i
          c.w = half
          c.a.play(act)
          return c
        })
      }])
    )
    return (t, dt) => {
      run(t)
      paper()
      for (const c of cur) {
        g.save()
        g.beginPath()
        g.rect(c.x0, 0, c.w, H)
        g.clip()
        g.fillStyle = TONES[c.id]
        g.fillRect(c.x0, 0, c.w, H)
        g.restore()
      }
      for (const c of cur) {
        g.save()
        g.beginPath()
        g.rect(c.x0, 0, c.w, H)
        g.clip()
        c.a.advance(dt)
        c.draw()
        // a name tag: who, and what it is doing
        const name = tx(c.a.def.name)
        const act = tx(c.a.behaviors[c.act].label)
        g.font = `600 30px ${lang === 'zh' ? ZH : BRAND}`
        const w = g.measureText(`${name} · ${act}`).width
        g.fillStyle = '#fffdf8'
        rrect(c.x0 + 40, 40, w + 44, 60, 30)
        g.fill()
        text(`${name} · ${act}`, c.x0 + 62, 81, { size: 30, weight: 600, align: 'left', font: lang === 'zh' ? ZH : BRAND })
        g.restore()
      }
    }
  },

  /* three lines of code; the element comes alive and changes state */
  code() {
    const ghost = new Cast(C.ghost, 1168, 440, 84, { enter: 0 })
    let on = false
    let state = 'thinking'
    const doneAt = bar(29, 2)
    const run = timeline([
      [bar(29), () => {
        on = true
        ghost.enter()
        ghost.a.play('thinking')
      }],
      [doneAt, () => {
        state = 'done'
        ghost.a.play('idle')
        ghost.a.play('done')
      }]
    ])
    return (t, dt) => {
      run(t)
      paper()
      // editor
      g.fillStyle = INK
      rrect(40, 236, 880, 320, 22)
      g.fill()
      ;['#ff6b6b', '#ffd43b', '#51cf66'].forEach((c, i) => {
        g.fillStyle = c
        g.beginPath()
        g.arc(72 + i * 22, 264, 6, 0, Math.PI * 2)
        g.fill()
      })
      text('index.html', 480, 270, { size: 15, weight: 500, color: '#8f8a80', font: MONO })
      g.font = `500 18.5px ${MONO}`
      CODE.forEach((line, i) => {
        const from = line.from * BEAT
        const to = line.to * BEAT
        if (t < from) return
        let s = line.text.slice(0, Math.round(line.text.length * clamp01((t - from) / (to - from))))
        if (i === 2 && state === 'done') s = line.text.replace('thinking', 'done')
        const y = 338 + i * 52
        text(String(i + 1), 72, y, { size: 16, weight: 500, color: '#5c5850', font: MONO })
        paintCode(s, 102, y, i === 2 && t >= doneAt ? clamp01((t - doneAt) / 0.2) : 0)
        if (t < to && Math.floor(t * 3) % 2 === 0) {
          g.fillStyle = '#ffd43b'
          g.fillRect(102 + g.measureText(s).width + 2, y - 18, 10, 23)
        }
      })
      // the page it lands in
      g.save()
      g.shadowColor = 'rgba(60,45,10,0.18)'
      g.shadowBlur = 36
      g.shadowOffsetY = 14
      g.fillStyle = '#fffdf8'
      rrect(960, 186, 416, 440, 22)
      g.fill()
      g.restore()
      g.fillStyle = '#ece6d8'
      rrect(960, 186, 416, 44, [22, 22, 0, 0])
      g.fill()
      ;[0, 1, 2].forEach((i) => {
        g.fillStyle = '#d8d1c1'
        g.beginPath()
        g.arc(986 + i * 18, 208, 5.5, 0, Math.PI * 2)
        g.fill()
      })
      if (on) {
        ghost.a.advance(dt)
        ghost.draw()
        text(state === 'done' ? (lang === 'zh' ? '好了 ✓' : 'Done ✓') : lang === 'zh' ? '思考中…' : 'Thinking…', 1168, 592, { size: 22, weight: 600, color: MUTED, font: lang === 'zh' ? ZH : BRAND })
      }
    }
  },

  /* the music stops; a request types itself */
  pause() {
    const prompt = PROMPT[lang]
    const sent = typedAt(lang, [...prompt].length) + 0.25
    return (t) => {
      paper()
      say(t, { zh: '想要一个自己的？', en: 'Want one of your own?' }, 720, 285, { size: 68, appear: 0.05 })
      const n = [...prompt].filter((_, i) => t >= typedAt(lang, i)).length
      const s = [...prompt].slice(0, n).join('')
      g.save()
      g.shadowColor = 'rgba(60,45,10,0.16)'
      g.shadowBlur = 30
      g.shadowOffsetY = 10
      g.fillStyle = '#fffdf8'
      rrect(250, 410, 940, 86, 43)
      g.fill()
      g.restore()
      const font = lang === 'zh' ? ZH : BRAND
      g.font = `500 28px ${font}`
      text(s, 296, 463, { size: 28, weight: 500, align: 'left', font })
      if (n < [...prompt].length || Math.floor(t * 2.4) % 2 === 0) {
        g.fillStyle = INK
        g.fillRect(298 + g.measureText(s).width, 438, 3, 34)
      }
      // send button lights up when the line is complete
      const on = clamp01((t - sent) / 0.12)
      g.fillStyle = on ? INK : '#e3ddcf'
      g.beginPath()
      g.arc(1140, 453, 26 * (1 - 0.12 * Math.sin(Math.min(1, (t - sent) / 0.25) * Math.PI) * (t > sent ? 1 : 0)), 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = on ? '#fffdf8' : '#a39d90'
      g.lineWidth = 4
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.beginPath()
      g.moveTo(1140, 465)
      g.lineTo(1140, 441)
      g.moveTo(1130, 451)
      g.lineTo(1140, 441)
      g.lineTo(1150, 451)
      g.stroke()
    }
  },

  /* Toasty pops out of its toaster: DING */
  toasty() {
    const c = new Cast(toast, 720, 420, 150)
    c.a.play('pop')
    return (t, dt) => {
      paper(TONES.toast)
      c.a.advance(dt)
      c.draw()
    }
  },

  /* everyone, the name and where to find it; they fall asleep as the music ends */
  end() {
    const all = [...FAMILY, toast]
    const cast = all.map((def, i) => new Cast(def, 720 + (i - 3.5) * 150, 458, 52))
    const run = timeline([
      ...cast.map((c, i) => [i * 0.045, () => c.a.play('celebrate')]),
      ...cast.map((c, i) => [bar(39) + i * 0.12, () => c.a.play('yawn')]),
      ...cast.map((c, i) => [bar(40) + i * 0.1, () => c.a.play('sleep')])
    ])
    return (t, dt) => {
      run(t)
      paper()
      const k = easeBack(t / 0.4)
      g.save()
      g.translate(720, 205)
      g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k)
      g.globalAlpha = clamp01(t / 0.15)
      if (lang === 'zh') {
        g.font = `600 92px ${ZH}`
        const a = g.measureText('活宝 ').width
        g.font = `800 92px ${BRAND}`
        const b = g.measureText('Livelings').width
        text('活宝', -(a + b) / 2, 0, { size: 92, weight: 600, align: 'left' })
        text('Livelings', -(a + b) / 2 + a, 0, { size: 92, weight: 800, align: 'left', font: BRAND })
      } else text('Livelings', 0, 0, { size: 104, weight: 800, font: BRAND })
      g.restore()
      const sub = clamp01((t - 0.25) / 0.3)
      text(lang === 'zh' ? '开源 · 免费 · 可以商用' : 'Open source · Free · OK for commercial use', 720, 268, { size: 30, weight: 600, color: MUTED, alpha: sub, font: lang === 'zh' ? ZH : BRAND })
      cast.forEach((c) => {
        c.a.advance(dt)
        c.draw()
      })
      const low = clamp01((t - 0.5) / 0.3)
      text('livelings.makerjackie.com', 720, 640, { size: 40, weight: 750, alpha: low, font: BRAND })
      text('github.com/makerjackie/livelings', 720, 688, { size: 24, weight: 600, color: MUTED, alpha: low, font: BRAND })
      text(lang === 'zh' ? 'MakerJackie 出品' : 'by MakerJackie', 720, 760, { size: 20, weight: 600, color: '#a39d90', alpha: low, font: lang === 'zh' ? ZH : BRAND })
    }
  }
}

/** HTML-ish colouring for the code lines; `swap` highlights the changed state value. */
function paintCode(s, x, y, swap) {
  const parts = s.split(/("[^"]*"?|<\/?[\w-]+|>)/).filter(Boolean)
  let cx = x
  for (const p of parts) {
    const color = p.startsWith('"') ? '#ffd866' : p.startsWith('<') ? '#8fd3ff' : p === '>' ? '#8fd3ff' : '#efebe1'
    if (swap && p === '"done"') {
      g.fillStyle = `rgba(255, 212, 59, ${0.35 * swap})`
      g.fillRect(cx - 3, y - 20, g.measureText(p).width + 6, 27)
    }
    g.fillStyle = color
    g.fillText(p, cx, y)
    cx += g.measureText(p).width
  }
}

await document.fonts.load(`800 40px "Bricolage Grotesque"`)
await document.fonts.load(`600 40px "Bricolage Grotesque"`)
const draw = SCENES[id]()
const start = performance.now()
let last = start
function frame() {
  const now = performance.now()
  const t = (now - start) / 1000
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  g.reset()
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  draw(t, dt)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
document.title = 'ready'
