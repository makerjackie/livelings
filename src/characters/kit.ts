import { TAU } from '../engine/math'
import type { Accessory, Physics, RenderCtx } from '../engine/types'
import type { Vec } from '../engine/math'

export const label = (en: string, zh: string) => ({ en, zh })

export function physics(over: Partial<Physics>): Physics {
  return {
    morphStiffness: 150,
    morphDamping: 14.5,
    softStiffness: 240,
    softDamping: 12,
    softSmoothing: 120,
    gravity: 12,
    hopPower: 3.4,
    bounce: 0,
    squashiness: 1,
    squashStiffness: 240,
    squashDamping: 10,
    floaty: false,
    hover: 0,
    eyeStiffness: 200,
    wobble: 0,
    breath: 0.025,
    stretch: 0.7,
    flutter: 0,
    ...over
  }
}

/** Draw in a frame sitting on the top of the head, tilted with the body. */
function onHead(r: RenderCtx, top: Vec, angle: number, draw: (g: CanvasRenderingContext2D, R: number) => void) {
  const g = r.g
  g.save()
  g.translate(top.x, top.y)
  g.rotate(angle)
  draw(g, r.R)
  g.restore()
}

const ink = (r: RenderCtx) => r.palette.outline ?? r.palette.mark ?? '#141414'

export const ACCESSORIES: Record<string, Accessory> = {
  sprout: {
    id: 'sprout',
    label: label('Sprout', '小芽'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        const sway = Math.sin(r.time * 2.1) * 0.12
        g.rotate(sway)
        g.strokeStyle = '#2f9e44'
        g.lineWidth = R * 0.06
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(0, R * 0.04)
        g.quadraticCurveTo(R * 0.02, -R * 0.14, 0, -R * 0.26)
        g.stroke()
        g.fillStyle = '#51cf66'
        for (const side of [-1, 1]) {
          g.save()
          g.translate(0, -R * 0.24)
          g.rotate(side * 0.9)
          g.beginPath()
          g.ellipse(side * R * 0.11, 0, R * 0.12, R * 0.06, 0, 0, TAU)
          g.fill()
          g.restore()
        }
      })
    }
  },
  bow: {
    id: 'bow',
    label: label('Bow', '蝴蝶结'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.translate(R * 0.28, R * 0.1)
        g.rotate(0.35)
        g.fillStyle = r.palette.accent
        g.strokeStyle = ink(r)
        g.lineWidth = Math.max(1, R * 0.03)
        for (const side of [-1, 1]) {
          g.beginPath()
          g.moveTo(0, 0)
          g.quadraticCurveTo(side * R * 0.2, -R * 0.2, side * R * 0.26, 0)
          g.quadraticCurveTo(side * R * 0.2, R * 0.2, 0, 0)
          g.fill()
          g.stroke()
        }
        g.beginPath()
        g.arc(0, 0, R * 0.06, 0, TAU)
        g.fill()
        g.stroke()
      })
    }
  },
  beret: {
    id: 'beret',
    label: label('Beret', '贝雷帽'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.rotate(-0.22)
        g.fillStyle = '#e03131'
        g.beginPath()
        g.ellipse(0, R * 0.04, R * 0.42, R * 0.15, 0, 0, TAU)
        g.fill()
        g.beginPath()
        g.arc(0, -R * 0.1, R * 0.05, 0, TAU)
        g.fill()
      })
    }
  },
  tuft: {
    id: 'tuft',
    label: label('Curl', '呆毛'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.rotate(Math.sin(r.time * 2.4) * 0.15)
        g.strokeStyle = r.palette.body
        g.lineWidth = R * 0.07
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(0, R * 0.04)
        g.bezierCurveTo(-R * 0.02, -R * 0.14, R * 0.02, -R * 0.26, R * 0.16, -R * 0.2)
        g.quadraticCurveTo(R * 0.25, -R * 0.11, R * 0.13, -R * 0.09)
        g.stroke()
      })
    }
  },
  crown: {
    id: 'crown',
    label: label('Crown', '小皇冠'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.rotate(0.18)
        g.fillStyle = '#fcc419'
        g.strokeStyle = ink(r)
        g.lineWidth = Math.max(1, R * 0.025)
        const w = R * 0.36
        const h = R * 0.22
        g.beginPath()
        g.moveTo(-w / 2, R * 0.04)
        g.lineTo(-w / 2, -h)
        g.lineTo(-w / 4, -h * 0.45)
        g.lineTo(0, -h * 1.15)
        g.lineTo(w / 4, -h * 0.45)
        g.lineTo(w / 2, -h)
        g.lineTo(w / 2, R * 0.04)
        g.closePath()
        g.fill()
        g.stroke()
      })
    }
  },
  flower: {
    id: 'flower',
    label: label('Flower', '小花'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.translate(-R * 0.26, R * 0.08)
        g.rotate(r.time * 0.4)
        g.fillStyle = '#fff'
        g.strokeStyle = ink(r)
        g.lineWidth = Math.max(1, R * 0.022)
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU
          g.beginPath()
          g.arc(Math.cos(a) * R * 0.09, Math.sin(a) * R * 0.09, R * 0.075, 0, TAU)
          g.fill()
          g.stroke()
        }
        g.fillStyle = '#fcc419'
        g.beginPath()
        g.arc(0, 0, R * 0.065, 0, TAU)
        g.fill()
      })
    }
  },
  cap: {
    id: 'cap',
    label: label('Party hat', '派对帽'),
    draw(r, top, angle) {
      onHead(r, top, angle, (g, R) => {
        g.translate(-R * 0.1, R * 0.06)
        g.rotate(-0.25)
        const w = R * 0.4
        const h = R * 0.48
        g.fillStyle = r.palette.accent
        g.strokeStyle = ink(r)
        g.lineWidth = Math.max(1, R * 0.03)
        g.lineJoin = 'round'
        g.beginPath()
        g.moveTo(-w / 2, 0)
        g.lineTo(0, -h)
        g.lineTo(w / 2, 0)
        g.closePath()
        g.fill()
        g.stroke()
        g.fillStyle = ink(r)
        g.beginPath()
        g.arc(0, -h - R * 0.05, R * 0.06, 0, TAU)
        g.fill()
      })
    }
  }
}

export const pickAccessories = (...ids: string[]) => ids.map((id) => ACCESSORIES[id])
