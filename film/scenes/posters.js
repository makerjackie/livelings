// Still images for the launch posts, drawn with the engine.
//   posters.html?p=cover&lang=zh&w=1080&h=1440
// Real-site pictures come from frames of the captured footage (scenes/shots/).
import * as L from './livelings.js'
import toast from './characters/toast.js'

const q = new URLSearchParams(location.search)
const p = q.get('p') ?? 'cover'
const lang = q.get('lang') === 'en' ? 'en' : 'zh'
const W = Number(q.get('w') ?? 1080)
const H = Number(q.get('h') ?? 1440)
const canvas = document.getElementById('c')
canvas.width = W
canvas.height = H
canvas.style.width = `${W}px`
canvas.style.height = `${H}px`
const g = canvas.getContext('2d')

const C = L.CHARACTERS
const FAMILY = [C.cloud, C.inky, C.dice, C.ghost, C.duck, C.blocks, C.moon]
const TONES = { cloud: '#d9ecfb', inky: '#fbefc2', dice: '#e9e4f7', ghost: '#dfe3ec', duck: '#dcf1fb', blocks: '#fbe9d8', moon: '#e6e4f5', toast: '#fde7c8' }
const INK = '#171614'
const MUTED = '#6b665c'
const ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif'
const BRAND = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
const FONT = lang === 'zh' ? ZH : BRAND
const tall = H > W
const u = Math.min(W, H) / 1080 // layout unit

function paper(color = '#f4f0e6') {
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(23,22,20,0.07)'
  const s = 22 * u
  for (let x = s / 2; x < W; x += s) for (let y = s / 2; y < H; y += s) g.fillRect(x, y, 2 * u, 2 * u)
}

function text(str, x, y, { size = 40, weight = 700, color = INK, align = 'center', font = FONT } = {}) {
  g.font = `${weight} ${size}px ${font}`
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = 'alphabetic'
  g.fillText(str, x, y)
  return g.measureText(str).width
}

/** Headline with **highlighted** parts and "\n" line breaks, centred. Returns the bottom. */
function headline(str, y, size, cx = W / 2) {
  const lines = str.split('\n')
  lines.forEach((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    g.font = `${lang === 'zh' ? 600 : 800} ${size}px ${FONT}`
    const widths = parts.map((s) => g.measureText(s.replace(/\*\*/g, '')).width)
    let x = cx - widths.reduce((a, b) => a + b, 0) / 2
    const ly = y + i * size * 1.22
    parts.forEach((s, k) => {
      const hi = s.startsWith('**')
      const t = s.replace(/\*\*/g, '')
      if (hi) {
        g.fillStyle = 'rgba(255, 212, 59, 0.9)'
        g.fillRect(x - 4, ly - size * 0.34, widths[k] + 8, size * 0.38)
      }
      g.fillStyle = INK
      g.textAlign = 'left'
      g.fillText(t, x, ly)
      x += widths[k]
    })
  })
  return y + (lines.length - 1) * size * 1.22
}

function footer() {
  const y = H - 54 * u
  text(lang === 'zh' ? '活宝 Livelings · livelings.makerjackie.com' : 'Livelings · livelings.makerjackie.com', W / 2, y, { size: 26 * u, weight: 600, color: '#a39d90', font: BRAND })
}

/** An actor at a moment of an action: simulated in fixed steps, so the picture is repeatable. */
function pose(def, action, at, opts = {}) {
  const a = new L.Actor(def, { fidget: false, ...opts })
  a.advance(0.5)
  if (action) a.play(action)
  for (let t = 0; t < at; t += 1 / 120) a.advance(1 / 120)
  return a
}

function draw(a, cx, cy, R) {
  L.renderActor(g, a, { cx, cy, R, shadow: true })
}

