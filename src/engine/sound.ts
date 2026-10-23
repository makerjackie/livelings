/**
 * Character sounds, synthesized with Web Audio: no files, nothing to load.
 *
 * A character lists its own sounds in `def.sounds`, keyed by action id plus
 * `tap`, `land`, `grab` and `hello`; anything it does not list falls back to
 * the shared defaults below. A recipe schedules tones and noise bursts on a
 * Synth, relative to "now", so a sound can land where its action lands (a
 * stamp hits at 0.5 s, a die settles at 0.85 s).
 *
 * Sound is off until something turns it on (`sounds.enabled = true`), a page
 * can mute it for good (`sounds.muted`), and a browser only starts audio after
 * a click or a key press, so the first gesture on the page unlocks it.
 */
import type { Actor } from './actor'
import type { CharacterDef } from './types'

export interface ToneSpec {
  /** start frequency, Hz */
  f: number
  /** glide to this frequency over the duration */
  to?: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** seconds from now */
  at?: number
  attack?: number
  /** [rate Hz, depth Hz] */
  vibrato?: [number, number]
  filter?: { type: BiquadFilterType; f: number; q?: number }
}

export interface NoiseSpec {
  dur: number
  gain?: number
  at?: number
  attack?: number
  type?: BiquadFilterType
  /** filter frequency, Hz, gliding to `to` */
  f?: number
  to?: number
  q?: number
}

/** Schedules sounds on an audio context; works on an OfflineAudioContext too (for video). */
export class Synth {
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    readonly now: number,
    private readonly noiseBuffer: AudioBuffer,
    /** overall loudness of this sound, 0..1 */
    readonly level = 1
  ) {}

  tone({ f, to, dur, type = 'sine', gain = 0.2, at = 0, attack = 0.005, vibrato, filter }: ToneSpec) {
    const { ctx } = this
    const t = this.now + at
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    if (vibrato) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = vibrato[0]
      depth.gain.value = vibrato[1]
      lfo.connect(depth).connect(o.frequency)
      lfo.start(t)
      lfo.stop(t + dur + 0.05)
    }
    let node: AudioNode = o
    if (filter) {
      const b = ctx.createBiquadFilter()
      b.type = filter.type
      b.frequency.value = filter.f
      b.Q.value = filter.q ?? 1
      o.connect(b)
      node = b
    }
    node.connect(this.envelope(t, dur, gain, attack))
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  noise({ dur, gain = 0.2, at = 0, attack = 0.003, type = 'bandpass', f = 1200, to, q = 1 }: NoiseSpec) {
    const { ctx } = this
    const t = this.now + at
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.setValueAtTime(f, t)
    if (to) b.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    b.Q.value = q
    src.connect(b).connect(this.envelope(t, dur, gain, attack))
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  private envelope(t: number, dur: number, gain: number, attack: number): GainNode {
    const env = this.ctx.createGain()
    const peak = Math.max(0.0002, gain * this.level)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + Math.min(attack, dur * 0.5))
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    env.connect(this.out)
    return env
  }
}

export type SoundRecipe = (s: Synth, detail: { strength?: number; taps?: number }) => void

/* ------------------------------------------------------------ building blocks */

/** MIDI note number to Hz (60 = middle C). */
export const note = (n: number) => 440 * 2 ** ((n - 69) / 12)

/** A short pitched blip, optionally gliding. */
export const blip = (s: Synth, f: number, to?: number, dur = 0.09, gain = 0.18, at = 0, type: OscillatorType = 'sine') => s.tone({ f, to, dur, gain, at, type })

/** Bell-like notes one after another. */
export function chime(s: Synth, notes: number[], gap = 0.07, gain = 0.12, at = 0, decay = 0.5) {
  notes.forEach((n, i) => {
    s.tone({ f: note(n), dur: decay, gain, at: at + i * gap, type: 'sine' })
    s.tone({ f: note(n) * 2.01, dur: decay * 0.5, gain: gain * 0.25, at: at + i * gap, type: 'sine' })
  })
}

