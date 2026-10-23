// Dev-only contact sheet: /lab.html?c=cloud,inky&a=idle,done&t=0.4,1.2&size=180
import { CHARACTERS, FAMILY } from './characters'
import { Actor, STEP } from './engine/actor'
import { renderActor } from './engine/render'

const q = new URLSearchParams(location.search)
const chars = (q.get('c') ?? FAMILY.map((c) => c.id).join(',')).split(',')
const acts = (q.get('a') ?? 'idle').split(',')
const times = (q.get('t') ?? '0.6').split(',').map(Number)
const size = Number(q.get('size') ?? 180)
const seed = q.get('seed') ?? undefined
const grid = document.getElementById('grid')!
grid.style.gridTemplateColumns = `repeat(${acts.length * times.length}, ${size}px)`

for (const id of chars) {
  const def = CHARACTERS[id]
  if (!def) continue
  for (const act of acts) {
    for (const t of times) {
      const a = new Actor(def, { fidget: false, seed })
      a.advance(0.5)
      a.play(act)
      for (let k = 0; k < Math.round(t / STEP); k++) a.advance(STEP)
      const fig = document.createElement('figure')
      const c = document.createElement('canvas')
      const cap = document.createElement('figcaption')
      cap.textContent = `${id} · ${act} · ${t}s`
      fig.append(c, cap)
      grid.append(fig)
      const dpr = 2
      c.width = size * dpr
      c.height = size * dpr
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const R = size / 4.4
      renderActor(g, a, { cx: size / 2, cy: size * 0.68, R })
    }
  }
}