function rrect(x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

async function image(src) {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

/** A picture in a rounded frame with a soft shadow; crop is [x, y, w, h] of the source. */
function framed(img, x, y, w, crop = [0, 0, img.width, img.height]) {
  const h = (w * crop[3]) / crop[2]
  g.save()
  g.shadowColor = 'rgba(60,45,10,0.28)'
  g.shadowBlur = 50 * u
  g.shadowOffsetY = 22 * u
  g.fillStyle = '#fff'
  rrect(x, y, w, h, 28 * u)
  g.fill()
  g.restore()
  g.save()
  rrect(x, y, w, h, 28 * u)
  g.clip()
  g.drawImage(img, crop[0], crop[1], crop[2], crop[3], x, y, w, h)
  g.restore()
  return y + h
}

/** Wide posters: headline on the left, the picture in this box on the right. */
const SIDE = { cx: W * 0.24, x: W * 0.47, y: H * 0.1, w: W * 0.49, h: H * 0.8 }
function wideHead(key, extra) {
  const size = 64 * (W / 1270)
  const lines = COPY[key][lang].split('\n').length
  const y = H / 2 - ((lines - 1) * size * 1.22) / 2 + size * 0.3 - (extra ? 40 * u : 0)
  return headline(COPY[key][lang], y, size, SIDE.cx)
}

const COPY = {
  cover: { zh: '会动、会回应的\n**开源吉祥物**', en: 'Open-source mascots\nthat are **alive**' },
  home: { zh: '它们一直\n**盯着你的鼠标**', en: 'They **watch\nyour cursor**' },
  grid: { zh: '点开一个，\n**变出 16 个**', en: 'Open one,\nget **sixteen**' },
  tricks: { zh: '每一个，都有\n**自己的绝活**', en: 'Each one has\n**its own tricks**' },
  code: { zh: '复制**三行代码**，\n放进你的网页', en: '**Three lines**\nin your page' },
  skill: { zh: '一句话，\n捏一个**你自己的**', en: 'One sentence,\n**your own mascot**' },
  end: { zh: '开源 · 免费 ·\n**可以商用**', en: 'Open source.\nFree. **Yours to use.**' }
}

const POSTERS = {
  async cover() {
    paper()
    const big = tall ? 108 * u : 96 * u
    const bottom = headline(COPY.cover[lang], tall ? 250 * u : 190 * u, big)
    const R = tall ? 92 * u : 70 * u
    const cast = FAMILY.map((def, i) => pose(def, ['hello', 'hello', 'happy', 'hello', 'done', 'stack', 'twinkle'][i], [0.45, 0.7, 0.6, 0.6, 0.5, 1.2, 0.9][i]))
    if (tall) {
      const rows = [cast.slice(0, 4), cast.slice(4)]
      rows.forEach((row, r) => row.forEach((a, i) => draw(a, W / 2 + (i - (row.length - 1) / 2) * 225 * u, bottom + (330 + r * 340) * u, R * 0.95)))
    } else cast.forEach((a, i) => draw(a, W / 2 + (i - 3) * 230 * u, bottom + 260 * u, R))
    const name = lang === 'zh' ? '活宝 Livelings' : 'Livelings'
    text(name, W / 2, H - (tall ? 150 : 110) * u, { size: 56 * u, weight: lang === 'zh' ? 600 : 800, font: lang === 'zh' ? ZH : BRAND })
    text('MakerJackie', W / 2, H - (tall ? 95 : 60) * u, { size: 26 * u, weight: 600, color: MUTED, font: BRAND })
  },

  async home() {
    paper()
    if (!tall) {
      wideHead('home')
      const img = await image(`./shots/home-${lang}.png`)
      framed(img, SIDE.x, SIDE.y, SIDE.w, [130, 100, (975 * SIDE.w) / SIDE.h, 975])
      return footer()
    }
    const bottom = headline(COPY.home[lang], 190 * u, 92 * u)
    const img = await image(`./shots/home-${lang}.png`)
    const w = W - 120 * u
    const hMax = H - bottom - 260 * u
    framed(img, 60 * u, bottom + 90 * u, w, [130, 100, 1180, Math.min(975, (1180 * hMax) / w)])
    footer()
  },

  async grid() {
    paper()
    if (!tall) {
      wideHead('grid')
      const img = await image(`./shots/grid-${lang}.png`)
      framed(img, SIDE.x, SIDE.y, SIDE.w, [405, 88, (985 * SIDE.w) / SIDE.h, 985])
      return footer()
    }
    const bottom = headline(COPY.grid[lang], 190 * u, 92 * u)
    const img = await image(`./shots/grid-${lang}.png`)
    const w = W - 120 * u
    const hMax = H - bottom - 250 * u
    const srcW = 1135
    framed(img, 60 * u, bottom + 90 * u, w, [405, 88, srcW, Math.min(970, (srcW * hMax) / w)])
    footer()
  },

  async tricks() {
    paper()
    const bottom = tall ? headline(COPY.tricks[lang], 190 * u, 92 * u) : wideHead('tricks')
    const cells = [
      [C.cloud, 'thunder', 0.6],
      [C.inky, 'stamp', 0.95],
      [C.dice, 'lucky', 1.7],
      [C.ghost, 'boo', 0.55],
      [C.duck, 'flip', 0.55],
      [C.blocks, 'topple', 0.9],
      [C.moon, 'wax', 1.6],
      [toast, 'pop', 0.35]
    ]
    const cols = tall ? 2 : 4
    const rows = 8 / cols
    const gap = 22 * u
    const left = tall ? 60 * u : SIDE.x - 40 * u
    const top = tall ? bottom + 70 * u : SIDE.y
    const cw = ((tall ? W - 120 * u : SIDE.w + 40 * u) - gap * (cols - 1)) / cols
    const ch = ((tall ? H - top - 130 * u : SIDE.h) - gap * (rows - 1)) / rows
    cells.forEach(([def, act, at], i) => {
      const x = left + (i % cols) * (cw + gap)
      const y = top + Math.floor(i / cols) * (ch + gap)
      g.fillStyle = TONES[def.id] ?? '#eee'
      rrect(x, y, cw, ch, 24 * u)
      g.fill()
      g.save()
      rrect(x, y, cw, ch, 24 * u)
      g.clip()
      const a = pose(def, act, at)
      draw(a, x + cw * (tall ? 0.64 : 0.5), y + ch * (tall ? 0.5 : 0.6), Math.min(ch * (tall ? 0.31 : 0.22), cw * 0.3))
      g.restore()
      const name = def.id === 'toast' ? (lang === 'zh' ? '吐吐' : 'Toasty') : def.name[lang]
      text(name, x + 26 * u, y + 52 * u, { size: 32 * u, weight: lang === 'zh' ? 600 : 800, align: 'left' })
      text(a.behaviors[act].label[lang], x + 26 * u, y + 92 * u, { size: 24 * u, weight: 500, color: MUTED, align: 'left' })
    })
    footer()
  },

  async code() {
    paper()
    const bottom = tall ? headline(COPY.code[lang], 190 * u, 92 * u) : wideHead('code', true)
    const x = tall ? 60 * u : SIDE.x
    const w = tall ? W - 120 * u : SIDE.w
    const y = tall ? bottom + 90 * u : H / 2 - 290 * u
    const lines = ['<script type="module"', '  src="https://livelings', '  .makerjackie.com/livelings.js">', '</script>', '', '<live-ling', '  character="cloud"', '  state="thinking">', '</live-ling>']
    const lh = 50 * u
    const h = lines.length * lh + 110 * u
    g.fillStyle = INK
    rrect(x, y, w, h, 28 * u)
    g.fill()
    ;['#ff6b6b', '#ffd43b', '#51cf66'].forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.arc(x + 36 * u + i * 26 * u, y + 34 * u, 8 * u, 0, Math.PI * 2)
      g.fill()
    })
    g.font = `500 ${30 * u}px ${MONO}`
    lines.forEach((line, i) => {
      let cx = x + 44 * u
      const ly = y + 100 * u + i * lh
      for (const part of line.split(/("[^"]*"?|<\/?[\w-]+|>)/).filter(Boolean)) {
        g.fillStyle = part.startsWith('"') ? '#ffd866' : part.startsWith('<') || part === '>' ? '#8fd3ff' : '#efebe1'
        g.fillText(part, cx, ly)
        cx += g.measureText(part).width
      }
    })
    const a = pose(C.cloud, 'thinking', 1.2)
    draw(a, x + w - 170 * u, y + h - 210 * u, 110 * u)
    text(lang === 'zh' ? '没有依赖 · 约 40 KB' : 'No dependencies · ~40 KB', tall ? W / 2 : SIDE.cx, tall ? y + h + 80 * u : bottom + 90 * u, { size: 34 * u, weight: 600, color: MUTED })
    footer()
  },

  async skill() {
    paper(TONES.toast)
    if (!tall) {
      const bottom = wideHead('skill', true)
      const prompt = lang === 'zh' ? '用 livelings skill 给我的面包店做一个吉祥物' : 'Make a mascot for my bakery'
      g.font = `500 ${30 * u}px ${FONT}`
      const pw = g.measureText(prompt).width + 70 * u
      g.fillStyle = '#fffdf8'
      rrect(SIDE.cx - pw / 2, bottom + 60 * u, pw, 76 * u, 38 * u)
      g.fill()
      text(prompt, SIDE.cx, bottom + 109 * u, { size: 30 * u, weight: 500 })
      text(lang === 'zh' ? 'Claude Code / Codex' : 'for Claude Code and Codex', SIDE.cx, bottom + 200 * u, { size: 28 * u, weight: 600, color: MUTED })
      draw(pose(toast, 'pop', 0.24), SIDE.x + SIDE.w / 2, H * 0.52, 190 * u)
      return footer()
    }
    const bottom = headline(COPY.skill[lang], 190 * u, 92 * u)
    const prompt = lang === 'zh' ? '用 livelings skill 给我的面包店做一个吉祥物' : 'Make a mascot for my bakery'
    g.font = `500 ${32 * u}px ${FONT}`
    const pw = Math.min(W - 120 * u, g.measureText(prompt).width + 80 * u)
    g.save()
    g.shadowColor = 'rgba(60,45,10,0.18)'
    g.shadowBlur = 30 * u
    g.shadowOffsetY = 10 * u
    g.fillStyle = '#fffdf8'
    rrect(W / 2 - pw / 2, bottom + 80 * u, pw, 84 * u, 42 * u)
    g.fill()
    g.restore()
    text(prompt, W / 2, bottom + 134 * u, { size: 32 * u, weight: 500 })
    const a = pose(toast, 'pop', 0.24)
    draw(a, W / 2, H * 0.66, 200 * u)
    text(lang === 'zh' ? '活宝 Skill · Claude Code / Codex' : 'The Livelings skill · Claude Code / Codex', W / 2, H - 120 * u, { size: 32 * u, weight: 600, color: MUTED })
    footer()
  },

  async end() {
    paper()
    const bottom = headline(COPY.end[lang], 220 * u, 100 * u)
    const all = [...FAMILY, toast]
    const R = 64 * u
    all.forEach((def, i) => {
      const a = pose(def, 'happy', 0.4)
      const col = i % 4
      const row = Math.floor(i / 4)
      draw(a, W / 2 + (col - 1.5) * 210 * u, bottom + (230 + row * 250) * u, R)
    })
    const y = bottom + 820 * u
    text('livelings.makerjackie.com', W / 2, y, { size: 52 * u, weight: 800, font: BRAND })
    text('github.com/makerjackie/livelings', W / 2, y + 66 * u, { size: 32 * u, weight: 600, color: MUTED, font: BRAND })
    text(lang === 'zh' ? '代码 MIT · 角色 CC BY 4.0' : 'Code MIT · Characters CC BY 4.0', W / 2, y + 128 * u, { size: 28 * u, weight: 600, color: '#a39d90' })
    text(lang === 'zh' ? 'MakerJackie 出品' : 'by MakerJackie', W / 2, H - 70 * u, { size: 26 * u, weight: 600, color: '#a39d90' })
  }
}

await document.fonts.load(`800 40px "Bricolage Grotesque"`)
await document.fonts.load(`600 40px "Bricolage Grotesque"`)
await POSTERS[p]()
document.title = 'ready'
