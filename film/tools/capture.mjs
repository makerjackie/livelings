#!/usr/bin/env node
/**
 * Frame-exact footage of web pages: the real Livelings site and the scene page.
 *
 *   node tools/capture.mjs --lang zh --only home,play
 *   node tools/capture.mjs --lang en --all
 *   node tools/capture.mjs --list
 *
 * Time is virtual. Playwright's clock freezes rAF, timers, Date and
 * performance.now; each frame advances it by exactly 1/fps, then every CSS
 * animation and transition is seeked to the same virtual time (they run on
 * the compositor's own clock otherwise), videos are seeked too, and the frame
 * is grabbed with CDP. So the footage is perfectly smooth whatever a frame
 * costs to render. A drawn cursor follows the real (synthetic) pointer.
 *
 * Shots come from tools/shots.mjs, timed against beats.json so that clicks
 * land on the music. Output: footage/<lang>/<id>.mp4 (+ .jpg contact sheet).
 * Pages are served by the Mascots dev server (:5280) and tools/serve.mjs (:5290).
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { narration, plan } from './shots.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const lang = opt('lang', 'zh')
const edit = opt('edit', 'short')
const fps = Number(opt('fps', 60))
const beats = JSON.parse(readFileSync(resolve(root, `edits/${edit}-beats.json`), 'utf8')).beats
const vo = edit === 'long' ? narration(JSON.parse(readFileSync(resolve(root, `public/voice/vo-${lang}.json`), 'utf8'))) : null
const all = plan({ edit, lang, beats, vo }).shots.map((s) => ({ ...s, duration: s.end - s.at + 0.4 }))
if (flag('list')) {
  for (const s of all) console.log(`${s.id.padEnd(12)} ${s.at.toFixed(2).padStart(6)} → ${s.end.toFixed(2).padStart(6)}  ${s.url.slice(0, 90)}`)
  process.exit(0)
}
const only = opt('only')
const list = only ? only.split(',').map((id) => all.find((s) => s.id === id) ?? fail(`unknown shot ${id}`)) : flag('all') ? all : fail('pass --only a,b or --all')
function fail(m) {
  console.error(m)
  process.exit(1)
}
const outDir = resolve(root, 'footage', `${edit}-${lang}`)
mkdirSync(outDir, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: !flag('headed'),
  args: ['--no-proxy-server', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
})

/** A visible cursor: an arrow that follows pointer events, with an ink ring on press. */
const CURSOR = () => {
  const install = () => {
    if (document.getElementById('__cursor')) return
    const css = document.createElement('style')
    css.textContent = `
      html, body, * { cursor: none !important; }
      #__cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 30px; height: 30px; opacity: 0; transform-origin: 3px 2px; }
      #__cursor svg { display: block; width: 30px; height: 30px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.25)); }
      .__ring { position: fixed; z-index: 2147483646; pointer-events: none; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 3px solid rgba(23,22,20,.55); animation: __ring .45s ease-out forwards; }
      @keyframes __ring { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.25); opacity: 0 } }`
    document.head.append(css)
    const c = document.createElement('div')
    c.id = '__cursor'
    c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 2l15.5 11.2-6.6 1.1 3.9 7.3-3 1.5-3.9-7.4L3.9 20z" fill="#171614" stroke="#fffdf8" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.append(c)
    let x = 0, y = 0, down = false
    const place = () => (c.style.transform = `translate(${x - 3}px, ${y - 2}px) scale(${down ? 0.86 : 1})`)
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.style.opacity = '1'; place() }, true)
    addEventListener('pointerdown', (e) => {
      down = true
      place()
      const r = document.createElement('i')
      r.className = '__ring'
      r.style.left = `${e.clientX}px`
      r.style.top = `${e.clientY}px`
      document.body.append(r)
      setTimeout(() => r.remove(), 600)
    }, true)
    addEventListener('pointerup', () => { down = false; place() }, true)
  }
  if (document.body) install()
  else addEventListener('DOMContentLoaded', install)
}

