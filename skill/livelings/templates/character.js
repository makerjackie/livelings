// A new Liveling. Copy to livelings/characters/<id>.js, rename, and fill in.
// Read reference/design.md first; reference/api.md lists everything used here.
import { defineCharacter, label, physics, shapes, variant, at, every, sparkles, floatGlyph } from '../livelings.js'

/** The silhouette: bound to the thing it is, readable at 32 px. */
const body = () => shapes.squircle(4.5, 0.9)

export default defineCharacter({
  id: 'mine',
  name: label('Mine', '小家伙'),
  material: label('What it is made of', '它是什么做的'),
  tagline: label('Its whole personality in one line.', '一句话说清它的性格。'),
  bio: label('What it does when it works, finishes, fails and rests.', '它干活、完成、出错、休息时分别会做什么。'),
  traits: { en: ['Signature trick', 'Temper', 'Habit'], zh: ['招牌动作', '脾气', '小习惯'] },
  physics: physics({ squashiness: 1, hopPower: 3.4 }),
  eyes: { w: 0.16, h: 0.24, corner: 1, spacing: 0.56, lift: 0.04, topLid: 0, bottomLid: 0, tilt: 0, slant: 0, asym: 0 },
  eyeMode: 'ink',
  outlineWidth: 0.055,
  rest: body,
  shapes: {
    // its own versions of shapes the shared actions use
    wide: () => shapes.transform(body(), 1.2, 0.75, 0, 0.25),
    tall: () => shapes.transform(body(), 0.85, 1.2, 0, -0.2)
  },
  palettes: [
    { id: 'main', body: '#ffd43b', outline: '#3d2e05', eye: '#1f1a0e', accent: '#ff922b', mark: '#3d2e05' },
    { id: 'mint', body: '#b2f2bb', outline: '#163a1f', eye: '#0f2615', accent: '#40c057', mark: '#163a1f' }
  ],
  // effects: { glow: { rest: 0, stiffness: 60, damping: 10 } },
  // paintBody(r) { /* details inside the body */ },
  // react: { tap(a, n) { /* its own answer to a tap */ return true } },
  actions: {
    working: variant('working', {
      enter(a) {
        a.express('focused')
      },
      tick(a, t, dt) {
        if (every(t, dt, 0.5)) a.squish(2)
      },
      back: undefined,
      front: undefined
    }),
    done: variant('done', {
      enter(a) {
        a.express('proud')
        a.hop(0.9)
      },
      tick(a, t, dt) {
        if (at(t, dt, 0.4)) sparkles(a, 8)
      }
    }),
    trick: {
      kind: 'once',
      duration: 2,
      label: label('Its trick', '招牌动作'),
      enter(a) {
        a.express('excited')
        a.morph('star')
      },
      tick(a, t, dt) {
        if (at(t, dt, 1)) {
          a.morph('rest')
          floatGlyph(a, '!', 'glyph', a.palette.mark, 0.3)
        }
      }
    }
  },
  signature: ['trick'],
  fidgets: ['look-around', 'wiggle']
})