/** A wooden knock. */
export function clack(s: Synth, f = 900, at = 0, gain = 0.2) {
  s.tone({ f, to: f * 0.8, dur: 0.06, gain, at, type: 'triangle' })
  s.noise({ dur: 0.025, gain: gain * 0.6, at, type: 'bandpass', f: f * 2.6, q: 4 })
}

/** A soft body landing. */
export function thud(s: Synth, at = 0, gain = 0.2, f = 150) {
  s.tone({ f, to: f * 0.45, dur: 0.12, gain, at })
  s.noise({ dur: 0.05, gain: gain * 0.3, at, type: 'lowpass', f: 600 })
}

/** Air moving: `from` and `to` are filter frequencies. */
export const whoosh = (s: Synth, from = 400, to = 2400, dur = 0.35, gain = 0.16, at = 0) => s.noise({ dur, gain, at, type: 'bandpass', f: from, to, q: 0.8, attack: dur * 0.4 })

/** Many small clicks spread over `span` seconds (rain, a rolling die). */
export function patter(s: Synth, n: number, span: number, f = 3500, gain = 0.07, at = 0, seed = 1) {
  let x = seed * 9301 + 49297
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < n; i++) s.noise({ dur: 0.018 + rand() * 0.02, gain: gain * (0.6 + rand() * 0.6), at: at + rand() * span, type: 'bandpass', f: f * (0.8 + rand() * 0.5), q: 3 })
}

/** A rubber squeak. */
export function squeak(s: Synth, at = 0, f = 1150, gain = 0.12) {
  s.tone({ f, to: f * 1.35, dur: 0.07, gain, at, type: 'square', filter: { type: 'bandpass', f: f * 1.6, q: 2.5 } })
  s.tone({ f: f * 1.3, to: f * 0.95, dur: 0.09, gain, at: at + 0.07, type: 'square', filter: { type: 'bandpass', f: f * 1.6, q: 2.5 } })
}

/** Water. */
export function splash(s: Synth, at = 0, gain = 0.16) {
  s.noise({ dur: 0.32, gain, at, type: 'lowpass', f: 2600, to: 500, q: 0.7 })
  for (let i = 0; i < 4; i++) s.tone({ f: 600 + i * 230, to: 1100 + i * 260, dur: 0.05, gain: gain * 0.35, at: at + 0.05 + i * 0.045 })
}

/* ------------------------------------------------------------ shared sounds */

export const DEFAULT_SOUNDS: Record<string, SoundRecipe> = {
  tap(s, { taps = 1 }) {
    if (taps >= 5) {
      s.tone({ f: 160, to: 120, dur: 0.35, gain: 0.12, type: 'sawtooth', filter: { type: 'lowpass', f: 600 } })
    } else if (taps === 3) {
      s.tone({ f: 700, to: 300, dur: 0.5, gain: 0.1, vibrato: [9, 60] })
    } else blip(s, 640 + taps * 60, 420, 0.08, 0.16)
  },
  land: (s, { strength = 0.5 }) => thud(s, 0, Math.min(0.22, 0.06 + strength * 0.12)),
  grab: (s) => blip(s, 420, 620, 0.07, 0.1),
  release: (s) => whoosh(s, 500, 1600, 0.2, 0.18),
  hello: (s) => {
    blip(s, note(76), note(81), 0.09, 0.12)
    blip(s, note(81), note(84), 0.1, 0.1, 0.1)
  },
  done: (s) => chime(s, [72, 76, 79, 84], 0.07, 0.11),
  celebrate: (s) => {
    chime(s, [72, 76, 79, 84, 88], 0.06, 0.1)
    patter(s, 10, 0.5, 5000, 0.06, 0.05, 3)
  },
  error: (s) => {
    s.tone({ f: note(64), dur: 0.16, gain: 0.12, type: 'triangle' })
    s.tone({ f: note(60), dur: 0.3, gain: 0.12, type: 'triangle', at: 0.17 })
  },
  surprised: (s) => blip(s, 500, 1100, 0.12, 0.12),
  happy: (s) => chime(s, [79, 84], 0.08, 0.09),
  love: (s) => s.tone({ f: note(76), to: note(72), dur: 0.5, gain: 0.08, vibrato: [5, 6] }),
  sad: (s) => s.tone({ f: note(67), to: note(60), dur: 0.6, gain: 0.08, type: 'triangle' }),
  angry: (s) => s.tone({ f: 140, to: 110, dur: 0.4, gain: 0.12, type: 'sawtooth', filter: { type: 'lowpass', f: 700 } }),
  yawn: (s) => s.tone({ f: 420, to: 260, dur: 0.8, gain: 0.06, vibrato: [4, 8] }),
  // page effects, played with `def` null
  drop: (s) => {
    blip(s, 1100, 320, 0.14, 0.16)
    splash(s, 0.03, 0.06)
  },
  split: (s) => {
    whoosh(s, 300, 3200, 0.45, 0.14)
    chime(s, [72, 79, 84, 91], 0.045, 0.06, 0.12, 0.4)
  },
  zoom: (s) => whoosh(s, 700, 2400, 0.28, 0.24)
}

