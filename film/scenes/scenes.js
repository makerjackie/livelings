// Scenes for the Livelings films, drawn with the real engine at 1440×810.
//   /?scene=tricks&lang=zh&p=<json>
// Every time in `p` is in seconds from the start of the scene; tools/shots.mjs
// works them out from the music and the narration. Time comes from
// performance.now(), which the capture tool drives frame by frame.
import * as L from './livelings.js'
import toast from './characters/toast.js'
import { codeLines, PROMPT } from './cues.mjs'

const q = new URLSearchParams(location.search)
const id = q.get('scene') ?? 'tricks'
const lang = q.get('lang') === 'en' ? 'en' : 'zh'
const P = JSON.parse(q.get('p') ?? '{}')

const W = 1440
const H = 810
const canvas = document.getElementById('c')
const dpr = devicePixelRatio || 1
canvas.width = W * dpr
canvas.height = H * dpr
const g = canvas.getContext('2d')

const C = { ...L.CHARACTERS, toast }
const FAMILY = ['cloud', 'inky', 'dice', 'ghost', 'duck', 'blocks', 'moon']
const TONES = { cloud: '#d9ecfb', inky: '#fbefc2', dice: '#e9e4f7', ghost: '#dfe3ec', duck: '#dcf1fb', blocks: '#fbe9d8', moon: '#e6e4f5', toast: '#fde7c8' }
const INK = '#171614'
const MUTED = '#6b665c'
const PAPER = '#f4f0e6'
const ZH = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const BRAND = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
const FONT = lang === 'zh' ? ZH : BRAND
const tx = (t) => (t ? t[lang] : '')
const nameOf = (cid) => (cid === 'toast' ? (lang === 'zh' ? '吐吐' : 'Toasty') : tx(C[cid].name))

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

function text(str, x, y, { size = 40, weight = 700, color = INK, align = 'center', font = FONT, alpha = 1 } = {}) {
  g.save()
  g.globalAlpha *= alpha
  g.font = `${weight} ${size}px ${font}`
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = 'alphabetic'
  g.fillText(str, x, y)
  g.restore()
}

/** Something landing like a stamp at `at`: returns [scale, rotation, alpha]. */
const stamp = (t, at, d = 0.32) => {
  const k = easeBack((t - at) / d)
  return [1.18 - 0.18 * k, (1 - k) * -0.06, clamp01((t - at) / 0.1)]
}

/** A big line of copy: Chinese with a small English line under it, or English alone. */
function say(t, copy, x, y, { size = 72, at = 0 } = {}) {
  if (t < at) return
  const [s, r, a] = stamp(t, at)
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.rotate(r)
  g.globalAlpha = a
  if (lang === 'zh') {
    text(copy.zh, 0, 0, { size, weight: 600, font: ZH })
    text(copy.en, 0, size * 0.7, { size: size * 0.38, weight: 600, color: MUTED, font: BRAND })
  } else text(copy.en, 0, 0, { size, weight: 750, font: BRAND })
  g.restore()
}

/** A character on stage. */
class Cast {
  constructor(cid, x, y, R, opts = {}) {
    this.id = cid
    this.a = new L.Actor(C[cid], { fidget: false })
    this.x = x
    this.y = y
    this.R = R
    this.a.advance(0.4)
    if (opts.pop) this.a.scale.snap(0.05)
  }
  enter() {
    this.a.scale.value = 0.05
    this.a.scale.target = 1
    this.a.hop(0.8)
  }
  /** play an action as if it had started `pre` seconds ago */
  act(name, pre = 0) {
    this.a.play(name)
    for (let k = 0; k < Math.round(pre * 120); k++) this.a.advance(1 / 120)
  }
  draw(dt) {
    this.a.advance(dt)
    L.renderActor(g, this.a, { cx: this.x, cy: this.y, R: this.R, shadow: true })
  }
}

/** Events at local times, each run once as time passes it. */
function timeline(list) {
  const done = new Set()
  return (t) =>
    list.forEach((e, i) => {
      if (!done.has(i) && t >= e[0]) {
        done.add(i)
        e[1]()
      }
    })
}

function nameTag(x, y, main, sub) {
  g.font = `600 34px ${FONT}`
  const w1 = g.measureText(main).width
  g.font = `500 26px ${FONT}`
  const w2 = sub ? g.measureText(sub).width : 0
  const w = w1 + (sub ? w2 + 24 : 0) + 52
  g.fillStyle = '#fffdf8'
  rrect(x, y, w, 66, 33)
  g.fill()
  text(main, x + 26, y + 45, { size: 34, weight: 600, align: 'left' })
  if (sub) text(sub, x + 26 + w1 + 24, y + 44, { size: 26, weight: 500, color: MUTED, align: 'left' })
}

