// Packs the Livelings skill: the engine bundle and the family's sources go in
// beside the docs and the workspace, then it is zipped for download.
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skill = join(root, 'skill', 'livelings')
const lib = join(root, 'dist', 'livelings.js')
if (!existsSync(lib)) throw new Error('build the library first (dist/livelings.js)')

cpSync(lib, join(skill, 'workspace', 'livelings.js'))
const examples = join(skill, 'reference', 'examples')
rmSync(examples, { recursive: true, force: true })
mkdirSync(examples, { recursive: true })
for (const f of ['cloud', 'inky', 'dice', 'ghost', 'duck', 'blocks', 'moon', 'kit']) cpSync(join(root, 'src', 'characters', `${f}.ts`), join(examples, `${f}.ts`))

// Toasty is written in TypeScript so the checker sees it; the workspace gets plain JS
const toast = readFileSync(join(root, 'src', 'examples', 'toast.ts'), 'utf8')
  .replace(/^import type .*\n/m, '')
  .replace("from '../index'", "from '../livelings.js'")
mkdirSync(join(skill, 'workspace', 'characters'), { recursive: true })
writeFileSync(join(skill, 'workspace', 'characters', 'toast.js'), stripTypeScriptTypes(toast, { mode: 'strip' }))

for (const out of [join(root, 'dist', 'livelings-skill.zip'), join(root, 'public', 'livelings-skill.zip')]) {
  rmSync(out, { force: true })
  execFileSync('zip', ['-qr', '-X', out, 'livelings', '-x', '*.DS_Store'], { cwd: join(root, 'skill') })
}
console.log('skill packed: dist/livelings-skill.zip')