/* ------------------------------------------------------------ player */

/** Page-wide sound: one audio context, a master level, and a little politeness. */
class SoundBoard {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private recent = new Map<string, number>()
  private listening = false
  private on = false
  /** the visitor's choice (a page's sound toggle); wins over anything that enables sound */
  muted = false
  /** 0..1 */
  volume = 0.6

  get enabled() {
    return this.on
  }

  set enabled(v: boolean) {
    this.on = v
    if (v) this.listen()
  }

  /** Play a character's sound by name (an action id, tap, land…), or a shared one with `def` null. */
  play(def: CharacterDef | null, name: string, detail: { strength?: number; taps?: number; level?: number } = {}) {
    if (!this.on || this.muted || !this.ctx || this.ctx.state !== 'running') return
    const recipe = def?.sounds?.[name] ?? DEFAULT_SOUNDS[name]
    if (!recipe) return
    const key = `${def?.id ?? ''}:${name}`
    const now = this.ctx.currentTime
    if (now - (this.recent.get(key) ?? -1) < 0.08) return
    this.recent.set(key, now)
    recipe(new Synth(this.ctx, this.master!, now + 0.01, this.noise!, detail.level ?? 1), detail)
  }

  private listen() {
    if (this.listening || typeof document === 'undefined') return
    this.listening = true
    const unlock = () => {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
        const comp = this.ctx.createDynamicsCompressor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.volume
        this.master.connect(comp).connect(this.ctx.destination)
        this.noise = makeNoise(this.ctx)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    }
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(ev, unlock, { capture: true, passive: true })
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }
}

export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

export const sounds = new SoundBoard()

/**
 * Let an actor make its sounds as things happen to it. `play` decides which
 * actions are heard (default: one-shots only, loops are too repetitive);
 * landings are only heard right after someone touched or threw it, so a grid
 * of characters hopping on their own stays quiet.
 */
export function listenTo(actor: Actor, opts: { play?: boolean | ((id: string) => boolean); touch?: boolean } = {}): () => void {
  let touched = -Infinity
  const playable = (id: string) => (typeof opts.play === 'function' ? opts.play(id) : opts.play !== false && actor.behaviors[id]?.kind === 'once')
  return actor.on((e) => {
    const def = actor.def
    if (e.type === 'tap') {
      touched = actor.time
      if (opts.touch !== false) sounds.play(def, 'tap', { taps: e.taps })
    } else if (e.type === 'grab' || e.type === 'release') {
      touched = actor.time
      if (opts.touch !== false) sounds.play(def, e.type)
    } else if (e.type === 'land') {
      if (actor.time - touched < 1.6) sounds.play(def, 'land', { strength: e.strength })
    } else if (e.type === 'play') {
      // a tap that answers with an action already made its sound
      if (actor.time - touched < 0.25) return
      if (playable(e.id)) sounds.play(def, e.id)
    }
  })
}
