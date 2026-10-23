import { FAMILY } from '../../characters'
import { Actor } from '../../engine/actor'
import { sounds } from '../../engine/sound'
import { TONES, UPCOMING, stampFor } from '../data'
import type { CharacterDef } from '../../engine/types'
import { fly, setOutgoing, takeReturning, type Slot } from '../fx'
import { lang, t, tx } from '../i18n'
import { mystery } from '../mystery'
import { renderShowcase } from '../showcase'
import { renderSkill } from '../skill'
import { Stage, type Placement } from '../stage'
import { strip } from '../strip'
import { h } from '../util'

/** What the "everyone at once" strip can ask for. */
const TOGETHER = ['thinking', 'working', 'waiting', 'done', 'error', 'love', 'sleep', 'celebrate']

const cardLayout = (w: number, hh: number): Placement[] => {
  const R = Math.min(w / 3.9, hh / 3.6)
  return [{ cx: w / 2, cy: hh * 0.8 - R, R }]
}

/**
 * Little scenes between neighbours while nobody is touching anything: one
 * acts, the others look over and react. Ids that are not in the family yet
 * are skipped, so this list can run ahead of the characters.
 */
const SKITS: Array<{ who: string; act: string; then: Array<[string, string, number]> }> = [
  { who: 'ghost', act: 'boo', then: [['inky', 'surprised', 0.55], ['dice', 'roll', 0.6], ['duck', 'squeak', 0.7], ['blocks', 'topple', 0.8], ['moon', 'eclipse', 0.9]] },
  { who: 'cloud', act: 'rain', then: [['inky', 'surprised', 0.9], ['duck', 'paddle', 1.1], ['inky', 'splash', 2.0]] },
  { who: 'dice', act: 'lucky', then: [['blocks', 'stack', 0.9], ['moon', 'twinkle', 1.0]] },
  { who: 'duck', act: 'quack', then: [['ghost', 'vanish', 0.5]] },
  { who: 'blocks', act: 'topple', then: [['dice', 'tumble', 0.5]] },
  { who: 'inky', act: 'stamp', then: [['cloud', 'surprised', 0.6], ['ghost', 'peekaboo', 0.7]] },
  { who: 'cloud', act: 'thunder', then: [['ghost', 'vanish', 0.3], ['duck', 'dive', 0.4], ['moon', 'eclipse', 0.5]] },
  { who: 'moon', act: 'wax', then: [['ghost', 'haunt', 1.2]] }
]

const plainActor = (a: Actor) => !a.seed && a.palette === a.def.palettes[0] && !a.accessory

/**
 * The character index: one live card per family member, numbered like a
 * collection, plus grey lumps still taking shape. Opening a card flies its
 * character into the workbench; coming back flies them home again.
 */
export interface IndexOptions {
  /** characters to show (the family by default) */
  list?: CharacterDef[]
  /** grey "taking shape" slots after them */
  upcoming?: number
  title?: string
  sub?: string
  /** the "seen in real products" and skill sections */
  showcase?: boolean
}

