// Illustration cards: one idea, one character doing it, a few handwritten notes.
// card.html?spec=cards/example.json      (live, with export buttons)
// card.html?spec=cards/example.json&still=1   (one fixed frame, for screenshots)
import * as L from './livelings.js'

const q = new URLSearchParams(location.search)
const spec = await (await fetch(q.get('spec') ?? 'cards/example.json')).json()
const still = q.has('still')
if (still) document.body.classList.add('still')

let def = L.CHARACTERS[spec.character ?? 'inky']
if (!def && spec.character) {
  const mod = await import(spec.character)
  def = L.registerCharacter(mod.default ?? Object.values(mod)[0])
}
const W = spec.width ?? 1600
const H = spec.height ?? 900
const COLORS = { red: '#e03131', blue: '#1971c2', orange: '#f08c00', green: '#2f9e44', ink: '#171614' }
const HAND = '"Long Cang", "Noteworthy", "Segoe Print", "Ink Free", "Kaiti SC", "STKaiti", "KaiTi", cursive'
const SANS = 'ui-rounded, "SF Pro Rounded", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif'
const color = (c) => COLORS[c] ?? c ?? COLORS.red

const canvas = document.getElementById('card')
const dpr = still ? 1 : Math.min(devicePixelRatio || 1, 2)
canvas.width = W * dpr
canvas.height = H * dpr
canvas.style.width = `${Math.min(W, innerWidth - 20)}px`
const g = canvas.getContext('2d')

const actor = new L.Actor(def, { palette: spec.palette, fidget: false, seed: spec.seed })
const action = spec.action ?? 'idle'
actor.advance(0.3)
actor.play(action)
if (still) for (let k = 0; k < Math.round((spec.at ?? 0.8) * 120); k++) actor.advance(1 / 120)

const side = spec.side ?? 'right'
const R = H * 0.2 * (spec.scale ?? 1)
const charX = side === 'center' ? W / 2 : side === 'left' ? W * 0.27 : W * 0.73
const charY = H * (side === 'center' ? 0.66 : 0.62) - R * 0.2
const textX = side === 'left' ? W * 0.52 : W * 0.08
const textW = side === 'center' ? W * 0.84 : W * 0.44

/**
 * Title with **highlighted** parts. Breaks at "\n", otherwise wraps to the
 * width, preferring to break just after punctuation so phrases stay whole.
 */
function title(text, x, y, maxW, size) {
  g.font = `900 ${size}px ${SANS}`
  g.textBaseline = 'alphabetic'
  const chars = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap((p) => {
    const hi = p.startsWith('**')
    return [...p.replace(/\*\*/g, '')].map((c) => ({ c, hi, w: c === '\n' ? 0 : g.measureText(c).width }))
  })
  const lines = [[]]
  let width = 0
  for (const ch of chars) {
    const line = lines[lines.length - 1]
    if (ch.c === '\n') {
      lines.push([])
      width = 0
      continue
    }
    if (width + ch.w > maxW && line.length) {
      // carry the tail of the line over: back to the last punctuation if it is
      // close, and never split a Latin word
      const text = line.map((c) => c.c).join('')
      let cut = text.search(/[，、。：；！？,.:;!? ][^，、。：；！？,.:;!? ]{0,5}$/)
      if (cut < 0 && /[A-Za-z0-9'’-]$/.test(text) && /^[A-Za-z0-9'’-]/.test(ch.c)) cut = text.search(/ [^ ]*$/)
      const carry = cut >= 0 ? line.splice(cut + 1) : []
      lines.push(carry)
      width = carry.reduce((s, c) => s + c.w, 0)
    }
    lines[lines.length - 1].push(ch)
    width += ch.w
  }
  let cy = y
  lines.forEach((line, i) => {
    if (i) cy += size * 1.25
    let cx = x
    for (const ch of line) {
      if (ch.hi) {
        g.fillStyle = 'rgba(255, 212, 59, 0.9)'
        g.fillRect(cx - 1, cy - size * 0.32, ch.w + 2, size * 0.36)
      }
      cx += ch.w
    }
    cx = x
    g.fillStyle = '#171614'
    for (const ch of line) {
      g.fillText(ch.c, cx, cy)
      cx += ch.w
    }
  })
  return cy
}

