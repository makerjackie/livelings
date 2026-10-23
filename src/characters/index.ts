import type { CharacterDef } from '../engine/types'
import { blocks } from './blocks'
import { dice } from './dice'
import { cloud } from './cloud'
import { duck } from './duck'
import { ghost } from './ghost'
import { inky } from './inky'
import { moon } from './moon'

/** The family, in display order (the numbering on the site follows it). */
export const FAMILY: CharacterDef[] = [cloud, inky, dice, ghost, duck, blocks, moon]

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(FAMILY.map((c) => [c.id, c]))

export { blocks, cloud, dice, duck, ghost, inky, moon }
