#!/usr/bin/env node
// Renders every character sound (src/engine/sound.ts and each character's
// `sounds`) offline in Chrome, so the films use exactly what the site plays.
//   node tools/sounds.mjs        (needs the site dev server on :5280)
// → public/sfx/char/<character>-<name>.wav and fx-<name>.wav, plus a report.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/sfx/char')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-proxy-server'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:5280/lab.html', { waitUntil: 'load' })
const rendered = await page.evaluate(async () => {
  const L = await import('/src/index.ts')
  const toast = (await import('/src/examples/toast.ts')).default
  const RATE = 48000
  const jobs = []
  for (const def of [...L.FAMILY, toast]) for (const name of Object.keys(def.sounds ?? {})) jobs.push({ file: `${def.id}-${name}`, recipe: def.sounds[name] })
  for (const name of Object.keys(L.DEFAULT_SOUNDS)) jobs.push({ file: `fx-${name}`, recipe: L.DEFAULT_SOUNDS[name] })
  const results = []
  for (const job of jobs) {
    const ctx = new OfflineAudioContext(1, RATE * 3.5, RATE)
    const gain = ctx.createGain()
    gain.gain.value = 0.6
    gain.connect(ctx.destination)
    job.recipe(new L.Synth(ctx, gain, 0.005, (() => {
      const b = ctx.createBuffer(1, RATE, RATE)
      const d = b.getChannelData(0)
      let x = 12345
      for (let i = 0; i < d.length; i++) d[i] = ((x = (x * 1103515245 + 12345) % 2147483648) / 1073741824) - 1
      return b
    })(), 1), {})
    const buf = await ctx.startRendering()
    const d = buf.getChannelData(0)
    let last = 0
    let peak = 0
    let sum = 0
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i])
      if (v > 0.0005) last = i
      peak = Math.max(peak, v)
      sum += d[i] * d[i]
    }
    const n = Math.min(d.length, last + Math.round(RATE * 0.05))
    // every file peaks at the same level; the edit sets how loud each one is
    const norm = peak > 0 ? 0.7 / peak : 1
    for (let i = 0; i < n; i++) d[i] *= norm
    // 16-bit PCM WAV
    const bytes = new DataView(new ArrayBuffer(44 + n * 2))
    const str = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true)
    bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true)
    str(36, 'data'); bytes.setUint32(40, n * 2, true)
    for (let i = 0; i < n; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true)
    let bin = ''
    const u8 = new Uint8Array(bytes.buffer)
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
    results.push({ file: job.file, seconds: n / RATE, peak, rms: Math.sqrt(sum / d.length) * norm, wav: btoa(bin) })
  }
  return results
})
const report = []
for (const r of rendered) {
  writeFileSync(resolve(out, `${r.file}.wav`), Buffer.from(r.wav, 'base64'))
  report.push(`${r.file.padEnd(22)} ${r.seconds.toFixed(2)} s  peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}${r.peak < 0.01 ? '  ← silent?' : ''}`)
}
console.log(report.join('\n'))
console.log(`${rendered.length} sounds, ${errors.length ? `errors: ${errors.join(' | ')}` : 'no errors'}`)
await browser.close()
