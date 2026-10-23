// The edit: where each shot sits, the captions and every sound, all on the
// soundtrack's beat map (bar k = beat 1 + 4k).
import beatMap from '../beats.json'
import { CODE, PROMPT, typedAt } from '../cues.mjs'
import { PLACES } from '../tools/shots.mjs'

export const FPS = 60
const beats: number[] = beatMap.beats
const BEAT = beatMap.period

/** film time of bar k (fractional bars are quarter notes), plus b beats */
export const bar = (k: number, b = 0) => beats[1 + Math.round(4 * k) + b]
export const f = (s: number) => Math.round(s * FPS)

export const MUSIC_END = beatMap.duration
export const FILM_FRAMES = f(MUSIC_END + 0.6)

export type Lang = 'zh' | 'en'

/* ------------------------------------------------------------ shots */

export interface Shot {
  id: string
  at: number
  end: number
  /** slow push-in: scale at the start and the end, and where it pushes to */
  zoom?: [number, number]
  origin?: [number, number]
}

const ORDER = ['hook', 'states', 'title', 'home', 'play', 'tricks', 'showcase', 'code', 'pause', 'toasty', 'studio', 'card', 'end'] as const
const startOf = (id: string) => (id === 'hook' ? 0 : bar((PLACES as Record<string, number[]>)[id][0]))
const PUSH: Record<string, Pick<Shot, 'zoom' | 'origin'>> = {
  showcase: { zoom: [1, 1.07], origin: [0.45, 0.55] },
  studio: { zoom: [1, 1.05], origin: [0.3, 0.25] },
  card: { zoom: [1, 1.05], origin: [0.7, 0.55] }
}
export const SHOTS: Shot[] = ORDER.map((id, i) => ({
  id,
  at: startOf(id),
  end: i + 1 < ORDER.length ? startOf(ORDER[i + 1]) : MUSIC_END + 0.6,
  ...PUSH[id]
}))

/* ------------------------------------------------------------ captions */

/** `**word**` is highlighted. Times are film seconds. */
export interface Caption {
  from: number
  to: number
  zh: string
  en: string
}

export const CAPTIONS: Caption[] = [
  { from: bar(2, 1), to: bar(4), zh: '思考、出错、完成……', en: 'Thinking. Failing. Done.' },
  { from: bar(4), to: bar(6) - 0.12, zh: '每个状态，都**演**给你看', en: 'Every state, **acted out**' },
  { from: bar(8, 2), to: bar(10, 2), zh: '它们一直**盯着你的鼠标**', en: 'They **watch your cursor**' },
  { from: bar(10, 2), to: bar(12), zh: '点一下空白处，**全员吓一跳**', en: 'Click the page: **everyone jumps**' },
  { from: bar(12), to: bar(14), zh: '点开一个，**分成 16 个**', en: 'Open one: it **splits into sixteen**' },
  { from: bar(14), to: bar(16), zh: '每格演一个动作，**放大随便挑**', en: 'Each tile acts a move. **Zoom in, pick any.**' },
  { from: bar(16), to: bar(18), zh: '**戳一戳**，**拖一拖**', en: '**Poke it.** **Stretch it.**' },
  { from: bar(18), to: bar(20) - 0.12, zh: '挠一挠、连点几下，它都**有反应**', en: 'Tickle it, tap it: it **always answers**' },
  { from: bar(20, 1), to: bar(23), zh: '每一个，都有**自己的绝活**', en: 'Each one has **its own tricks**' },
  { from: bar(24), to: bar(26), zh: '放进**真实的产品**里', en: 'Inside **real products**' },
  { from: bar(26), to: bar(28) - 0.12, zh: '墨团习惯：**已上架 App Store**', en: 'Inky Habits: **live on the App Store**' },
  { from: bar(28, 1), to: bar(30) - 0.1, zh: '**三行代码**，放进你的网页', en: '**Three lines** in your page' },
  { from: bar(31.75) + 0.35, to: bar(35), zh: '**活宝 Skill**：一句话，捏一个你自己的', en: '**The Livelings skill**: one sentence, your own mascot' },
  { from: bar(35), to: bar(37) - 0.1, zh: '还能用它给**文章配插画**', en: 'It **illustrates your articles** too' }
]

/* ------------------------------------------------------------ sound */

export interface Sfx {
  at: number
  src: string
  volume?: number
}

const s = (at: number, src: string, volume = 0.6): Sfx => ({ at, src, volume })

