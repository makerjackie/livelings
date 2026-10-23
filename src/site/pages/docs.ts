import { FAMILY } from '../../characters'
import { EMOTIONS, FIDGETS, UNIVERSAL, UNIVERSAL_EVENTS, UNIVERSAL_STATES } from '../../engine/behaviors'
import { SKILL_ZIP } from '../skill'
import { h, highlight } from '../util'
import { lang, tx } from '../i18n'

const L = (en: string, zh: string) => (lang === 'zh' ? zh : en)

function code(src: string) {
  const pre = h('pre', {})
  pre.innerHTML = highlight(src)
  return pre
}

function table(head: string[], rows: Array<Array<string | Node>>) {
  return h(
    'table',
    {},
    h('thead', {}, h('tr', {}, ...head.map((x) => h('th', {}, x)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, typeof c === 'string' ? html(c) : c)))))
  )
}

/** Inline `code` spans in plain strings. */
function html(text: string): Node {
  const span = h('span', {})
  span.innerHTML = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/`([^`]+)`/g, '<code>$1</code>')
  return span
}

const p = (en: string, zh: string) => h('p', {}, html(L(en, zh)))

export function renderDocs(app: HTMLElement): () => void {
  document.title = `${L('Docs', '文档')} · Livelings`
  const sections: Array<[string, string, Node[]]> = [
    [
      'install',
      L('Install', '安装'),
      [
        p(
          'The quickest way is the hosted web component. It is a single ES module with no dependencies, and it registers `<live-ling>` for you.',
          '最快的方式是直接引用托管的 Web Component：一个没有依赖的 ES 模块，引入后自动注册 `<live-ling>` 标签。'
        ),
        code(`<script type="module" src="https://livelings.makerjackie.com/livelings.js"></script>`),
        p(
          'To bundle it yourself, copy `src/engine` and `src/characters` into your project (TypeScript, MIT). An npm package will follow once the API settles.',
          '想自己打包的话，把 `src/engine` 和 `src/characters` 两个目录复制进项目即可（TypeScript，MIT）。等 API 稳定后会发布 npm 包。'
        )
      ]
    ],
    [
      'element',
      'Web Component',
      [
        table(
          [L('Attribute', '属性'), L('Values', '取值'), L('What it does', '作用')],
          [
            ['`character`', FAMILY.map((c) => `\`${c.id}\``).join(' '), L('Which family member.', '用哪个角色。')],
            ['`state`', L('any loop or one-shot id', '任意循环或一次性动作 id'), L('Loops become the state; one-shots play once and hand back.', '循环动作成为当前状态；一次性动作播放一次后回到原状态。')],
            ['`seed`', L('any string', '任意字符串'), L('Picks colours and an accessory. Same seed, same look.', '决定颜色和配饰。种子相同，样子就相同。')],
            ['`palette`', L('palette id', '配色 id'), L('Force a palette instead of the seed choice.', '指定配色，不用种子挑。')],
            ['`accessory`', L('accessory id or `none`', '配饰 id 或 `none`'), L('Force an accessory, or none.', '指定配饰，或不要配饰。')],
            ['`mood`', L('expression name', '表情名'), L('A resting face for idle (e.g. `sleepy`).', '待机时的默认表情（比如 `sleepy`）。')],
            ['`interactive`', '`false`', L('Disable poking, dragging and petting.', '关闭戳、拖、摸的互动。')]
          ]
        ),
        p('Size it with CSS (`width`/`height`); the canvas fills the element. Call `element.play(id)` for reactions.', '用 CSS 设置宽高，画布会填满元素。反应动作用 `element.play(id)` 调用。')
      ]
    ],
    [
      'js',
      'JavaScript API',
      [
        code(`import { createMascot, CHARACTERS } from './livelings'

const m = createMascot(hostElement, {
  character: CHARACTERS.cloud,
  seed: 'user-42',      // optional
  fidget: true,         // small idle moves now and then
  interactive: true,    // poke, drag, long-press to pet
})`),
        table(
          [L('Method', '方法'), L('What it does', '作用')],
          [
            ['`m.play(id)`', L('Play a state (loops) or a reaction (once). Returns false for unknown ids.', '播放状态（循环）或反应（一次）。id 不存在时返回 false。')],
            ['`m.state`', L('The action currently showing.', '当前正在播放的动作。')],
            ['`m.setMood(name | null)`', L('Resting face while idle.', '待机时的默认表情。')],
            ['`m.morphText(text, hold?)`', L('Turn into any short text (a digit, "!", "OK") for a moment.', '短暂变成任意短文本（数字、“!”、“OK”）。')],
            ['`m.lookAtClient(x, y)`', L('Look at a point in page coordinates; `null` to let the eyes wander.', '看向页面上的某个点；传 `null` 让眼睛自由游移。')],
            ['`m.actor`', L('The underlying simulation: springs, targets, impulses (`hop`, `poke`, `spinBy`, `shake`, `emit`).', '底层的模拟对象：弹簧、目标、冲量（`hop`、`poke`、`spinBy`、`shake`、`emit`）。')],
            ['`m.destroy()`', L('Stop and remove.', '停止并移除。')]
          ]
        )
      ]
    ],
    [
      'actions',
      L('States and reactions', '状态与反应'),
      [
        p(
          'Every character understands the same vocabulary, so you can switch characters without changing code. **Loops** stay until you play another loop. **One-shots** play once, then hand control back to the loop that was running.',
          '每个角色都听得懂同一套动作词汇，换角色不用改代码。**循环**会一直持续，直到播放另一个循环；**一次性**动作播一次，然后交还给之前的循环。'
        ),
        table(
          ['id', L('Kind', '类型'), L('Use it for', '适合用在')],
          [...UNIVERSAL_STATES, ...UNIVERSAL_EVENTS, ...EMOTIONS, ...FIDGETS].map((id) => [`\`${id}\``, UNIVERSAL[id].kind === 'loop' ? L('loop', '循环') : L('once', '一次'), tx(UNIVERSAL[id].label)])
        ),
        h('h3', { style: 'margin-top:28px' }, L('Signature moves', '招牌动作')),
        table(
          [L('Character', '角色'), L('Own actions', '专属动作')],
          FAMILY.map((c) => [`${tx(c.name)} (\`${c.id}\`)`, c.signature.map((s) => `\`${s}\``).join(' ')])
        )
      ]
    ],
    [
      'events',
      L('Mapping app events', '对应 App 事件'),
      [
        table(
          [L('When…', '当…'), L('Play', '播放')],
          [
            [L('a request starts', '请求开始'), '`acknowledge` → `thinking`'],
            [L('streaming or using tools', '流式输出或调用工具'), '`working`'],
            [L('waiting on the user', '等待用户'), '`waiting`'],
            [L('it needs input or permission', '需要用户输入或授权'), '`blocked`'],
            [L('it succeeds', '成功'), '`idle` + `done`'],
            [L('it fails', '失败'), '`error`'],
            [L('the app is idle for a long time', '长时间无操作'), '`sleep`'],
            [L('voice input is on', '语音输入开启'), '`listening`']
          ]
        ),
        p(
          'A mascot should never be the only status signal: keep a text label next to it for screen readers and for anyone who looks away.',
          '吉祥物不应该是唯一的状态提示：旁边保留一行文字，照顾读屏用户，也照顾一时没在看的人。'
        )
      ]
    ],
    [
      'own',
      L('Make your own character', '做一个自己的角色'),
      [
        p(
          'A character is data plus a few small scripts: a rest silhouette, eyes, a material (spring constants), palettes, and its own actions. Behaviours only move targets and give impulses; springs animate everything, which is why any state can interrupt any other without a jump.',
          '一个角色就是数据加几段小脚本：静止时的轮廓、眼睛、材质（弹簧参数）、配色，以及它自己的动作。动作只负责改“目标”和给“冲量”，具体的运动全部交给弹簧，所以任何状态都能打断任何状态而不跳帧。'
        ),
        code(`export const pebble: CharacterDef = {
  id: 'pebble',
  name: { en: 'Pebble', zh: '石子' },
  physics: physics({ gravity: 16, hopPower: 2.2, squashiness: 0.3 }), // heavy, stubborn
  eyes: { w: 0.2, h: 0.2, corner: 1, spacing: 0.5, lift: 0.05, ... },
  eyeMode: 'ink',
  rest: () => shapes.pebble(),
  palettes: [{ id: 'granite', body: '#8d8a84', eye: '#1c1b19', accent: '#fab005' }],
  actions: {
    sink: {
      kind: 'once', duration: 1.6,
      enter(a) { a.express('sleepy'); a.morph('wide') },
    },
  },
  signature: ['sink'],
  fidgets: ['look-around'],
}`)
      ]
    ],
    [
      'skill',
      L('The Livelings skill', '活宝 Skill'),
      [
        p(
          'The skill teaches a coding agent (Claude Code, Codex, or any agent that reads `SKILL.md`) to make Livelings with you: it proposes a few concepts first, writes the one you pick as a character file, and checks it in a studio with sixteen live copies. It ships with the engine, the seven family sources as examples, a template, a studio with PNG, pose-sheet and video export, and a card page for article illustrations.',
          '活宝 Skill 教会 AI 编程助手（Claude Code、Codex，或任何会读 `SKILL.md` 的助手）陪你做活宝：先给几个方案，你挑中哪个就把它写成角色文件，再放进有 16 个分身的工作台里检查。技能包里有引擎、七位家族成员的源码作为范例、一个角色模板、能导出 PNG／动作表／视频的工作台，以及做文章插画的卡片页。'
        ),
        code(`# Claude Code (use ~/.codex/skills for Codex)
mkdir -p ~/.claude/skills && cd ~/.claude/skills
curl -fsSLO https://livelings.makerjackie.com${SKILL_ZIP}
unzip -o livelings-skill.zip && rm livelings-skill.zip`),
        p(
          'Then ask in plain words: "use the livelings skill to make a mascot for my bakery", or "illustrate this article with Inky". Characters you make are yours.',
          '然后直接说：「用 livelings skill 给我的面包店做一个吉祥物」，或者「用小墨给这篇文章配插画」。你做出来的角色归你。'
        ),
        h('p', {}, h('a', { href: SKILL_ZIP, download: 'livelings-skill.zip' }, L('Download livelings-skill.zip', '下载 livelings-skill.zip')))
      ]
    ],
    [
      'a11y',
      L('Accessibility & performance', '无障碍与性能'),
      [
        h(
          'ul',
          {},
          h('li', {}, html(L('With `prefers-reduced-motion`, characters calm down: smaller idle motion and no random fidgets.', '开启“减少动态效果”时，角色会安静下来：待机动作变小，也不再随机做小动作。'))),
          h('li', {}, html(L('Each canvas has `role="img"` and a label. Pair the mascot with visible status text.', '每个画布都有 `role="img"` 和描述。请搭配可见的状态文字使用。'))),
          h('li', {}, html(L('One animation loop for the whole page; off-screen characters pause.', '整个页面共用一个动画循环；不在屏幕上的角色会暂停。'))),
          h('li', {}, html(L('Each frame is simulated in sub-steps of at most 1/120 s, so motion stays smooth at 60 Hz, 120 Hz or anything else. It is deterministic: the same seed and the same frame times give the same frames, which also makes frame-perfect video export possible.', '每一帧都按实际经过的时间、拆成不超过 1/120 秒的小步来模拟，所以在 60Hz、120Hz 等任何刷新率下都顺滑。结果是确定的：相同的种子和相同的帧时间得到完全相同的画面，所以也能逐帧导出视频。')))
        )
      ]
    ],
    [
      'license',
      L('License & credits', '协议与致谢'),
      [
        p(
          'Code is MIT. Character designs (Puff, Inky, Pips, Boo, Quack, Stacky, Luna) are CC BY 4.0: use them anywhere, commercial included, with the credit "Livelings by MakerJackie". The names are kept as trademarks, so please do not present a character as your own brand mascot.',
          '代码采用 MIT 协议。角色形象（小云、小墨、点点、飘飘、嘎嘎、垒垒、月月）采用 CC BY 4.0：任何地方都能用，包括商业用途，只需署名“Livelings by MakerJackie”。角色名字保留为商标，请不要把它们当作你自己品牌的专属吉祥物。'
        ),
        p(
          'The outline-morphing approach comes from bloub by Jérémy Perret (MIT), a recreation of the xAI Grok Bot avatar. Inky first appeared in the Inky Habits app.',
          '轮廓变形的思路来自 Jérémy Perret 的 bloub（MIT），它复刻了 xAI 的 Grok Bot 头像。小墨最早出现在「墨团习惯」App 里。'
        )
      ]
    ]
  ]

  const nav = h('nav', { 'aria-label': L('On this page', '本页目录') }, ...sections.map(([id, title]) => h('a', { href: `#${id}` }, title)))
  const article = h('article', {})
  for (const [id, title, body] of sections) article.append(h('h2', { id }, title), ...body)
  // simple **bold** in paragraphs
  article.querySelectorAll('p span').forEach((s) => (s.innerHTML = s.innerHTML.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')))
  app.append(h('div', { class: 'wrap docs' }, nav, article))
  return () => {
    document.title = 'Livelings'
  }
}
