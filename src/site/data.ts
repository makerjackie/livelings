import { CHARACTERS, FAMILY } from '../characters'
import type { CharacterDef } from '../engine/types'

/** Stage tone behind each character on the site. */
export const TONES: Record<string, string> = {
  cloud: '#d9ecfb',
  inky: '#fbefc2',
  dice: '#e9e4f7',
  ghost: '#dfe3ec',
  duck: '#dcf1fb',
  blocks: '#fbe9d8',
  moon: '#e6e4f5'
}

/** Where a character already lives, if it has a public page. */
export const ORIGIN_URLS: Record<string, string> = {
  inky: 'https://apps.apple.com/app/id6788409678'
}

/** Empty slots on the home page: the family is still growing. */
export const UPCOMING = 1

export const LIB_URL = 'https://livelings.makerjackie.com/livelings.js'

export const findCharacter = (id: string): CharacterDef | undefined => CHARACTERS[id]

export const stampFor = (i: number) => `No.${String(i + 1).padStart(3, '0')}`

/** Where a character sits in the family, for numbering and the previous/next links. */
export function shelf(def: CharacterDef) {
  const i = FAMILY.indexOf(def)
  return { list: FAMILY, i, back: '/', stamp: stampFor(i) }
}
