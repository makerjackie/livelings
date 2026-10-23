// The two edits: shots from the shared plan, captions and every sound.
import longBeats from '../edits/long-beats.json'
import shortBeats from '../edits/short-beats.json'
import voZh from '../public/voice/vo-zh.json'
import { narration, plan } from '../tools/shots.mjs'

export const FPS = 60
export const f = (s: number) => Math.round(s * FPS)

export type Lang = 'zh' | 'en'
export type EditId = 'short' | 'long'

export interface Shot {
  id: string
  kind: 'site' | 'scene'
  at: number
  end: number
  url: string
}

export interface Caption {
  from: number
  to: number
  zh: string
  en: string
}

export interface Sfx {
  at: number
  src: string
  volume?: number
  /** start this many seconds into the file (an action that started before the cut) */
  trim?: number
}

export interface Edit {
  id: EditId
  lang: Lang
  duration: number
  shots: Shot[]
  captions: Caption[]
  sounds: Sfx[]
  music: string
  /** music volume over film time (narration ducks it) */
  musicVolume: (t: number) => number
  voice?: { src: string; at: number; length: number }
  /** caption look: big stickers for the short, subtitles for the narrated one */
  captionStyle: 'sticker' | 'subtitle'
}

const s = (at: number, src: string, volume = 0.6): Sfx => ({ at, src, volume })
/** a character's own sound (film/public/sfx/char, rendered from the site's recipes by tools/sounds.mjs) */
const c = (at: number, who: string, name: string, volume = 0.5, trim = 0): Sfx => (at < 0 ? { at: 0, src: `char/${who}-${name}`, volume, trim: trim - at } : { at, src: `char/${who}-${name}`, volume, trim })
const BEAT = shortBeats.period

/**
 * Long subtitles: each narration sentence split at its punctuation, using the
 * sentence text (which keeps the spaces around English words), timed by the
 * start of each piece's first word.
 */
function subtitles(json: typeof voZh, offset: number): Caption[] {
  const out: Caption[] = []
  for (const sentence of json.sentences) {
    const text: string = sentence.text
    if (!text.trim() || !sentence.words.length) continue
    // when each character of the text is spoken
    const when: Array<number | undefined> = new Array(text.length)
    let ptr = 0
    for (const w of sentence.words) {
      for (const ch of w.word) {
        const j = text.indexOf(ch, ptr)
        if (j < 0) continue
        when[j] = w.startTime
        ptr = j + 1
      }
    }
    const pieces: Array<{ from: number; zh: string }> = []
    let buf = ''
    let first = -1
    const flush = () => {
      const zh = buf.replace(/[，。：；、]+$/, '').trim()
      if (zh && first >= 0) {
        let k = first
        while (k > 0 && when[k] === undefined) k--
        pieces.push({ from: offset + (when[k] ?? sentence.words[0].startTime) - 0.12, zh })
      }
      buf = ''
      first = -1
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (first < 0 && ch.trim()) first = i
      buf += ch
      if (/[，。：；？！]/.test(ch)) flush()
    }
    flush()
    const endTime = offset + sentence.words.at(-1)!.endTime + 0.25
    pieces.forEach((p, i) => out.push({ from: p.from, to: i + 1 < pieces.length ? pieces[i + 1].from : endTime, zh: p.zh, en: '' }))
  }
  for (let i = 0; i < out.length - 1; i++) out[i].to = Math.min(out[i].to, out[i + 1].from)
  return out
}