/** Seek CSS animations/transitions and videos to virtual time. Runs after every clock step. */
const SYNC = (now) => {
  const w = window
  const seen = (w.__anims ??= new WeakMap())
  const prev = w.__prevNow ?? now
  w.__prevNow = now
  document.body.getBoundingClientRect() // flush style so new transitions exist
  for (const a of document.getAnimations()) {
    if (a.id === '__keep') continue
    let start = seen.get(a)
    if (start === undefined) {
      // born during the last step: give it that step's worth of progress
      start = prev
      seen.set(a, start)
    }
    const end = a.effect?.getComputedTiming().endTime ?? Infinity
    const t = (now - start) * (a.playbackRate || 1)
    if (Number.isFinite(end) && t >= end) {
      a.finish()
      continue
    }
    if (a.playState !== 'paused') a.pause()
    a.currentTime = t
  }
  let seeking = false
  for (const v of document.querySelectorAll('video')) {
    if (!v.src && !v.currentSrc) continue
    if (v.__start === undefined) v.__start = now
    if (!v.paused) v.pause()
    if (!(v.duration > 0)) continue
    const t = ((now - v.__start) / 1000) % v.duration
    if (Math.abs(v.currentTime - t) > 0.004) {
      v.currentTime = t
      seeking = true
    }
  }
  return seeking
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
async function sync(page) {
  const seeking = await page.evaluate(SYNC, await page.evaluate(() => performance.now()))
  if (!seeking) return
  for (let k = 0; k < 60; k++) {
    await sleep(15)
    if (!(await page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.seeking || v.readyState < 2)))) break
  }
}

const px = (v, total) => (v <= 1 ? v * total : v)
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

/** Centre of an element (or a point inside it, as fractions of its box), found when the move starts. */
async function aim(page, a) {
  const box = await page.evaluate(({ sel, text }) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => !text || (e.textContent + (e.getAttribute('aria-label') ?? '')).includes(text))
    const r = els[0]?.getBoundingClientRect()
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
  }, { sel: a.toSel, text: a.text })
  if (!box) throw new Error(`no element for ${a.toSel} ${a.text ?? ''}`)
  const [fx, fy] = a.at2 ?? [0.5, 0.5]
  return [box.x + box.w * fx, box.y + box.h * fy]
}

/** Pointer moves are interpolated per frame; everything else fires once at its time. */
function driver(page, actions, W, H) {
  const state = actions.map(() => ({ started: false, done: false }))
  let pos = [W * 0.5, H * 0.5]
  return async (t) => {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i]
      const s = state[i]
      if (s.done || t < a.at) continue
      const k = a.dur ? Math.min(1, (t - a.at) / a.dur) : 1
      if (a.type === 'move' || a.type === 'drag') {
        if (!s.started) {
          s.from = a.from ? [px(a.from[0], W), px(a.from[1], H)] : pos
          if (a.type === 'drag') {
            await page.mouse.move(...s.from)
            await page.mouse.down()
          }
          s.started = true
        }
        if (!s.to) s.to = a.toSel ? await aim(page, a) : [px(a.to[0], W), px(a.to[1], H)]
        const to = s.to
        const e = a.ease === 'linear' ? k : a.ease === 'out' ? easeOut(k) : ease(k)
        // a gentle arc, like a hand
        const bend = a.arc ?? 0.12
        const mx = (s.from[0] + to[0]) / 2 - (to[1] - s.from[1]) * bend
        const my = (s.from[1] + to[1]) / 2 + (to[0] - s.from[0]) * bend
        const q = (p0, p1, p2) => (1 - e) * (1 - e) * p0 + 2 * (1 - e) * e * p1 + e * e * p2
        pos = [q(s.from[0], mx, to[0]), q(s.from[1], my, to[1])]
        await page.mouse.move(pos[0], pos[1])
        if (k >= 1) {
          if (a.type === 'drag') await page.mouse.up()
          s.done = true
        }
      } else if (a.type === 'down') {
        await page.mouse.down()
        s.done = true
      } else if (a.type === 'up') {
        await page.mouse.up()
        s.done = true
      } else if (a.type === 'click') {
        await page.mouse.down()
        await page.mouse.up()
        s.done = true
      } else if (a.type === 'wheel') {
        const total = a.dy * (a.dur ? easeOut(k) : 1)
        const d = total - (s.sent ?? 0)
        if (Math.abs(d) >= 0.5) {
          await page.mouse.wheel(0, d)
          s.sent = total
        }
        if (k >= 1) s.done = true
      } else if (a.type === 'scroll') {
        // scroll the window directly (smooth, per frame), independent of the pointer
        const y = a.from + (a.to - a.from) * ease(k)
        await page.evaluate((y) => window.scrollTo(0, y), y)
        if (k >= 1) s.done = true
      } else if (a.type === 'eval') {
        await page.evaluate(a.js)
        s.done = true
      }
    }
  }
}