export function renderHome(app: HTMLElement, go: (href: string) => void, opts: IndexOptions = {}): () => void {
  const list = opts.list ?? FAMILY
  const cleanups: Array<() => void> = []
  const live: Stage[] = []
  const everyone: Stage[] = []
  const glancing = new Map<Stage, number>()
  const byId = new Map<string, Stage>()
  const back = takeReturning()
  let lastTouch = 0
  let leaving = false
  const touched = () => (lastTouch = performance.now())

  const glanceAt = (source: Stage) => {
    const r = source.canvas.getBoundingClientRect()
    const until = performance.now() + 1600
    for (const s of everyone) {
      if (s === source) continue
      glancing.set(s, until)
      s.lookAtClient(r.left + r.width / 2, r.top + r.height * 0.55)
    }
  }

  const root = h('div', { class: back ? 'home returning' : 'home' })

  const slotOf = (card: HTMLElement, stage: Stage, tone: string): Slot => {
    const box = card.querySelector('.card-stage')!.getBoundingClientRect()
    const r = stage.canvas.getBoundingClientRect()
    const p = stage.placement(0)!
    return { box: { x: box.left, y: box.top, w: box.width, h: box.height }, place: { cx: r.left + p.cx, cy: r.top + p.cy, R: p.R }, tone }
  }

  const cards = list.map((def, i) => {
    const tone = TONES[def.id] ?? '#f2eee4'
    const canvas = h('canvas', { 'aria-hidden': 'true' })
    const coming = back?.id === def.id ? back : null
    const first = coming && plainActor(coming.actors[0]) ? coming.actors[0] : new Actor(def, { fidget: true })
    first.fidget = true
    const stage = new Stage(canvas, [first], { layout: cardLayout, interactive: false, overlay: {} })
    live.push(stage)
    everyone.push(stage)
    byId.set(def.id, stage)
    cleanups.push(() => stage.destroy())
    const card = h(
      'article',
      { class: coming ? 'card landing' : 'card', style: `--tone:${tone};--i:${i}`, role: 'link', tabindex: '0', 'aria-label': `${tx(def.name)}: ${tx(def.tagline)}` },
      h('div', { class: 'card-stage' }, canvas, h('span', { class: 'stamp' }, stampFor(i)), h('span', { class: 'mat' }, tx(def.material))),
      h('div', { class: 'card-body' }, h('h2', {}, tx(def.name), h('small', {}, lang === 'zh' ? def.name.en : def.name.zh)), h('p', {}, tx(def.tagline)))
    )
    const open = () => {
      if (leaving || stage.paused) return
      leaving = true
      sounds.play(null, 'split')
      setOutgoing({ id: def.id, slot: slotOf(card, stage, tone), actor: stage.actors[0] })
      card.classList.add('chosen')
      root.classList.add('leaving')
      // the page fades out; so do the characters on the overlay, except the one leaving with its card
      for (const s of live) if (s !== stage) s.every((dt) => (s.alpha = Math.max(0, s.alpha - dt / 0.18)))
      window.setTimeout(() => go(`/c/${def.id}`), 190)
    }
    card.addEventListener('click', open)
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      open()
    })
    let greeted = -Infinity
    card.addEventListener('pointerenter', () => {
      if (stage.paused || stage.actors[0].state !== 'idle' || performance.now() - greeted < 5000) return
      greeted = performance.now()
      touched()
      stage.actors[0].play('hello')
      sounds.play(def, 'hello')
      glanceAt(stage)
    })
    if (coming) {
      stage.paused = true
      canvas.style.visibility = 'hidden'
      requestAnimationFrame(() =>
        fly({
          actors: coming.actors,
          from: () => coming.slots,
          to: () => [slotOf(card, stage, tone)],
          split: 'in',
          duration: 0.55,
          stagger: 0.012,
          radius: [14, 16],
          onLand: (k) => k === 0 && coming.actors[0].play('hello'),
          done: () => {
            stage.paused = false
            canvas.style.visibility = ''
            stage.render()
            card.classList.remove('landing')
          }
        })
      )
    }
    return card
  })

  const upcoming = Array.from({ length: opts.upcoming ?? UPCOMING }, (_, k) => {
    const canvas = h('canvas', { 'aria-hidden': 'true' })
    const stage = new Stage(canvas, [new Actor(mystery, { seed: String(k), fidget: false })], { layout: cardLayout, interactive: false })
    everyone.push(stage)
    cleanups.push(() => stage.destroy())
    return h(
      'article',
      { class: 'card locked', style: `--i:${list.length + k}`, 'aria-label': t('upcoming') },
      h('div', { class: 'card-stage' }, canvas, h('span', { class: 'stamp' }, `No.${String(list.length + k + 1).padStart(3, '0')}`), h('span', { class: 'mat' }, t('upcoming'))),
      h('div', { class: 'card-body' }, h('h2', {}, '???'), h('p', {}, t('upcomingLine')))
    )
  })

  /* skits while the visitor is just watching */
  let skit = 0
  const timers = new Set<number>()
  const later = (seconds: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      fn()
    }, seconds * 1000)
    timers.add(id)
  }
  const scene = window.setInterval(() => {
    if (document.hidden || performance.now() - lastTouch < 7000) return
    for (let tries = 0; tries < SKITS.length; tries++) {
      const s = SKITS[skit++ % SKITS.length]
      const lead = byId.get(s.who)
      if (!lead || lead.paused || lead.actors[0].state !== 'idle') continue
      lead.actors[0].play(s.act)
      sounds.play(lead.actors[0].def, s.act, { level: 0.7 })
      glanceAt(lead)
      for (const [who, act, delay] of s.then) {
        const other = byId.get(who)
        if (other) later(delay, () => other.actors[0].play(act))
      }
      break
    }
  }, 8000)
  cleanups.push(() => {
    window.clearInterval(scene)
    timers.forEach((id) => window.clearTimeout(id))
  })

  /* everyone at once, picked from tiny characters already doing it */
  let activeLoop = -1
  const probe = new Actor(list[0])
  const together = strip({
    items: TOGETHER.map((id, k) => ({ actor: new Actor(list[k % list.length], { fidget: false }), label: tx(probe.behaviors[id].label), action: id })),
    cols: TOGETHER.length,
    onPick(k) {
      touched()
      const id = TOGETHER[k]
      const loop = probe.behaviors[id].kind === 'loop'
      if (loop) activeLoop = activeLoop === k ? -1 : k
      const play = loop && activeLoop === -1 ? 'idle' : id
      live.forEach((s, i) => window.setTimeout(() => s.actors[0].play(play), i * 110))
      sounds.play(list[k % list.length], play)
      together.select(activeLoop >= 0 ? activeLoop : null)
    }
  })
  cleanups.push(() => together.destroy())

  /* leave the mouse alone for a while and they doze off; come back and they jump awake */
  let lastMove = performance.now()
  let asleep = false
  const doze = window.setInterval(() => {
    if (asleep || document.hidden || performance.now() - lastMove < 30000) return
    asleep = true
    live.forEach((s, i) => {
      later(i * 0.4, () => s.actors[0].play('yawn'))
      later(2.4 + i * 0.4, () => asleep && s.actors[0].play('sleep'))
    })
  }, 1000)
  cleanups.push(() => window.clearInterval(doze))
  const wake = () => {
    lastMove = performance.now()
    if (!asleep) return
    asleep = false
    together.select(null)
    activeLoop = -1
    live.forEach((s, i) =>
      later(i * 0.12, () => {
        s.actors[0].play('idle')
        s.actors[0].play('surprised')
      })
    )
  }

  /* click on empty paper: a drop of ink lands there and everyone jumps and looks */
  const onDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.top, .card, .show, .together, .skill-demo, a, button, input, video, pre')) return
    const drop = h('i', { class: 'ink-drop', style: `left:${e.pageX}px;top:${e.pageY}px` })
    document.body.append(drop)
    window.setTimeout(() => drop.remove(), 900)
    sounds.play(null, 'drop')
    touched()
    const until = performance.now() + 1500
    everyone.forEach((s) => {
      glancing.set(s, until)
      s.lookAtClient(e.clientX, e.clientY)
      const r = s.canvas.getBoundingClientRect()
      const far = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      later(Math.min(far / 2400, 0.5), () => {
        const a = s.actors[0]
        a.flash('surprised', 0.7)
        a.hop(0.45)
      })
    })
  }
  document.addEventListener('pointerdown', onDown)
  cleanups.push(() => document.removeEventListener('pointerdown', onDown))

  /* every character on the page watches the cursor */
  const onMove = (e: PointerEvent) => {
    wake()
    const now = performance.now()
    for (const s of everyone) if ((glancing.get(s) ?? 0) < now) s.lookAtClient(e.clientX, e.clientY)
  }
  const onLeave = () => everyone.forEach((s) => s.lookAtClient(null))
  document.addEventListener('pointermove', onMove)
  document.documentElement.addEventListener('pointerleave', onLeave)
  cleanups.push(() => {
    document.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
  })

  root.append(
    h(
      'section',
      { class: 'intro' },
      h('div', { class: 'intro-text' }, h('h1', {}, opts.title ?? t('homeTitle')), h('p', {}, opts.sub ?? t('homeSub'))),
      h('div', { class: 'together' }, h('span', { class: 'label' }, t('together')), together.el)
    ),
    h('section', { class: 'cards' }, ...cards, ...upcoming),
    ...(opts.showcase === false ? [] : [renderShowcase(cleanups), renderSkill(cleanups)]),
    h(
      'footer',
      { class: 'home-foot' },
      h('span', {}, t('credits')),
      h('span', {}, h('a', { href: '/docs', 'data-link': true }, t('navDocs')), ' · ', t('footerBy'))
    )
  )
  app.append(root)
  document.title = opts.title ? `${opts.title} · Livelings` : 'Livelings'
  return () => cleanups.forEach((c) => c())
}
