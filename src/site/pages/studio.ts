import { FAMILY } from '../../characters'
import { listenTo, sounds } from '../../engine/sound'
import { Actor } from '../../engine/actor'
import { drawText } from '../../engine/text'
import { EMOTIONS, FIDGETS, UNIVERSAL_EVENTS, UNIVERSAL_STATES } from '../../engine/behaviors'
import type { CharacterDef } from '../../engine/types'
import { LIB_URL, ORIGIN_URLS, TONES, findCharacter, shelf } from '../data'
import { easeInOut, fly, paintTile, setReturning, takeOutgoing, wipe, type Box, type Slot } from '../fx'
import { lang, t, tx } from '../i18n'
import { Stage, type Placement } from '../stage'
import { strip, type Strip } from '../strip'
import { copyText, download, h, highlight } from '../util'

/** Everything a visitor can change about the character. */
interface Look {
  seed: string
  palette: string | null
  /** undefined: the seed decides; null: none */
  accessory: string | null | undefined
}

export interface Studio {
  select(id: string): void
  /** hand the characters over to the index for the flight home */
  leave(): void
  destroy(): void
}

const TILES = 16
const PAD = 12
const GAP = 10
/** room kept under a zoomed-in tile for the action film strip */
const FILM = 112
const REACTIONS = [...UNIVERSAL_EVENTS.filter((id) => id !== 'poked'), ...EMOTIONS]
const GRID_FILL = ['thinking', 'working', 'waiting', 'blocked', 'listening', 'sleep', 'done', 'error', 'love', 'celebrate', 'surprised', 'angry', 'sad', 'shy', 'excited', 'confused']
const MORPHS: Array<[string, string]> = [
  ['★', 'star'],
  ['♥', 'heart'],
  ['☾', 'moon'],
  ['7', 'text:7'],
  ['OK', 'text:OK'],
  ['?', 'text:?']
]
const SEEDS = ['ada', 'bao', 'cleo', 'dev', 'emi', 'fox', 'gus', 'hana', 'ivy', 'jun', 'kai', 'lea', 'max', 'nia', 'otto', 'pip', 'rio', 'sol', 'tao', 'uma', 'vic', 'wen', 'yan', 'zoe']

const unique = (ids: string[]) => [...new Set(ids)]

function readLook(): Look {
  const q = new URLSearchParams(location.search)
  const acc = q.get('accessory')
  return { seed: q.get('seed') ?? '', palette: q.get('palette'), accessory: acc === null ? undefined : acc === 'none' ? null : acc }
}

const isPlain = (l: Look) => !l.seed && !l.palette && l.accessory === undefined

function makeActor(def: CharacterDef, look: Look, extra: { palette?: string; accessory?: string | null } = {}) {
  return new Actor(def, {
    seed: look.seed || undefined,
    palette: extra.palette ?? look.palette ?? undefined,
    accessory: 'accessory' in extra ? extra.accessory : look.accessory,
    fidget: false
  })
}