/** A hand-drawn arrow: a slightly wobbly curve with an open head. */
function arrow(x0, y0, x1, y1, c) {
  const mx = (x0 + x1) / 2 + (y1 - y0) * 0.18
  const my = (y0 + y1) / 2 - (x1 - x0) * 0.18
  g.strokeStyle = c
  g.lineWidth = Math.max(2.5, W / 450)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x0, y0)
  g.quadraticCurveTo(mx, my, x1, y1)
  g.stroke()
  const ang = Math.atan2(y1 - my, x1 - mx)
  const len = W / 70
  g.beginPath()
  g.moveTo(x1 - Math.cos(ang - 0.45) * len, y1 - Math.sin(ang - 0.45) * len)
  g.lineTo(x1, y1)
  g.lineTo(x1 - Math.cos(ang + 0.45) * len, y1 - Math.sin(ang + 0.45) * len)
  g.stroke()
}

function prop(p) {
  const shape = L.namedShape(p.shape)
  const s = (p.size ?? 0.05) * W
  const path = new Path2D()
  shape.forEach((pt, i) => (i ? path.lineTo(p.x * W + pt.x * s, p.y * H + pt.y * s) : path.moveTo(p.x * W + pt.x * s, p.y * H + pt.y * s)))
  path.closePath()
  g.fillStyle = color(p.color ?? '#ffd43b')
  g.fill(path)
  g.strokeStyle = '#171614'
  g.lineWidth = Math.max(2, s * 0.06)
  g.lineJoin = 'round'
  g.stroke(path)
}

function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const bg = spec.background ?? 'paper'
  g.fillStyle = bg === 'paper' ? '#f7f3ea' : bg === 'white' ? '#ffffff' : bg
  g.fillRect(0, 0, W, H)
  if (bg === 'paper') {
    g.fillStyle = 'rgba(23,22,20,0.07)'
    for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) g.fillRect(x, y, 2, 2)
  }
  const size = (spec.titleSize ?? 0.058) * W
  let y = side === 'center' ? H * 0.16 : H * 0.3
  if (spec.title) y = title(spec.title, side === 'center' ? W * 0.08 : textX, y, textW, size)
  if (spec.subtitle) {
    g.font = `500 ${size * 0.42}px ${SANS}`
    g.fillStyle = '#6b665c'
    g.fillText(spec.subtitle, side === 'center' ? W * 0.08 : textX, y + size * 0.95)
  }
  for (const p of spec.props ?? []) prop(p)
  // floor shadow is part of the character; a soft spotlight sits behind it
  L.renderActor(g, actor, { cx: charX, cy: charY, R })
  for (const n of spec.notes ?? []) {
    const c = color(n.color)
    g.font = `${n.size ? n.size * W : W / 34}px ${HAND}`
    g.fillStyle = c
    g.textBaseline = 'middle'
    g.fillText(n.text, n.x * W, n.y * H)
    if (n.arrow) {
      const w = g.measureText(n.text).width
      const fromRight = n.arrow[0] > n.x
      arrow(n.x * W + (fromRight ? w + W * 0.01 : -W * 0.01), n.y * H, n.arrow[0] * W, n.arrow[1] * H, c)
    }
  }
  if (spec.credit !== false) {
    g.font = `500 ${W / 100}px ${SANS}`
    g.fillStyle = 'rgba(23,22,20,0.35)'
    g.textAlign = 'right'
    g.fillText(spec.credit ?? 'Livelings · livelings.makerjackie.com', W - W * 0.02, H - H * 0.03)
    g.textAlign = 'left'
  }
}

if (still) {
  await document.fonts.ready
  draw()
  document.title = 'ready'
} else {
  let wait = 0
  L.onFrame({
    visible: true,
    tick(dt) {
      actor.advance(dt)
      if (actor.behaviors[action].kind === 'once' && !actor.onceId && (wait -= dt) <= 0) {
        actor.play(action)
        wait = 1.2
      }
      draw()
    }
  })
}

const save = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
}
const base = (q.get('spec') ?? 'card').split('/').pop().replace(/\.json$/, '')
document.getElementById('png').onclick = () => canvas.toBlob((b) => save(b, `${base}.png`))
document.getElementById('rec').onclick = async () => {
  const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))
  const r = new MediaRecorder(canvas.captureStream(60), { mimeType: type, videoBitsPerSecond: 10_000_000 })
  const chunks = []
  r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  r.onstop = () => save(new Blob(chunks, { type }), `${base}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`)
  r.start()
  await new Promise((ok) => setTimeout(ok, 3000))
  r.stop()
}