export function soundsFor(lang: Lang): Sfx[] {
  const list: Sfx[] = [
    // the spinner turns into Inky
    s(bar(1) - 0.02, 'pop-5', 0.85),
    // status cards land, then each icon becomes a character
    s(bar(2), 'sfx-ui-12', 0.45),
    s(bar(2) + BEAT * 0.5, 'sfx-ui-12', 0.45),
    s(bar(2) + BEAT, 'sfx-ui-12', 0.45),
    s(bar(3) - 0.02, 'pop-3', 0.8),
    s(bar(4) - 0.02, 'pop-4', 0.8),
    s(bar(4) + 0.12, 'sfx-notification-02', 0.3),
    s(bar(5) - 0.02, 'pop-6', 0.8),
    s(bar(5) + 0.25, 'sfx-water-07', 0.45),
    // the name lands like a stamp; the family pops up one per beat, up a scale
    s(bar(6) - 0.02, 'stamp', 0.85),
    ...[1, 2, 3, 4, 5, 6, 7].map((k) => s(bar(6, k) - 0.01, `pop-${k}`, 0.7)),
    // home: a drop of ink, everyone jumps; a card opens and splits
    s(bar(10, 2), 'sfx-water-01', 0.9),
    s(bar(10, 2) + 0.12, 'sfx-impact-07', 0.4),
    s(bar(12) - 0.19, 'sfx-ui-01', 0.7),
    s(bar(12) - 0.05, 'sfx-transition-04', 0.55),
    s(bar(14), 'sfx-ui-01', 0.6),
    s(bar(14) + 0.02, 'sfx-transition-01', 0.4),
    s(bar(15), 'sfx-ui-01', 0.6),
    // play with Inky
    s(bar(16, 1), 'sfx-impact-07', 0.6),
    s(bar(17) + 0.9, 'sfx-impact-18', 0.55),
    s(bar(18) + 0.25, 'sfx-magic-14', 0.4),
    s(bar(19, 0), 'sfx-ui-01', 0.55),
    s(bar(19, 1), 'sfx-ui-01', 0.55),
    s(bar(19, 2), 'sfx-ui-01', 0.55),
    s(bar(19, 2) + 0.1, 'sfx-impact-18', 0.35),
    // tricks
    s(bar(20) - 0.02, 'whoosh', 0.45),
    s(bar(20) + 0.05, 'sfx-foley-15', 0.7),
    s(bar(20) + 0.35, 'sfx-transition-01', 0.5),
    s(bar(21) - 0.02, 'whoosh', 0.45),
    s(bar(21) + 0.25, 'sfx-foley-18', 0.55),
    s(bar(21) + 0.75, 'sfx-impact-11', 0.55),
    s(bar(22) - 0.02, 'whoosh', 0.45),
    s(bar(22) + 0.2, 'sfx-magic-14', 0.45),
    s(bar(22) + 0.45, 'sfx-impact-11', 0.4),
    s(bar(23) - 0.02, 'whoosh', 0.45),
    s(bar(23) + 0.5, 'stamp', 0.85),
    // products: a habit gets stamped
    s(bar(25) - 0.02, 'sfx-ui-01', 0.6),
    s(bar(25) + 0.35, 'stamp', 0.5),
    // code: keys while it types, a pop when the element appears, a chime on done
    ...CODE.flatMap((line) => {
      const out: Sfx[] = []
      for (let t = line.from * BEAT; t < line.to * BEAT - 0.05; t += 0.085) out.push(s(bar(28) + t, 'sfx-mechanical-03', 0.16))
      return out
    }),
    s(bar(29) - 0.02, 'pop-5', 0.75),
    s(bar(29, 2), 'sfx-notification-05', 0.55),
    // the pause: only the keys, then send; DING when the music comes back
    ...[...PROMPT[lang]].map((_, i) => s(bar(30) + typedAt(lang, i), 'sfx-mechanical-03', 0.3)),
    s(bar(30) + typedAt(lang, [...PROMPT[lang]].length) + 0.25, 'sfx-ui-01', 0.7),
    s(bar(31.75) - 0.01, 'ding', 0.95),
    s(bar(33) - 0.02, 'whoosh', 0.45),
    s(bar(35) - 0.02, 'sfx-transition-01', 0.45),
    // the end card
    s(bar(37) - 0.02, 'sfx-transition-20', 0.55),
    s(bar(37) + 0.1, 'sfx-magic-14', 0.5)
  ]
  return list
}