/* ------------------------------------------------------------ scenes */

const SCENES = {
  /* one trick after another, full frame; `family` items show everyone at once */
  tricks() {
    const items = P.items ?? []
    let cur = null
    let row = null
    const run = timeline(
      items.map((it) => [it.from - 0.0001, () => {
        if (it.family) {
          cur = null
          row = FAMILY.map((cid, i) => {
            const c = new Cast(cid, 720 + (i - 3) * 184, 430, 66)
            c.at = it.from + i * (it.stagger ?? 0.06)
            return c
          })
          row.act = it.act ?? 'hello'
        } else {
          row = null
          cur = new Cast(it.id, 720, 455, it.R ?? 175)
          cur.act(it.act, it.pre ?? 0)
          cur.label = it.label ?? tx(cur.a.behaviors[it.act].label)
        }
      }])
    )
    const played = new Set()
    return (t, dt) => {
      run(t)
      if (cur) {
        paper(TONES[cur.id])
        cur.draw(dt)
        nameTag(56, 52, nameOf(cur.id), cur.label)
      } else if (row) {
        paper()
        row.forEach((c, i) => {
          if (!played.has(i) && t >= c.at) {
            played.add(i)
            c.enter()
            c.a.play(row.act)
          }
          c.draw(dt)
          text(nameOf(c.id), c.x, 580, { size: 30, weight: 600 })
        })
      } else paper()
    }
  },

  /* plain status cards: a spinner, a red mark, a green check */
  states() {
    const xs = [270, 720, 1170]
    const labels = lang === 'zh' ? ['加载中…', '出错了', '完成'] : ['Loading…', 'Something broke', 'Done']
    const at = P.cards ?? [0, 0.3, 0.6]
    return (t) => {
      paper()
      xs.forEach((x, i) => {
        if (t < at[i]) return
        const [s, r, a] = stamp(t, at[i], 0.4)
        const dim = P.focusAt !== undefined && t > P.focusAt && i > 0 ? 1 - 0.55 * clamp01((t - P.focusAt) / 0.3) : 1
        const grow = P.focusAt !== undefined && i === 0 ? 1 + 0.1 * easeOut((t - P.focusAt) / 0.4) : 1
        g.save()
        g.translate(x, 400)
        g.scale(s * grow, s * grow)
        g.rotate(r)
        g.globalAlpha = a * dim
        g.shadowColor = 'rgba(60,45,10,0.18)'
        g.shadowBlur = 40
        g.shadowOffsetY = 16
        g.fillStyle = '#fffdf8'
        rrect(-205, -190, 410, 380, 28)
        g.fill()
        g.shadowColor = 'transparent'
        g.translate(0, -45)
        g.scale(1.25, 1.25)
        if (i === 0) {
          g.rotate(t * Math.PI * 2.3)
          g.strokeStyle = '#bdb6a6'
          g.lineWidth = 9
          g.lineCap = 'round'
          g.beginPath()
          g.arc(0, 0, 34, 0, Math.PI * 1.5)
          g.stroke()
          g.rotate(-t * Math.PI * 2.3)
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
        g.scale(0.8, 0.8)
        g.translate(0, 45 / 0.8 + 92)
        text(labels[i], 0, 0, { size: 34, weight: 600 })
        g.restore()
      })
    }
  },

  /* three lines of code; the element comes alive and changes state */
  code() {
    const lines = codeLines(P.character ?? 'cloud')
    const timing = P.lines ?? [[0, 0.5], [0.5, 1.4], [1.4, 2]]
    const states = P.states ?? []
    const who = new Cast(P.character ?? 'cloud', 1168, 430, 88, { pop: true })
    let on = false
    let state = 'thinking'
    let changed = -1
    const run = timeline([
      [P.appearAt ?? 2, () => {
        on = true
        who.enter()
        who.a.play('thinking')
      }],
      ...states.map((s) => [s.at, () => {
        state = s.state
        changed = s.at
        who.a.play('idle')
        who.a.play(s.state)
      }])
    ])
    const STATUS = {
      thinking: lang === 'zh' ? '思考中…' : 'Thinking…',
      done: lang === 'zh' ? '完成 ✓' : 'Done ✓',
      error: lang === 'zh' ? '出错了' : 'Something broke',
      celebrate: lang === 'zh' ? '完成 ✓' : 'Done ✓'
    }
    return (t, dt) => {
      run(t)
      paper()
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
      lines.forEach((line, i) => {
        const [from, to] = timing[i]
        if (t < from) return
        let s = line.slice(0, Math.round(line.length * clamp01((t - from) / (to - from))))
        if (i === 2 && changed >= 0) s = line.replace('"thinking"', `"${state === 'celebrate' ? 'done' : state}"`)
        const y = 338 + i * 52
        text(String(i + 1), 72, y, { size: 16, weight: 500, color: '#5c5850', font: MONO })
        paintCode(s, 102, y, i === 2 && changed >= 0 ? clamp01((t - changed) / 0.2) : 0)
        if (t < to && Math.floor(t * 3) % 2 === 0) {
          g.fillStyle = '#ffd43b'
          g.fillRect(102 + g.measureText(s).width + 2, y - 18, 10, 23)
        }
      })
      if (P.depsAt !== undefined && t >= P.depsAt) {
        const [s, r, a] = stamp(t, P.depsAt)
        g.save()
        g.translate(480, 640)
        g.scale(s, s)
        g.rotate(r)
        g.globalAlpha = a
        const label = lang === 'zh' ? '没有依赖 · 约 40 KB' : 'No dependencies · ~40 KB'
        g.font = `600 30px ${FONT}`
        const w = g.measureText(label).width + 56
        g.fillStyle = '#ffd43b'
        rrect(-w / 2, -40, w, 60, 30)
        g.fill()
        text(label, 0, 1, { size: 30, weight: 600 })
        g.restore()
      }
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
        g.save()
        rrect(960, 230, 416, 396, [0, 0, 22, 22])
        g.clip()
        who.draw(dt)
        g.restore()
        text(STATUS[state] ?? '', 1168, 596, { size: 24, weight: 600, color: MUTED })
      }
    }
  },

  /* "want your own?": a request types itself, then Toasty pops out of its toaster */
  skill() {
    const prompt = [...PROMPT[lang]]
    const per = (P.typeTo - P.typeFrom) / prompt.length
    const toaster = new Cast('toast', 720, 520, 150)
    let popped = false
    const up = P.liftAt ?? P.popAt ?? Infinity
    const run = timeline([
      [P.popAt ?? Infinity, () => {
        popped = true
        toaster.a.play('pop')
      }],
      [P.happyAt ?? Infinity, () => toaster.a.play('happy')]
    ])
    return (t, dt) => {
      run(t)
      paper(P.tone ?? PAPER)
      const lift = easeOut((t - up) / 0.45)
      if (P.askAt !== undefined) {
        g.save()
        g.globalAlpha = 1 - lift
        say(t, { zh: '想要一个自己的？', en: 'Want one of your own?' }, 720, 300 - lift * 120, { size: 72, at: P.askAt })
        g.restore()
      }
      if (P.typeFrom !== undefined && t >= P.typeFrom - 0.2) {
        const n = prompt.filter((_, i) => t >= P.typeFrom + i * per).length
        const s = prompt.slice(0, n).join('')
        const y = 430 - lift * 330
        g.save()
        g.globalAlpha = clamp01((t - P.typeFrom + 0.2) / 0.2)
        g.shadowColor = 'rgba(60,45,10,0.16)'
        g.shadowBlur = 30
        g.shadowOffsetY = 10
        g.fillStyle = '#fffdf8'
        rrect(250, y, 940, 86, 43)
        g.fill()
        g.restore()
        g.font = `500 28px ${FONT}`
        text(s, 296, y + 53, { size: 28, weight: 500, align: 'left' })
        if (n < prompt.length || Math.floor(t * 2.4) % 2 === 0) {
          g.fillStyle = INK
          g.fillRect(298 + g.measureText(s).width, y + 28, 3, 34)
        }
        const on = P.sendAt !== undefined && t >= P.sendAt
        g.fillStyle = on ? INK : '#e3ddcf'
        g.beginPath()
        g.arc(1140, y + 43, 26, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = on ? '#fffdf8' : '#a39d90'
        g.lineWidth = 4
        g.lineCap = 'round'
        g.lineJoin = 'round'
        g.beginPath()
        g.moveTo(1140, y + 55)
        g.lineTo(1140, y + 31)
        g.moveTo(1130, y + 41)
        g.lineTo(1140, y + 31)
        g.lineTo(1150, y + 41)
        g.stroke()
      }
      if (t >= up || P.typeFrom === undefined) {
        g.save()
        g.globalAlpha = P.typeFrom === undefined ? 1 : clamp01((t - up) / 0.25)
        toaster.y = P.typeFrom === undefined ? 470 : 560 - 40 * lift
        toaster.draw(dt)
        g.restore()
        if (popped && P.name) {
          const [s, r, a] = stamp(t, P.popAt + 0.5)
          if (t > P.popAt + 0.5) {
            g.save()
            g.translate(1110, 300)
            g.scale(s, s)
            g.rotate(r)
            g.globalAlpha = a
            nameTag(-120, -40, nameOf('toast'), lang === 'zh' ? '用 Skill 做的' : 'made with the skill')
            g.restore()
          }
        }
      }
    }
  },

  /* the launch card: the family, the name, where to find it */
  end() {
    const all = [...FAMILY, ...(P.toast === false ? [] : ['toast'])]
    const gap = all.length > 7 ? 150 : 168
    const cast = all.map((cid, i) => new Cast(cid, 720 + (i - (all.length - 1) / 2) * gap, 470, 52, { pop: true }))
    const enter = P.enterAt ?? 0
    const run = timeline([
      ...cast.map((c, i) => [enter + i * 0.07, () => {
        c.enter()
        c.a.play('hello')
      }]),
      ...(P.cheerAt ?? []).flatMap((at) => cast.map((c, i) => [at + i * 0.04, () => c.a.play('celebrate')])),
      ...(P.jumpAt ?? []).flatMap((at) => cast.map((c, i) => [at + i * 0.03, () => {
        c.a.flash('surprised', 0.6)
        c.a.hop(0.9)
      }])),
      ...(P.sleepAt !== undefined ? cast.map((c, i) => [P.sleepAt + i * 0.1, () => c.a.play('yawn')]) : []),
      ...(P.sleepAt !== undefined ? cast.map((c, i) => [P.sleepAt + 1.6 + i * 0.1, () => c.a.play('sleep')]) : [])
    ])
    return (t, dt) => {
      run(t)
      paper()
      const [s, r, a] = stamp(t, P.titleAt ?? 0, 0.4)
      g.save()
      g.translate(720, 205)
      g.scale(s, s)
      g.rotate(r)
      g.globalAlpha = a
      if (lang === 'zh') {
        g.font = `600 100px ${ZH}`
        const w1 = g.measureText('活宝 ').width
        g.font = `800 100px ${BRAND}`
        const w2 = g.measureText('Livelings').width
        text('活宝', -(w1 + w2) / 2, 0, { size: 100, weight: 600, align: 'left', font: ZH })
        text('Livelings', -(w1 + w2) / 2 + w1, 0, { size: 100, weight: 800, align: 'left', font: BRAND })
      } else text('Livelings', 0, 0, { size: 112, weight: 800, font: BRAND })
      g.restore()
      if (P.launchAt !== undefined && t >= P.launchAt) {
        const [s2, r2, a2] = stamp(t, P.launchAt, 0.35)
        g.save()
        g.translate(1205, 118)
        g.scale(s2, s2)
        g.rotate(-0.12 + r2)
        g.globalAlpha = a2
        const label = lang === 'zh' ? '开源发布' : 'Open source'
        g.font = `700 40px ${FONT}`
        const w = g.measureText(label).width + 48
        g.strokeStyle = '#e03131'
        g.lineWidth = 5
        rrect(-w / 2, -42, w, 70, 12)
        g.stroke()
        text(label, 0, 6, { size: 40, weight: 700, color: '#e03131' })
        g.restore()
      }
      const sub = clamp01((t - (P.subAt ?? 0.3)) / 0.3)
      text(lang === 'zh' ? '开源 · 免费 · 可以商用' : 'Open source · Free · OK for commercial use', 720, 280, { size: 32, weight: 600, color: MUTED, alpha: sub })
      cast.forEach((c) => {
        if (t >= enter) c.draw(dt)
      })
      const low = clamp01((t - (P.urlAt ?? 0.6)) / 0.3)
      const glow = P.urlFlashAt !== undefined ? Math.max(0, 1 - Math.abs(t - P.urlFlashAt - 0.3) / 0.6) : 0
      if (glow > 0) {
        g.fillStyle = `rgba(255, 212, 59, ${0.85 * glow})`
        rrect(720 - 330, 600, 660, 62, 18)
        g.fill()
      }
      text('livelings.makerjackie.com', 720, 646, { size: 48, weight: 800, alpha: low, font: BRAND })
      text('github.com/makerjackie/livelings', 720, 700, { size: 26, weight: 600, color: MUTED, alpha: low, font: BRAND })
      text('by MakerJackie', 720, 762, { size: 24, weight: 700, color: '#a39d90', alpha: low, font: BRAND })
    }
  }
}

/** HTML-ish colouring for the code lines; `swap` highlights the changed state value. */
function paintCode(s, x, y, swap) {
  const parts = s.split(/("[^"]*"?|<\/?[\w-]+|>)/).filter(Boolean)
  let cx = x
  for (const p of parts) {
    const color = p.startsWith('"') ? '#ffd866' : p.startsWith('<') || p === '>' ? '#8fd3ff' : '#efebe1'
    if (swap && /^"(done|error)"$/.test(p)) {
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