function encoder(out, W, H) {
  const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation',
    '-g', String(fps), '-movflags', '+faststart', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((ok, no) => p.on('close', (c) => (c === 0 ? ok() : no(new Error(`ffmpeg ${c}`)))))
  return {
    write: (b) => new Promise((ok) => (p.stdin.write(b) ? ok() : p.stdin.once('drain', ok))),
    end: async () => {
      p.stdin.end()
      await done
    }
  }
}

async function record(s) {
  const [W, H] = s.viewport ?? [1440, 810]
  const [OW, OH] = s.out ?? [1920, 1080]
  const scale = OW / W
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale, locale: lang === 'zh' ? 'zh-CN' : 'en-US', reducedMotion: 'no-preference' })
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('ms-lang', l)
    } catch {}
  }, lang)
  await ctx.addInitScript(CURSOR)
  await ctx.clock.install({ time: new Date('2026-10-23T10:00:00+08:00') })
  const page = await ctx.newPage()
  // new-headless Chrome only repaints what fits in its window (1440×810 including the
  // window frame here), leaving a stale strip at the bottom of every frame: make it bigger
  const cdp = await ctx.newCDPSession(page)
  const { windowId } = await cdp.send('Browser.getWindowForTarget')
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width: W + 300, height: H + 300 } })
  // resizing the window resets the emulated viewport (Playwright thinks it is unchanged)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: scale, mobile: false, screenWidth: W, screenHeight: H })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.clock.pauseAt(new Date('2026-10-23T10:00:01+08:00'))
  await page.goto(s.url, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  // scene pages say when they are ready (fonts, beats); poll from here, the page's own timers are frozen
  if (s.kind === 'scene') for (let k = 0; k < 200 && (await page.title()) !== 'ready'; k++) await sleep(50)
  if (s.css) await page.addStyleTag({ content: s.css })
  for (const st of s.setup ?? []) {
    if (st.eval) await page.evaluate(st.eval)
    if (st.run) await page.clock.runFor(st.run)
    if (st.move) await page.mouse.move(px(st.move[0], W), px(st.move[1], H))
    if (st.click) {
      const [x, y] = await aim(page, st.click)
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.up()
    }
    await sync(page)
  }
  await sync(page)
  const out = resolve(outDir, `${s.id}.mp4`)
  const enc = encoder(out, OW, OH)
  const drive = driver(page, s.actions ?? [], W, H)
  const total = Math.round(s.duration * fps)
  let sim = 0
  const t0 = Date.now()
  for (let i = 0; i < total; i++) {
    await drive(i / fps)
    const target = Math.round(((i + 1) * 1000) / fps)
    if (target > sim) {
      await page.clock.runFor(target - sim)
      sim = target
    }
    await sync(page)
    // the clip is in page coordinates, so it follows the scroll position
    const [sx, sy] = await page.evaluate(() => [scrollX, scrollY])
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true, clip: { x: sx, y: sy, width: W, height: H, scale } })
    await enc.write(Buffer.from(data, 'base64'))
    if (i % 120 === 0) process.stdout.write(`  ${s.id} ${i}/${total}\r`)
  }
  await enc.end()
  await ctx.close()
  const every = Math.max(1, Math.floor(total / 12))
  spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-vf', `select='not(mod(n\\,${every}))',scale=480:-2,tile=4x3:padding=4`, '-frames:v', '1', '-q:v', '4', resolve(outDir, `${s.id}.jpg`)])
  const meta = { id: s.id, lang, url: s.url, frames: total, fps, seconds: s.duration, took: (Date.now() - t0) / 1000, errors }
  writeFileSync(resolve(outDir, `${s.id}.json`), JSON.stringify(meta, null, 2))
  console.log(`[done] ${lang}/${s.id} ${total} frames in ${meta.took.toFixed(0)}s${errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ''}`)
}

for (const s of list) await record(s)
await browser.close()
