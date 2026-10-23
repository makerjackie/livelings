import toast from '../examples/toast'
import { createMascot } from '../engine/mascot'
import { lang, t } from './i18n'
import { copyText, h, highlight } from './util'

const L = (en: string, zh: string) => (lang === 'zh' ? zh : en)

export const SKILL_ZIP = '/livelings-skill.zip'

/** Where each agent looks for skills. */
const AGENTS: Array<[string, string]> = [
  ['Claude Code', '~/.claude/skills'],
  ['Codex', '~/.codex/skills']
]

const install = (dir: string) =>
  `mkdir -p ${dir} && cd ${dir}\ncurl -fsSLO https://livelings.makerjackie.com${SKILL_ZIP}\nunzip -o livelings-skill.zip && rm livelings-skill.zip`

/**
 * The Livelings skill: download it, drop it where your agent finds skills, ask
 * for a mascot. Toasty, made with it in one conversation, acts beside it.
 */
export function renderSkill(cleanups: Array<() => void>): HTMLElement {
  const pre = h('pre', { class: 'code' })
  const tabs = h('div', { class: 'tabs', role: 'tablist' })
  let agent = 0
  const copy = h('button', { class: 'btn small', type: 'button' }, t('copy'))
  const show = (k: number) => {
    agent = k
    pre.innerHTML = highlight(install(AGENTS[k][1]))
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === k)))
  }
  AGENTS.forEach(([name], k) => {
    const b = h('button', { type: 'button', role: 'tab' }, name)
    b.addEventListener('click', () => show(k))
    tabs.append(b)
  })
  copy.addEventListener('click', async () => {
    if (!(await copyText(install(AGENTS[agent][1])))) return
    copy.textContent = t('copied')
    window.setTimeout(() => (copy.textContent = t('copy')), 1400)
  })
  show(0)

  // Toasty goes through its day on its own; poke it and it answers
  const host = h('div', { class: 'skill-stage' })
  const m = createMascot(host, { character: toast, shadow: true, zoom: 0.7, fidget: true })
  const day = ['toastUp', 'pop', 'thinking', 'burn', 'idle', 'pop']
  let k = 0
  const step = window.setInterval(() => {
    if (document.hidden) return
    m.play(day[k++ % day.length])
  }, 2600)
  cleanups.push(() => {
    window.clearInterval(step)
    m.destroy()
  })

  const ask = L('Use the livelings skill to make a mascot for my bakery', '用 livelings skill 给我的面包店做一个吉祥物')
  return h(
    'section',
    { class: 'skill', id: 'skill' },
    h(
      'div',
      { class: 'skill-text' },
      h('span', { class: 'kind' }, L('Free · MIT', '免费 · MIT')),
      h('h2', {}, L('Make your own with the Livelings skill', '用「活宝 Skill」捏一个自己的')),
      h(
        'p',
        {},
        L(
          'A skill for Claude Code, Codex and other coding agents. Tell it what your product is: it proposes a few characters, writes the one you pick, and opens a studio where you can poke it and export PNGs, pose sheets and short videos. It can also turn an article into illustration cards starring any Liveling.',
          '给 Claude Code、Codex 等 AI 编程助手用的技能包。告诉它你的产品是什么：它先给几个角色方案，你挑中哪个就写出哪个，再打开工作台让你戳一戳，导出 PNG、动作表和短视频。它也能把一篇文章变成一组插画卡片，主角随便挑一只活宝。'
        )
      ),
      h(
        'ol',
        { class: 'skill-steps' },
        h(
          'li',
          {},
          h('b', {}, L('Download', '下载')),
          h('a', { class: 'download', href: SKILL_ZIP, download: 'livelings-skill.zip' }, 'livelings-skill.zip')
        ),
        h(
          'li',
          {},
          h('b', {}, L('Put it where your agent finds skills', '放进 AI 助手的 skills 目录')),
          h('div', { class: 'code-head' }, tabs, copy),
          pre,
          h('small', {}, L('Or paste the zip link to your agent and let it install itself.', '或者直接把下载链接丢给 AI 助手，让它自己装。'))
        ),
        h('li', {}, h('b', {}, L('Ask for one', '跟它说')), h('q', {}, ask))
      ),
      h(
        'p',
        { class: 'skill-more' },
        L('Want one made for you? ', '想让我帮你专门设计一个？'),
        h('a', { href: 'https://github.com/makerjackie', target: '_blank', rel: 'noopener' }, L('Say hi to MakerJackie ↗', '找 MakerJackie 聊聊 ↗'))
      )
    ),
    h(
      'figure',
      { class: 'skill-demo' },
      host,
      h(
        'figcaption',
        {},
        h('b', {}, L('Toasty', '吐吐 Toasty')),
        h('span', {}, L('Made with the skill in one conversation: a slice of bread that pops out when the work is done.', '用这个 Skill 一次对话做出来的：活干完了，它就从吐司机里弹出来。'))
      ),
      h(
        'div',
        { class: 'skill-card' },
        h('img', { src: L('/skill/card-inky-en.jpg', '/skill/card-inky.jpg'), alt: L('An illustration card made with the skill', '用 Skill 做的文章插画卡片'), loading: 'lazy', width: '800', height: '450' }),
        h('span', {}, L('…and article illustrations, with the same character every time.', '……也能给文章配插画，角色每张都一样。'))
      )
    )
  )
}
