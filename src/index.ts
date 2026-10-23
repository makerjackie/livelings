/**
 * Livelings (活宝) — open-source mascots that are alive: they react to your app and to you.
 * MIT licensed code; character designs CC BY 4.0. See LICENSE.
 */
import { CHARACTERS } from './characters'
import { Mascot, createMascot } from './engine/mascot'
import type { CharacterDef } from './engine/types'

export { Actor, STEP, type ActorOptions } from './engine/actor'
export { renderActor, smoothPath, type RenderOptions } from './engine/render'
export { Mascot, createMascot, onFrame, type MascotOptions } from './engine/mascot'
export { EXPRESSIONS, type ExpressionName, type Eyes } from './engine/eyes'
export { UNIVERSAL, UNIVERSAL_STATES, UNIVERSAL_EVENTS, EMOTIONS, FIDGETS } from './engine/behaviors'
export * as shapes from './engine/shapes'
export { named as namedShape } from './engine/library'
export type * from './engine/types'
export { FAMILY, CHARACTERS } from './characters'

// everything a character file needs, for making your own (see the Livelings skill)
export {
  at,
  every,
  sparkles,
  confetti,
  floatGlyph,
  sweat,
  steam,
  thoughtDots,
  badge,
  zzz,
  doneBadge,
  errorBadge,
  helpBadge,
  variant,
  markColor
} from './engine/behaviors'
export { TAU, clamp, lerp, mixHex, withAlpha, createRng, Spring } from './engine/math'
export { drawText, drawGlyph } from './engine/text'
export { label, physics, ACCESSORIES, pickAccessories } from './characters/kit'

/**
 * Add your own character, so `<live-ling character="yours">` and
 * `CHARACTERS.yours` find it. Returns the definition, for chaining.
 */
export function registerCharacter(def: CharacterDef): CharacterDef {
  CHARACTERS[def.id] = def
  document.querySelectorAll<LivelingElement>(`live-ling[character="${def.id}"]`).forEach((el) => el.refresh())
  return def
}

/** Identity helper: gives a character file type checking and editor hints. */
export const defineCharacter = (def: CharacterDef): CharacterDef => def

/**
 * `<live-ling character="inky" state="thinking" seed="ada">`
 *
 * Attributes: character, state, seed, palette, accessory ("none" for none),
 * mood, interactive ("false" to disable). Call `.play(id)` on the element for
 * one-shots.
 */
export class LivelingElement extends HTMLElement {
  static observedAttributes = ['character', 'state', 'seed', 'palette', 'accessory', 'mood']
  mascot: Mascot | null = null

  connectedCallback() {
    if (!this.style.display) this.style.display = 'inline-block'
    if (!this.style.width && !this.getAttribute('style')?.includes('width')) {
      this.style.width = '160px'
      this.style.height = '160px'
    }
    this.mount()
  }

  disconnectedCallback() {
    this.mascot?.destroy()
    this.mascot = null
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (!this.mascot || old === value) return
    if (name === 'state' && value) this.mascot.play(value)
    else if (name === 'mood') this.mascot.setMood((value as never) || null)
    else this.mount()
  }

  play(id: string) {
    return this.mascot?.play(id) ?? false
  }

  /** Re-create the mascot, e.g. after its character was registered. */
  refresh() {
    if (this.isConnected) this.mount()
  }

  private mount() {
    this.mascot?.destroy()
    const def = CHARACTERS[this.getAttribute('character') ?? 'cloud'] ?? CHARACTERS.cloud
    const accessory = this.getAttribute('accessory')
    this.mascot = createMascot(this, {
      character: def,
      seed: this.getAttribute('seed') ?? undefined,
      palette: this.getAttribute('palette') ?? undefined,
      accessory: accessory === 'none' ? null : (accessory ?? undefined),
      state: this.getAttribute('state') ?? undefined,
      interactive: this.getAttribute('interactive') !== 'false'
    })
    const mood = this.getAttribute('mood')
    if (mood) this.mascot.setMood(mood as never)
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('live-ling')) {
  customElements.define('live-ling', LivelingElement)
}
