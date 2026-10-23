import type { Actor } from '../engine/actor'
import { drawText } from '../engine/text'
import { Stage } from './stage'
import { h } from './util'

export interface StripItem {
  actor: Actor
  /** shown under the cell */
  label?: string
  /** read out instead, when the cell speaks for itself */
  aria?: string
  /** an action this item keeps performing */
  action?: string
}

export interface Strip {
  el: HTMLElement
  select(i: number | null): void
  destroy(): void
}

const INK = '#171614'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif'

/**
 * Choices shown as tiny live characters instead of words: each cell is a
 * character already wearing the colour, the accessory, the shape or doing
 * the action you would pick. `cols` cells per row (wrapping), or a single
 * scrolling row when `row` is set. A scrolling row keeps its canvas the size
 * of the view and only draws the cells in sight, however long the row is.
 */
export function strip(o: { items: StripItem[]; cols?: number; row?: number; selected?: number | null; tone?: string; label?: string; onPick(i: number): void }): Strip {
  const n = o.items.length
  const labelH = o.items.some((x) => x.label) ? 15 : 0
  const canvas = h('canvas', { 'aria-hidden': 'true' })
  const track = h('div', { class: 'strip-track' }, canvas)
  const el = h('div', { class: o.row ? 'strip row' : 'strip' }, track)
  // keyboard and screen readers get real buttons laid over the cells
  const buttons = o.items.map((it, i) =>
    h('button', { type: 'button', class: 'strip-hit', 'aria-label': it.label ?? it.aria ?? `${o.label ?? ''} ${i + 1}`, onclick: () => o.onPick(i) })
  )
  track.append(...buttons)
  let scrollX = 0
  let selected = o.selected ?? null
  let hover = -1
  let cell = { w: 1, h: 1, cols: 1 }

  const geometry = (w: number) => {
    const cols = o.row ? n : Math.min(o.cols ?? n, n)
    const cw = o.row ? o.row : w / cols
    return { w: cw, h: cw * (o.row ? 0.92 : 0.86) + labelH, cols }
  }
  /** a cell in track coordinates */
  const cellAt = (i: number) => ({ x: (i % cell.cols) * cell.w, y: Math.floor(i / cell.cols) * cell.h, w: cell.w, h: cell.h })
  /** a cell in canvas coordinates (shifted by the scroll) */
  const boxOf = (i: number) => {
    const b = cellAt(i)
    return { ...b, x: b.x - scrollX }
  }
  const inView = (i: number) => {
    const b = boxOf(i)
    return b.x + b.w > 0 && b.x < el.clientWidth
  }
  const sizeCanvas = () => {
    const w = o.row ? n * o.row : el.clientWidth
    cell = geometry(w)
    const rows = Math.ceil(n / cell.cols)
    track.style.width = `${w}px`
    track.style.height = `${rows * cell.h}px`
    canvas.style.width = `${el.clientWidth}px`
    canvas.style.height = `${rows * cell.h}px`
    buttons.forEach((b, i) => {
      const bx = cellAt(i)
      b.style.cssText = `left:${bx.x}px;top:${bx.y}px;width:${bx.w}px;height:${bx.h}px`
    })
  }
  sizeCanvas()
  const ro = new ResizeObserver(() => sizeCanvas())
  ro.observe(el)

  const at = (x: number, y: number) => {
    const c = Math.floor((x + scrollX) / cell.w)
    const r = Math.floor(y / cell.h)
    const i = r * cell.cols + c
    return c >= 0 && c < cell.cols && i >= 0 && i < n ? i : -1
  }

  const waits = o.items.map(() => 0)
  const stage = new Stage(
    canvas,
    o.items.map((x) => x.actor),
    {
      layout: () =>
        o.items.map((_, i) => {
          if (!inView(i)) return { cx: 0, cy: 0, R: 0 }
          const b = boxOf(i)
          const body = b.h - labelH
          const R = Math.min(b.w, body) * 0.24
          return { cx: b.x + b.w / 2, cy: b.y + body * 0.78 - R, R, clip: { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4, r: 9 } }
        }),
      followPointer: true,
      shadow: false,
      paint(g) {
        o.items.forEach((it, i) => {
          if (!inView(i)) return
          const b = boxOf(i)
          if (i === selected || i === hover) {
            g.beginPath()
            g.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 9)
            g.fillStyle = i === selected ? (o.tone ?? 'rgba(23,22,20,0.08)') : 'rgba(23,22,20,0.04)'
            g.fill()
          }
          if (it.label) {
            drawText(g, it.label, b.x + b.w / 2, b.y + b.h - 6, {
              font: `${i === selected ? 600 : 500} 10.5px ${SANS}`,
              color: i === selected ? INK : 'rgba(23,22,20,0.55)',
              align: 'center',
              maxWidth: b.w - 6
            })
          }
        })
      },
      beforeTap(p) {
        const i = at(p.x, p.y)
        if (i >= 0) o.onPick(i)
        return true
      },
      cursor: (p) => (at(p.x, p.y) >= 0 ? 'pointer' : 'default'),
      onHover(p) {
        hover = p ? at(p.x, p.y) : -1
      }
    }
  )
  if (o.row) {
    el.addEventListener('scroll', () => {
      scrollX = el.scrollLeft
      canvas.style.left = `${scrollX}px`
      stage.relayoutNow()
    })
    // a mouse wheel scrolls the row sideways
    el.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
        el.scrollLeft += e.deltaY
        e.preventDefault()
      },
      { passive: false }
    )
  }

  // one-shots come round again, so every cell keeps showing its action
  o.items.forEach((it) => it.action && it.actor.play(it.action))
  stage.every((dt) => {
    o.items.forEach((it, i) => {
      const a = it.actor
      if (!it.action || a.behaviors[it.action]?.kind !== 'once' || a.onceId) return
      waits[i] -= dt
      if (waits[i] <= 0) {
        a.play(it.action)
        waits[i] = 0.7 + (i % 3) * 0.2
      }
    })
  })

  return {
    el,
    select(i) {
      selected = i
      buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    },
    destroy() {
      stage.destroy()
      ro.disconnect()
    }
  }
}
