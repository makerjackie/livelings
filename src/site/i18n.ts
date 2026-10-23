import type { Text } from '../engine/types'

export type Lang = 'en' | 'zh'

const KEY = 'ms-lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    /* storage can be unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export let lang: Lang = initial()

export function setLang(next: Lang) {
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next === 'zh' ? 'zh-Hans' : 'en'
}

export const tx = (t: Text | undefined) => (t ? t[lang] : '')

const S = {
  tagline: { en: 'Open-source mascots that are alive', zh: '会动、会回应的开源吉祥物' },
  navCharacters: { en: 'Characters', zh: '图鉴' },
  navDocs: { en: 'Docs', zh: '文档' },
  soundOn: { en: 'Sound on', zh: '声音已开' },
  soundOff: { en: 'Sound off', zh: '声音已关' },

  homeTitle: { en: 'Mascots that are alive.', zh: '会动、会回应的吉祥物。' },
  homeSub: {
    en: 'Open-source characters drawn entirely in code. They think while your app thinks, cheer when it is done and sulk when it fails. Open one to try every move and copy three lines, or make your own with the Livelings skill.',
    zh: '开源的小角色，全部用代码画出来。你的 App 在思考，它也在思考；做完了它会欢呼，出错了它会沮丧。点开一个角色试遍它的动作，复制三行代码就能用；想要自己的，就用活宝 Skill 捏一个。'
  },
  together: { en: 'Everyone, at once', zh: '让大家一起演' },
  open: { en: 'Open workbench', zh: '打开工作台' },
  moves: { en: '{n} own moves', zh: '{n} 个专属动作' },
  upcoming: { en: 'Taking shape', zh: '正在成形' },
  upcomingLine: { en: 'The next one is still being made.', zh: '下一位还在捏。' },

  states: { en: 'States', zh: '状态' },
  statesHint: { en: 'loop until changed', zh: '一直循环' },
  reactions: { en: 'Reactions', zh: '反应' },
  reactionsHint: { en: 'play once', zh: '播一次' },
  own: { en: 'Only {name}', zh: '{name}专属' },
  idleMoves: { en: 'Idle moves', zh: '小动作' },
  livesIn: { en: 'Lives in', zh: '住在' },
  back: { en: 'All characters', zh: '图鉴' },
  prev: { en: 'Previous character', zh: '上一个角色' },
  next: { en: 'Next character', zh: '下一个角色' },

  hint: { en: 'Poke · drag · hold to pet', zh: '戳一下 · 拖一拖 · 按住摸摸' },
  auto: { en: 'Auto-play', zh: '自动演示' },
  stop: { en: 'Stop', zh: '停止' },
  png: { en: 'PNG', zh: 'PNG' },
  record: { en: 'Record 5s', zh: '录 5 秒' },
  recording: { en: 'Recording… {n}', zh: '录制中… {n}' },

  look: { en: 'Look', zh: '外观' },
  colors: { en: 'Colours', zh: '配色' },
  accessory: { en: 'Accessory', zh: '配饰' },
  seedHint: { en: 'any name, same look every time', zh: '任意名字，永远同一个样子' },
  morphHint: { en: 'all of them at once', zh: '全部一起变' },
  allTiles: { en: 'All {n}', zh: '全部 {n} 个' },
  gridHint: { en: 'Tap a tile to zoom in · drag to stretch', zh: '点任意一格放大 · 拖一拖试试' },
  showTitle: { en: 'Seen in real products', zh: '放进真实产品里' },
  showSub: {
    en: 'A mascot earns its place when it tells people what is happening. This is how it looks inside an app, a mini program and a website.',
    zh: '吉祥物最有用的时候，是它在告诉用户「现在发生了什么」。看看它在 App、小程序和网站里的样子。'
  },
  seed: { en: 'Seed', zh: '种子' },
  seedPlaceholder: { en: 'type a name', zh: '输入一个名字' },
  shuffle: { en: 'Random', zh: '随机' },
  none: { en: 'None', zh: '无' },
  variants: { en: 'Variants', zh: '变体' },
  morph: { en: 'Morph', zh: '变形' },
  morphPlaceholder: { en: 'type 1–3 characters', zh: '输入 1–3 个字符' },
  morphGo: { en: 'Become', zh: '变' },
  sizes: { en: 'Small sizes', zh: '小尺寸' },
  use: { en: 'Use it', zh: '使用' },
  copy: { en: 'Copy', zh: '复制' },
  copied: { en: 'Copied', zh: '已复制' },
  aiTab: { en: 'AI prompt', zh: '给 AI' },

  credits: {
    en: 'Code MIT · Characters CC BY 4.0 · Morphing idea from bloub (MIT)',
    zh: '代码 MIT · 角色 CC BY 4.0 · 变形思路来自 bloub（MIT）'
  },
  footerBy: { en: 'Made by MakerJackie', zh: 'MakerJackie 出品' },
  docsTitle: { en: 'Docs', zh: '文档' }
} satisfies Record<string, Text>

export type Key = keyof typeof S

export const t = (k: Key, vars: Record<string, string | number> = {}) =>
  S[k][lang].replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''))
