// Livelings studio: sixteen live copies of one character, each doing something
// different. Open studio.html?char=./characters/yours.js (or ?id=inky).
import * as L from './livelings.js'

const q = new URLSearchParams(location.search)
let def
if (q.get('char')) {
  const mod = await import(q.get('char'))
  def = L.registerCharacter(mod.default ?? Object.values(mod)[0])
} else def = L.CHARACTERS[q.get('id') ?? 'inky'] ?? L.FAMILY[0]
let palette = q.get('palette') || undefined

const FILL = ['thinking', 'working', 'waiting', 'blocked', 'listening', 'sleep', 'done', 'error', 'love', 'celebrate', 'surprised', 'angry', 'sad', 'shy', 'excited', 'confused']
const probe = new L.Actor(def)
const actions = [...new Set([...def.signature, ...FILL])].filter((id) => probe.behaviors[id]).slice(0, 16)

document.title = `${def.name.en} · Livelings studio`
document.getElementById('name').textContent = `${def.name.zh} ${def.name.en}`
document.getElementById('tagline').textContent = def.tagline.zh || def.tagline.en
const select = document.getElementById('palette')
select.innerHTML = def.palettes.map((p) => `<option value="${p.id}">${p.id}</option>`).join('')
if (palette) select.value = palette
select.onchange = () => {
  palette = select.value
  build()
}

const canvas = document.getElementById('grid')
const g = canvas.getContext('2d')
let W = 1
let H = 1
let dpr = 1
let focus = null
let actors = []
let waits = []
let background = null

function build() {
  actors = actions.map(() => new L.Actor(def, { palette, fidget: false }))
  waits = actions.map(() => 0)
  actors.forEach((a, i) => a.play(actions[i]))
}

function boxes() {
  if (focus !== null) return actions.map((_, i) => (i === focus ? { x: 12, y: 12, w: W - 24, h: H - 24 } : null))
  const pad = 12
  const gap = 10
  const tw = (W - pad * 2 - gap * 3) / 4
  const th = (H - pad * 2 - gap * 3) / 4
  return actions.map((_, i) => ({ x: pad + (i % 4) * (tw + gap), y: pad + Math.floor(i / 4) * (th + gap), w: tw, h: th }))
}

const place = (b) => {
  const R = Math.min(b.w / 3.5, b.h / 3.3, W / 6.4, H / 5.6)
  return { cx: b.x + b.w / 2, cy: b.y + b.h * 0.8 - R, R }
}

function resize() {
  const r = canvas.getBoundingClientRect()
  dpr = Math.min(devicePixelRatio || 1, 2)
  W = Math.max(1, r.width)
  H = Math.max(1, r.height)
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
}
new ResizeObserver(resize).observe(canvas)
resize()

function draw() {
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, canvas.width, canvas.height)
  if (background) {
    g.fillStyle = background
    g.fillRect(0, 0, canvas.width, canvas.height)
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  boxes().forEach((b, i) => {
    if (!b) return
    g.save()
    g.beginPath()
    g.roundRect(b.x, b.y, b.w, b.h, 14)
    g.fillStyle = '#fffdf8'
    g.fill()
    g.clip()
    const label = `${actors[i].behaviors[actions[i]].label?.zh ?? ''}  ${actions[i]}`
    L.drawText(g, label, b.x + 12, b.y + b.h - 11, { font: '600 12px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif', color: '#6b665c' })
    L.renderActor(g, actors[i], place(b))
    g.restore()
  })
}

L.onFrame({
  visible: true,
  tick(dt) {
    actors.forEach((a, i) => {
      a.advance(dt)
      // one-shots come round again so every tile keeps showing its action
      if (a.behaviors[actions[i]].kind === 'once' && !a.onceId) {
        waits[i] -= dt
        if (waits[i] <= 0) {
          a.play(actions[i])
          waits[i] = 0.9
        }
      }
    })
    draw()
  }
})

/* ---------------------------------------------------------- pointer play */
const local = (e) => {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
const toBody = (i, p) => {
  const pl = place(boxes()[i])
  return { x: (p.x - pl.cx) / pl.R, y: (p.y - pl.cy) / pl.R }
}
const tileAt = (p) => boxes().findIndex((b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)
let down = null
let trail = []
canvas.addEventListener('pointermove', (e) => {
  const p = local(e)
  boxes().forEach((b, i) => b && actors[i].pointer(toBody(i, p)))
  if (down && down.grabbed !== null) {
    const q2 = toBody(down.grabbed, p)
    actors[down.grabbed].drag(q2)
    const t = performance.now() / 1000
    trail = [...trail.filter((s) => t - s.t < 0.12), { ...q2, t }]
  } else if (down && focus !== null && Math.hypot(p.x - down.x, p.y - down.y) > 8) {
    down.grabbed = focus
    actors[focus].grab(toBody(focus, { x: down.x, y: down.y }))
  }
})
canvas.addEventListener('pointerleave', () => actors.forEach((a) => a.pointer(null)))
canvas.addEventListener('pointerdown', (e) => {
  const p = local(e)
  down = { ...p, grabbed: null }
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointerup', (e) => {
  const p = local(e)
  if (down?.grabbed !== null && down) {
    const a = trail[0]
    const b = trail[trail.length - 1]
    actors[down.grabbed].release(a && b && b.t - a.t > 0.01 ? { x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) } : undefined)
  } else if (focus === null) {
    const i = tileAt(p)
    if (i >= 0) focus = i
  } else {
    const body = toBody(focus, p)
    if (Math.hypot(body.x, body.y) < 1.4) actors[focus].tap()
    else focus = null
  }
  down = null
  trail = []
})
addEventListener('keydown', (e) => e.key === 'Escape' && (focus = null))

/* --------------------------------------------------------------- exports */
function save(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

document.getElementById('png').onclick = () => canvas.toBlob((b) => save(b, `${def.id}.png`))

// every signature move and the key states, frozen mid-action, on a transparent sheet
document.getElementById('poses').onclick = () => {
  const ids = [...new Set(['idle', ...def.signature, 'thinking', 'working', 'done', 'error', 'love', 'sleep'])].filter((id) => probe.behaviors[id])
  const size = 320
  const cols = 4
  const sheet = document.createElement('canvas')
  sheet.width = cols * size
  sheet.height = Math.ceil(ids.length / cols) * size
  const sg = sheet.getContext('2d')
  ids.forEach((id, i) => {
    const a = new L.Actor(def, { palette, fidget: false })
    a.advance(0.4)
    a.play(id)
    for (let k = 0; k < 84; k++) a.advance(1 / 120)
    L.renderActor(sg, a, { cx: (i % cols) * size + size / 2, cy: Math.floor(i / cols) * size + size * 0.66, R: size / 4.4 })
  })
  sheet.toBlob((b) => save(b, `${def.id}-poses.png`))
}

const rec = document.getElementById('rec')
rec.onclick = async () => {
  if (rec.classList.contains('on')) return
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))
  background = '#f4f0e6'
  const r = new MediaRecorder(canvas.captureStream(60), { mimeType: type, videoBitsPerSecond: 12_000_000 })
  const chunks = []
  r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  r.onstop = () => {
    background = null
    rec.classList.remove('on')
    rec.textContent = '● Record 5s'
    save(new Blob(chunks, { type }), `${def.id}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`)
  }
  r.start()
  rec.classList.add('on')
  for (let n = 5; n > 0; n--) {
    rec.textContent = `Recording… ${n}`
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  r.stop()
}

build()
