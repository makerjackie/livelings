#!/usr/bin/env node
// Serves scenes/ on :5290 for capture, with CORS (the skill's card page on :5280
// fetches card specs from here). The engine comes straight from the Mascots
// build: run `pnpm skill` in the repo root first.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mascots = resolve(root, '..')
const MAP = {
  '/livelings.js': join(mascots, 'dist/livelings.js'),
  '/characters/toast.js': join(mascots, 'skill/livelings/workspace/characters/toast.js'),
  '/beats.json': join(root, 'beats.json'),
  '/cues.mjs': join(root, 'cues.mjs')
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = MAP[path] ?? join(root, 'scenes', normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''))
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'access-control-allow-origin': '*' })
    res.end('not found')
  }
}).listen(5290, () => console.log('scenes on http://localhost:5290'))
