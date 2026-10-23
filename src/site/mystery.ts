import { every } from '../engine/behaviors'
import { named } from '../engine/library'
import { label, physics } from '../characters/kit'
import type { CharacterDef } from '../engine/types'

const SHAPES = ['bean', 'egg', 'squircle', 'droplet', 'star', 'pebble', 'heart', 'moon']

/**
 * A family member that does not exist yet: a lump of grey clay, asleep,
 * slowly trying on shapes. Site only, not part of the library.
 */
export const mystery: CharacterDef = {
  id: 'mystery',
  name: label('???', '???'),
  material: label('Taking shape', '正在成形'),
  tagline: label('Still being made.', '还在捏。'),
  bio: label('', ''),
  traits: { en: [], zh: [] },
  physics: physics({ morphStiffness: 34, morphDamping: 8.5, wobble: 0.008, breath: 0.03 }),
  eyes: { w: 0.18, h: 0.26, corner: 1, spacing: 0.5, lift: 0.05, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  rest: () => named('bean'),
  palettes: [{ id: 'clay', body: '#e6e0d2', eye: '#bdb5a4', accent: '#bdb5a4', mark: '#bdb5a4' }],
  actions: {
    idle: {
      kind: 'loop',
      enter(a) {
        a.express('closed')
      },
      tick(a, t, dt) {
        if (every(t, dt, 2.8, 1.4)) a.morph(SHAPES[Math.floor(a.rand() * SHAPES.length)], { blink: false, squash: 1 })
      }
    }
  },
  signature: [],
  fidgets: []
}
