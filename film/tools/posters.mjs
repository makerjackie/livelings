#!/usr/bin/env node
// Renders the launch stills (scenes/posters.js) into the launch package.
//   node tools/posters.mjs [zh|en]
// Needs tools/serve.mjs running, and scenes/shots/{home,grid}-<lang>.png
// (frames of the captured footage: home.mp4 at 2.6 s and 10.6 s).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, '../launch/2026-10-23-v2')
const langs = process.argv[2] ? [process.argv[2]] : ['zh', 'en']
const JOBS = {
  zh: [
    ...['cover', 'home', 'grid', 'tricks', 'code', 'skill', 'end'].map((p, i) => ({ p, w: 1080, h: 1440, file: `xhs/0${i + 1}.jpg` })),
    { p: 'cover', w: 1920, h: 1080, file: 'video/cover-zh-16x9.jpg' }
  ],
  en: [
    ...['cover', 'home', 'tricks', 'code', 'skill'].map((p, i) => ({ p, w: 1270, h: 760, file: `ph/0${i + 1}.jpg` })),
    { p: 'cover', w: 1920, h: 1080, file: 'video/cover-en-16x9.jpg' },
    { p: 'code', w: 1200, h: 1200, file: 'x/04-code.jpg' }
  ]
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-proxy-server', '--force-color-profile=srgb'] })
for (const lang of langs) {
  for (const job of JOBS[lang]) {
    const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:5290/posters.html?p=${job.p}&lang=${lang}&w=${job.w}&h=${job.h}`)
    await page.waitForFunction(() => document.title === 'ready', null, { timeout: 15000 })
    const file = resolve(out, job.file)
    mkdirSync(dirname(file), { recursive: true })
    await page.locator('canvas').screenshot({ path: file, type: 'jpeg', quality: 92 })
    console.log(`${lang} ${job.file}${errors.length ? ` errors: ${errors.join(' | ')}` : ''}`)
    await page.close()
  }
}
await browser.close()