export function buildEdit(id: EditId, lang: Lang): Edit {
  if (id === 'short') {
    const beats = shortBeats.beats
    const bar = (k: number, b = 0) => beats[4 * k + b] ?? beats.at(-1)! + BEAT
    const { shots, marks, duration } = plan({ edit: 'short', lang, beats, vo: null }) as unknown as { shots: Shot[]; marks: Record<string, any>; duration: number }
    const captions: Caption[] = [
      { from: 0.15, to: bar(1) - 0.05, zh: '**活宝** · 开源发布', en: '**Livelings** · open source' },
      { from: bar(1), to: bar(2) - 0.08, zh: '它们会**盯着你的鼠标**', en: 'They **watch your cursor**' },
      { from: bar(2), to: bar(3, 1) - 0.05, zh: '点开一个，**分成 16 个**', en: 'Open one, get **sixteen**' },
      { from: bar(3, 1), to: bar(5) - 0.05, zh: '放大，**随便挑动作**', en: 'Zoom in, **pick any move**' },
      { from: bar(5), to: bar(7) - 0.08, zh: '戳一戳、拖一拖、**挠痒痒**', en: 'Poke it, stretch it, **tickle it**' },
      { from: bar(7), to: bar(10) - 0.08, zh: '每个都有**自己的绝活**', en: 'Each one has **its own tricks**' },
      { from: bar(11), to: bar(13) - 0.08, zh: '**三行代码**，放进网页', en: '**Three lines** in your page' },
      { from: bar(13), to: bar(16) - 0.08, zh: '一句话，**捏一个你自己的**', en: 'One sentence, **your own mascot**' }
    ]
    const p = marks.prompt
    const T = (k: number) => marks.tricks[k] as number
    const sounds: Sfx[] = [
      s(0.02, 'stamp', 0.55),
      c(marks.hello, 'cloud', 'hello', 0.5),
      c(marks.cardClick, 'fx', 'split', 0.55),
      c(marks.zoom, 'fx', 'zoom', 0.45),
      c(marks.zoom + 0.05, 'cloud', 'rain', 0.4),
      c(marks.picks[0], 'cloud', 'thunder', 0.6),
      c(marks.picks[1], 'cloud', 'sunbathe', 0.45),
      c(marks.poke, 'cloud', 'tap', 0.55),
      c(marks.release, 'fx', 'release', 0.4),
      c(marks.release + 0.45, 'fx', 'land', 0.4),
      c(marks.tickle + 0.15, 'fx', 'love', 0.45),
      // the tricks, each with its own sound, from where the action started
      c(T(0), 'inky', 'stamp', 0.6),
      c(T(1) - 0.8, 'dice', 'lucky', 0.6),
      c(T(2) - 0.1, 'ghost', 'boo', 0.6),
      c(T(3) - 0.15, 'duck', 'flip', 0.6),
      c(T(4) - 0.35, 'blocks', 'topple', 0.6),
      c(T(5) - 0.9, 'moon', 'wax', 0.55),
      c(marks.family, 'fx', 'celebrate', 0.55),
      ...Array.from({ length: 12 }, (_, k) => s(marks.codeType[0] + k * ((marks.codeType[1] - marks.codeType[0]) / 12), 'sfx-mechanical-03', 0.16)),
      c(marks.codeAppear, 'cloud', 'hello', 0.5),
      c(marks.codeDone, 'cloud', 'done', 0.55),
      ...Array.from({ length: 10 }, (_, k) => s(p.from + k * ((p.to - p.from) / 10), 'sfx-mechanical-03', 0.2)),
      s(p.send, 'sfx-ui-01', 0.6),
      c(marks.ding - 0.01, 'toast', 'pop', 0.7),
      s(bar(15) - 0.02, 'whoosh', 0.35),
      s(marks.end - 0.02, 'sfx-transition-20', 0.45),
      s(marks.launch, 'stamp', 0.7),
      c(marks.cheer, 'fx', 'celebrate', 0.5),
      c(marks.finalHit, 'cloud', 'hello', 0.55)
    ]
    return { id, lang, duration, shots, captions, sounds, music: 'music/short.wav', musicVolume: () => 0.85, captionStyle: 'sticker' }
  }

  // long, narrated (Chinese)
  const vo = narration(voZh)
  const beats = longBeats.beats
  const { shots, marks, duration } = plan({ edit: 'long', lang, beats, vo }) as unknown as { shots: Shot[]; marks: Record<string, any>; duration: number }
  const V = marks.voice as number
  const VO_LEN = voZh.sentences.at(-1)!.words.at(-1)!.endTime + 0.2
  const p = marks.prompt
  const T = (k: number) => marks.tricks[k] as number
  const sounds: Sfx[] = [
    c(marks.teaserClick, 'fx', 'split', 0.5),
    c(marks.teaserSplit + 1.0, 'cloud', 'hello', 0.4),
    s(V - 0.02, 'stamp', 0.4),
    c(marks.hello, 'cloud', 'hello', 0.4),
    c(marks.inkDrop, 'fx', 'drop', 0.6),
    c(marks.cardClick, 'fx', 'split', 0.45),
    c(marks.zoom, 'fx', 'zoom', 0.4),
    c(marks.zoom + 0.05, 'cloud', 'rain', 0.3),
    c(marks.poke, 'cloud', 'tap', 0.45),
    c(marks.drag, 'fx', 'release', 0.35),
    c(marks.tickle + 0.15, 'fx', 'love', 0.35),
    c(T(0), 'inky', 'stamp', 0.5),
    c(T(1) - 0.1, 'dice', 'roll', 0.5),
    c(T(2), 'ghost', 'vanish', 0.45),
    c(T(3), 'duck', 'squeak', 0.5),
    c(T(4) - 0.1, 'moon', 'wax', 0.45),
    ...marks.cards.map((t: number) => s(t, 'sfx-ui-12', 0.35)),
    ...Array.from({ length: 10 }, (_, k) => s(marks.codeType[0] + k * ((marks.codeType[1] - marks.codeType[0]) / 10), 'sfx-mechanical-03', 0.12)),
    c(marks.codeAppear, 'cloud', 'hello', 0.4),
    c(marks.codeDone, 'cloud', 'done', 0.45),
    c(marks.codeError, 'cloud', 'error', 0.4),
    ...Array.from({ length: 14 }, (_, k) => s(p.from + k * ((p.to - p.from) / 14), 'sfx-mechanical-03', 0.16)),
    s(p.send, 'sfx-ui-01', 0.5),
    c(marks.ding - 0.01, 'toast', 'pop', 0.6),
    c(marks.ding2 - 0.01, 'toast', 'pop', 0.5),
    s(marks.end - 0.02, 'sfx-transition-20', 0.35),
    s(marks.launch, 'stamp', 0.5),
    c(marks.url, 'moon', 'twinkle', 0.35),
    c(marks.finalHit, 'cloud', 'hello', 0.45),
    c(marks.cheer, 'fx', 'celebrate', 0.4)
  ]
  const duck = (t: number) => {
    const inVo = Math.min(Math.max((t - (V - 0.4)) / 0.4, 0), 1) * Math.min(Math.max((V + VO_LEN + 0.3 - t) / 0.6, 0), 1)
    return 0.75 - 0.5 * inVo
  }
  return {
    id,
    lang,
    duration,
    shots,
    captions: subtitles(voZh, V),
    sounds,
    music: 'music/long.wav',
    musicVolume: duck,
    voice: { src: 'voice/vo-zh.wav', at: V, length: VO_LEN },
    captionStyle: 'subtitle'
  }
}