export function renderStudio(app: HTMLElement, firstId: string, go: (href: string) => void): Studio {
  let def = findCharacter(firstId) ?? FAMILY[0]
  let look = readLook()
  let actions: string[] = []
  let picked = 0
  const cleanups: Array<() => void> = []
  const tone = () => TONES[def.id] ?? '#f4f0e6'

  /* ------------------------------------------------------------- the grid */
  const canvas = h('canvas', { class: 'grid-canvas' })
  const now = h('code', { class: 'now' })
  const allBtn = h('button', { class: 'btn small back-grid', type: 'button', onclick: () => unfocus() })
  const hint = h('span', { class: 'hint' })
  const film = h('div', { class: 'film' })
  const wrap = h('div', { class: 'grid-wrap' }, canvas, h('div', { class: 'grid-top' }, allBtn, now), film)

  let focus: number | null = null
  let camTile = 0
  let cam = 0
  let camTarget = 0
  let hover = -1
  let shownCode = ''
  let unhear: Array<() => void> = []
  let boxes: Box[] = []
  const waits: number[] = []

  const baseBoxes = (w: number, hh: number, n: number): Box[] => {
    const cols = 4
    const rows = Math.max(1, Math.ceil(n / cols))
    const tw = (w - PAD * 2 - GAP * (cols - 1)) / cols
    const th = (hh - PAD * 2 - GAP * (rows - 1)) / rows
    return Array.from({ length: n }, (_, i) => ({ x: PAD + (i % cols) * (tw + GAP), y: PAD + Math.floor(i / cols) * (th + GAP), w: tw, h: th }))
  }

  /** The camera: 0 shows the whole grid, 1 fills the view with one tile. */
  const camera = (base: Box[], w: number, hh: number): Box[] => {
    if (cam <= 0.0001 || !base[camTile]) return base
    const f = base[camTile]
    const e = easeInOut(cam)
    const room = { w: w - PAD * 2, h: hh - PAD * 2 - FILM }
    const Z = Math.min(room.w / f.w, room.h / f.h)
    const zoom = 1 + (Z - 1) * e
    const cx = w / 2 + (f.x + f.w / 2 - w / 2) * e
    const cy = hh / 2 + (f.y + f.h / 2 - hh / 2) * e
    const sy = hh / 2 + (PAD + room.h / 2 - hh / 2) * e
    return base.map((b) => ({ x: (b.x - cx) * zoom + w / 2, y: (b.y - cy) * zoom + sy, w: b.w * zoom, h: b.h * zoom }))
  }

  const placeIn = (b: Box, w: number, hh: number): Placement => {
    const R = Math.min(b.w / 3.5, b.h / 3.3, w / 6.4, hh / 5.6)
    return { cx: b.x + b.w / 2, cy: b.y + b.h * 0.8 - R, R, clip: { ...b, r: 14 } }
  }

  const tileAt = (x: number, y: number) => boxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)

  const stage = new Stage(canvas, [], {
    layout(w, hh, n) {
      boxes = camera(baseBoxes(w, hh, n), w, hh)
      return boxes.map((b) => placeIn(b, w, hh))
    },
    followPointer: true,
    overlay: { margin: 56 },
    paint(g, w, hh) {
      boxes.forEach((b, i) => {
        if (b.x > w || b.y > hh || b.x + b.w < 0 || b.y + b.h < 0) return
        paintTile(g, b, tone(), { r: 14, shade: i === hover && focus === null ? 0.05 : 0 })
        const id = actions[i]
        const a = stage.actors[i]
        if (!id || !a) return
        if (b.w > 70) drawText(g, tx(a.behaviors[id]?.label), b.x + 12, b.y + b.h - 11, { font: '600 12px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif', color: '#171614', maxWidth: b.w - 24 })
        if (b.w > 150) drawText(g, id, b.x + b.w - 12, b.y + b.h - 11, { font: '500 10px ui-monospace, SFMono-Regular, Menlo, monospace', color: 'rgba(23,22,20,0.45)', align: 'right' })
      })
    },
    beforeTap(p, i) {
      if (focus === null) {
        const k = tileAt(p.x, p.y)
        if (k >= 0) zoomTo(k)
        return true
      }
      return i !== focus
    },
    cursor(p, i) {
      if (focus === null) return tileAt(p.x, p.y) >= 0 ? 'zoom-in' : 'default'
      return i === focus ? 'grab' : 'default'
    },
    onHover(p) {
      hover = p && focus === null ? tileAt(p.x, p.y) : -1
    }
  })
  cleanups.push(() => stage.destroy())
  cleanups.push(() => unhear.forEach((f) => f()))

  /** Each tile keeps performing its action: loops run on, one-shots come round again. */
  const playTile = (i: number) => {
    const a = stage.actors[i]
    if (a && actions[i]) a.play(actions[i])
    waits[i] = 0.9 + (i % 4) * 0.18
  }

  stage.every((dt) => {
    stage.actors.forEach((a, i) => {
      const id = actions[i]
      if (!id || a.behaviors[id]?.kind !== 'once' || a.onceId) return
      waits[i] -= dt
      if (waits[i] <= 0) playTile(i)
    })
    if (cam !== camTarget) {
      const step = dt / 0.55
      cam = camTarget > cam ? Math.min(camTarget, cam + step) : Math.max(camTarget, cam - step)
      stage.relayoutNow()
    }
    const k = focus ?? picked
    const a = stage.actors[k]
    const text = a ? `play('${a.state === 'idle' ? actions[k] : a.state}')` : ''
    if (text !== shownCode) now.textContent = shownCode = text
  })

  /** Where each tile is on screen, for flights in and out. */
  const slots = (): Slot[] => {
    const r = canvas.getBoundingClientRect()
    const { w, h: hh } = stage.size
    return camera(baseBoxes(w, hh, TILES), w, hh).map((b) => {
      const p = placeIn(b, w, hh)
      return { box: { x: r.left + b.x, y: r.top + b.y, w: b.w, h: b.h }, place: { cx: r.left + p.cx, cy: r.top + p.cy, R: p.R }, tone: tone() }
    })
  }

  function buildActors(reuse?: Actor) {
    const probe = makeActor(def, look)
    actions = unique([...def.signature, ...GRID_FILL]).filter((id) => probe.behaviors[id]).slice(0, TILES)
    stage.setActors(actions.map((_, i) => (i === 0 && reuse && isPlain(look) ? reuse : makeActor(def, look))))
    // sixteen tiles replaying their actions would be a din: they only make sounds when touched
    unhear.forEach((f) => f())
    unhear = stage.actors.map((a) => listenTo(a, { play: false }))
  }

  /** The grid bursts out of one character: out of a card on the index, or out of the middle. */
  function enter(from: Slot | null, reuse?: Actor) {
    buildActors(reuse)
    stage.paused = true
    canvas.style.visibility = 'hidden'
    const r = canvas.getBoundingClientRect()
    const R = Math.min(r.width / 7, r.height / 6)
    const start: Slot = from ?? {
      box: { x: r.left + r.width / 2 - R * 1.7, y: r.top + r.height / 2 - R * 1.6, w: R * 3.4, h: R * 3 },
      place: { cx: r.left + r.width / 2, cy: r.top + r.height / 2 - R * 0.2, R },
      tone: tone()
    }
    fly({
      actors: stage.actors,
      from: () => [start],
      to: slots,
      split: 'out',
      duration: from ? 0.62 : 0.5,
      stagger: 0.022,
      radius: [from ? 16 : 14, 14],
      onLand: (i) => playTile(i),
      done: () => {
        stage.paused = false
        canvas.style.visibility = ''
        stage.render()
      }
    })
  }

  /* ---------------------------------------------------------- zoom in/out */
  let filmStrip: Strip | null = null

  function zoomTo(k: number) {
    if (focus === null) {
      sounds.play(null, 'zoom')
      sounds.play(def, actions[k], { level: 0.8 })
    }
    focus = k
    camTile = k
    camTarget = 1
    picked = k
    hover = -1
    filmStrip?.destroy()
    const list = unique([...def.signature, ...UNIVERSAL_STATES, ...REACTIONS, ...FIDGETS]).filter((id) => stage.actors[k].behaviors[id])
    filmStrip = strip({
      items: list.map((id) => ({ actor: makeActor(def, look), label: tx(stage.actors[k].behaviors[id].label), action: id })),
      row: 78,
      tone: tone(),
      onPick(i) {
        actions[k] = list[i]
        playTile(k)
        sounds.play(def, list[i])
        filmStrip?.select(i)
        renderCode()
      }
    })
    filmStrip.select(list.indexOf(actions[k]))
    film.replaceChildren(filmStrip.el)
    renderCode()
    chrome()
  }

  function unfocus() {
    if (focus === null) return
    focus = null
    camTarget = 0
    filmStrip?.destroy()
    filmStrip = null
    film.replaceChildren()
    chrome()
  }
  cleanups.push(() => filmStrip?.destroy())

  /* ----------------------------------------------------------- left panel */
  const left = h('aside', { class: 'panel left' })
  const strips: Strip[] = []
  const clearStrips = () => strips.splice(0).forEach((s) => s.destroy())
  cleanups.push(clearStrips)

  const seedInput = h('input', { class: 'field', type: 'text', placeholder: t('seedPlaceholder'), 'aria-label': t('seed'), spellcheck: 'false', autocomplete: 'off' })
  seedInput.addEventListener('change', () => applyLook({ seed: seedInput.value.trim(), palette: null, accessory: undefined }))
  seedInput.addEventListener('keydown', (e) => e.key === 'Enter' && seedInput.blur())
  const dice = h('button', { class: 'btn icon', type: 'button', title: t('shuffle'), 'aria-label': t('shuffle') }, '⚄')
  dice.addEventListener('click', () => applyLook({ seed: SEEDS[Math.floor(Math.random() * SEEDS.length)] + Math.floor(Math.random() * 90 + 10), palette: null, accessory: undefined }))

  const morphInput = h('input', { class: 'field', type: 'text', maxlength: '3', placeholder: t('morphPlaceholder'), 'aria-label': t('morph') })
  const morph = (key: string) => {
    stage.actors.forEach((a, i) =>
      window.setTimeout(() => {
        a.holdShape(key, 2.6)
        a.hop(0.5)
      }, ((i % 4) + Math.floor(i / 4)) * 45)
    )
  }
  morphInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && morphInput.value.trim()) morph(`text:${morphInput.value.trim()}`)
  })

  type Tab = 'html' | 'js' | 'ai'
  let tab: Tab = 'html'
  const pre = h('pre', { class: 'code' })
  const tabs = h('div', { class: 'tabs', role: 'tablist' })
  const copyBtn = h('button', { class: 'btn small', type: 'button' }, t('copy'))
  copyBtn.addEventListener('click', async () => {
    if (await copyText(codeFor(tab))) {
      copyBtn.textContent = t('copied')
      window.setTimeout(() => (copyBtn.textContent = t('copy')), 1400)
    }
  })

  function codeFor(which: Tab): string {
    const id = actions[focus ?? picked] ?? 'idle'
    const loop = stage.actors[0]?.behaviors[id]?.kind === 'loop'
    if (which === 'html') {
      const attrs = [`character="${def.id}"`]
      if (look.seed) attrs.push(`seed="${look.seed}"`)
      if (look.palette) attrs.push(`palette="${look.palette}"`)
      if (look.accessory !== undefined) attrs.push(`accessory="${look.accessory ?? 'none'}"`)
      if (loop) attrs.push(`state="${id}"`)
      return (
        `<script type="module" src="${LIB_URL}"></script>\n\n` +
        `<live-ling ${attrs.join(' ')}\n  style="width:160px;height:160px"></live-ling>` +
        (loop ? '' : `\n\n<script>\n  document.querySelector('live-ling').play('${id}')\n</script>`)
      )
    }
    if (which === 'js') {
      const lines = [`character: CHARACTERS.${def.id},`]
      if (look.seed) lines.push(`seed: '${look.seed}',`)
      if (look.palette) lines.push(`palette: '${look.palette}',`)
      if (look.accessory !== undefined) lines.push(`accessory: ${look.accessory === null ? 'null' : `'${look.accessory}'`},`)
      return `import { createMascot, CHARACTERS } from '${LIB_URL}'\n\nconst m = createMascot(el, {\n${lines.map((l) => '  ' + l).join('\n')}\n})\nm.play('${id}')\n`
    }
    return AI_PROMPT
  }

  function renderCode() {
    tabs.replaceChildren(
      ...(['html', 'js', 'ai'] as Tab[]).map((id) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(id === tab),
            onclick: () => {
              tab = id
              renderCode()
            }
          },
          id === 'html' ? 'HTML' : id === 'js' ? 'JS' : t('aiTab')
        )
      )
    )
    pre.innerHTML = highlight(codeFor(tab))
  }

  const pngBtn = h('button', { class: 'btn small', type: 'button' }, t('png'))
  pngBtn.addEventListener('click', () => {
    // exports need the characters on the grid canvas itself, not on the page overlay
    stage.background = '#f4f0e6'
    stage.inline = true
    stage.render()
    canvas.toBlob((b) => b && download(b, `livelings-${def.id}.png`))
    stage.background = null
    stage.inline = false
  })
  const recBtn = h('button', { class: 'btn small rec', type: 'button', onclick: () => record() }, '● ' + t('record'))

  function renderLeft() {
    clearStrips()
    const { list, i, back, stamp } = shelf(def)
    const prev = list[(i + list.length - 1) % list.length]
    const next = list[(i + 1) % list.length]
    const probe = makeActor(def, look)
    const palettes = strip({
      items: def.palettes.map((p) => ({ actor: makeActor(def, look, { palette: p.id }) })),
      cols: Math.min(def.palettes.length, 6),
      tone: tone(),
      label: t('colors'),
      onPick: (k) => applyLook({ ...look, palette: def.palettes[k].id })
    })
    palettes.select(def.palettes.findIndex((p) => p.id === probe.palette.id))
    const accList: Array<string | null> = [null, ...(def.accessories ?? []).map((x) => x.id)]
    const accessories = strip({
      items: accList.map((id) => ({
        actor: makeActor(def, look, { accessory: id }),
        label: id === null ? t('none') : tx(def.accessories?.find((x) => x.id === id)?.label)
      })),
      cols: Math.min(accList.length, 5),
      tone: tone(),
      onPick: (k) => applyLook({ ...look, accessory: accList[k] })
    })
    accessories.select(accList.indexOf(probe.accessory?.id ?? null))
    const morphs = strip({
      items: MORPHS.map(([label, key]) => {
        const a = makeActor(def, look)
        a.holdShape(key, 1e9)
        return { actor: a, aria: label }
      }),
      cols: 6,
      tone: tone(),
      onPick: (k) => morph(MORPHS[k][1])
    })
    strips.push(palettes, accessories, morphs)
    const origin = def.origin
      ? h(
          'p',
          { class: 'origin' },
          `${t('livesIn')} `,
          ORIGIN_URLS[def.id] ? h('a', { href: ORIGIN_URLS[def.id], target: '_blank', rel: 'noopener' }, tx(def.origin)) : tx(def.origin)
        )
      : null
    seedInput.value = look.seed
    left.replaceChildren(
      h(
        'nav',
        { class: 'crumbs' },
        h('a', { href: back, 'data-link': true }, `← ${t('back')}`),
        h(
          'span',
          { class: 'pager' },
          h('span', { class: 'stamp' }, stamp),
          h('a', { href: `/c/${prev.id}`, 'data-link': true, title: t('prev'), 'aria-label': t('prev') }, '‹'),
          h('a', { href: `/c/${next.id}`, 'data-link': true, title: t('next'), 'aria-label': t('next') }, '›')
        )
      ),
      h(
        'div',
        { class: 'who' },
        h('h1', {}, tx(def.name), h('span', { class: 'material' }, tx(def.material))),
        h('p', { class: 'tagline' }, tx(def.tagline)),
        h('details', {}, h('summary', {}, def.traits[lang].join(' · ')), h('p', {}, tx(def.bio))),
        origin,
        hint
      ),
      h('section', {}, h('h2', {}, t('colors')), palettes.el),
      h('section', {}, h('h2', {}, t('accessory')), accessories.el),
      h('section', {}, h('h2', {}, t('morph'), h('small', {}, t('morphHint'))), morphs.el, h('div', { class: 'row', style: 'margin-top:6px' }, morphInput)),
      h('section', {}, h('h2', {}, t('seed'), h('small', {}, t('seedHint'))), h('div', { class: 'row' }, seedInput, dice)),
      h('section', {}, h('div', { class: 'code-head' }, h('h2', {}, t('use')), tabs, copyBtn), pre),
      h('section', { class: 'export' }, pngBtn, recBtn),
      h('p', { class: 'credits' }, t('credits'), ' · ', h('a', { href: '/docs#license', 'data-link': true }, t('navDocs')))
    )
  }

  /* ---------------------------------------------------------- recording */
  let recording = false
  async function record() {
    if (recording || typeof MediaRecorder === 'undefined' || !canvas.captureStream) return
    const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x))
    if (!type) return
    recording = true
    stage.background = '#f4f0e6'
    stage.inline = true
    const rec = new MediaRecorder(canvas.captureStream(60), { mimeType: type, videoBitsPerSecond: 12_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      stage.background = null
      stage.inline = false
      recording = false
      recBtn.textContent = '● ' + t('record')
      recBtn.classList.remove('on')
      download(new Blob(chunks, { type }), `livelings-${def.id}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`)
    }
    rec.start()
    recBtn.classList.add('on')
    for (let n = 5; n > 0; n--) {
      recBtn.textContent = t('recording', { n })
      await new Promise((r) => window.setTimeout(r, 1000))
    }
    rec.stop()
  }

  /* ------------------------------------------------------------ select */
  function applyLook(next: Look) {
    look = next
    const k = focus
    buildActors()
    stage.actors.forEach((_, i) => window.setTimeout(() => playTile(i), ((i % 4) + Math.floor(i / 4)) * 35))
    if (k !== null) zoomTo(k)
    renderLeft()
    renderCode()
    syncUrl()
  }

  function syncUrl() {
    const q = new URLSearchParams()
    if (look.seed) q.set('seed', look.seed)
    if (look.palette) q.set('palette', look.palette)
    if (look.accessory !== undefined) q.set('accessory', look.accessory ?? 'none')
    const query = q.toString()
    const url = `/c/${def.id}${query ? `?${query}` : ''}`
    if (location.pathname + location.search !== url) history.replaceState(null, '', url)
  }

  function chrome() {
    wrap.classList.toggle('focused', focus !== null)
    allBtn.textContent = `⊞ ${t('allTiles', { n: TILES })}`
    hint.textContent = t('gridHint')
    canvas.setAttribute('aria-label', `${tx(def.name)}: ${tx(def.tagline)}`)
    document.title = `${tx(def.name)} · Livelings`
  }

  function show(entry: Slot | null, reuse?: Actor) {
    focus = null
    cam = camTarget = 0
    picked = 0
    film.replaceChildren()
    filmStrip?.destroy()
    filmStrip = null
    renderLeft()
    chrome()
    enter(entry, reuse)
    renderCode()
    syncUrl()
  }

  /** Switching characters inside the workbench: a wipe shaped like them. */
  function select(id: string) {
    const next = findCharacter(id)
    if (!next) return
    if (next === def) {
      const l = readLook()
      if (JSON.stringify(l) !== JSON.stringify(look)) applyLook(l)
      return
    }
    const r = canvas.getBoundingClientRect()
    wipe({
      from: def,
      to: next,
      origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      cover: () => {
        def = next
        look = { seed: look.seed, palette: null, accessory: undefined }
        show(null)
      }
    })
  }

  /* ------------------------------------------------------------ keyboard */
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
    const { list, i } = shelf(def)
    if (e.key === 'Escape' && focus !== null) unfocus()
    else if (e.key === 'ArrowRight') go(`/c/${list[(i + 1) % list.length].id}`)
    else if (e.key === 'ArrowLeft') go(`/c/${list[(i + list.length - 1) % list.length].id}`)
    else return
    e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  cleanups.push(() => window.removeEventListener('keydown', onKey))

  app.append(h('div', { class: 'studio' }, left, wrap))
  const out = takeOutgoing(def.id)
  show(out?.slot ?? null, out?.actor)

  return {
    select,
    leave() {
      if (stage.paused) return
      stage.paused = true
      setReturning({ id: def.id, slots: slots(), actors: stage.actors })
    },
    destroy() {
      cleanups.forEach((c) => c())
    }
  }
}

export const AI_PROMPT = `Add a "Livelings" mascot to this project.
Source: https://livelings.makerjackie.com (MIT code, CC BY 4.0 characters).
- Load the web component from ${LIB_URL}
  or vendor the TypeScript engine (src/engine + src/characters, no dependencies).
- Characters: cloud (Puff), inky (Inky), dice (Pips), ghost (Boo), duck (Quack), blocks (Stacky), moon (Luna). Every character shares the same actions and adds its own.
- States (loop): idle, thinking, working, waiting, blocked, listening, sleep.
- Reactions (once): acknowledge, done, error, happy, excited, proud, love, surprised, shy, sad, angry, confused, nod, no, hello, celebrate.
- Wire them to real app events: request start -> thinking, streaming/tool use -> working,
  needs user input -> blocked, success -> done, failure -> error.
- If porting to another platform (SwiftUI, Compose, Flutter), keep the spring simulation
  (small sub-steps of at most 1/120 s) and the 96-point outline so transitions stay continuous.`
