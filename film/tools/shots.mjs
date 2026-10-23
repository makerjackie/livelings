/**
 * The shot plan for both films, shared by the capture tool and the edit.
 *
 *   short: about 42 s, no narration, cut to the music (edits/short-beats.json)
 *   long:  about 76 s, narrated (public/voice/vo-zh.json), music underneath
 *
 * plan() is pure: callers pass the beat map and the narration timestamps.
 * Every shot has a film start `at` and end `end`; scene parameters and pointer
 * actions are in seconds from the start of the shot. `marks` are film times
 * the edit uses for sounds.
 */
export const SITE = 'https://livelings.makerjackie.com'
export const LOCAL = 'http://localhost:5280'
export const SCENES = 'http://localhost:5290'

/** The browser window the site is shown in: content area of the edit, in output pixels. */
export const WINDOW = { x: 96, y: 80, w: 1728, h: 972, bar: 52 }

/** Narration words with start times, from the TTS JSON. */
export function narration(json) {
  let text = ''
  const times = []
  for (const s of json.sentences) for (const w of s.words) for (const ch of w.word) {
    text += ch
    times.push(w.startTime)
  }
  /** start of the first `phrase`, or the first one after `after` */
  const at = (phrase, after) => {
    const j = text.indexOf(phrase, after ? text.indexOf(after) : 0)
    if (j < 0) throw new Error(`narration has no "${phrase}"`)
    return times[j]
  }
  return { text, times, at, sentences: json.sentences }
}

const scene = (id, lang, at, end, p, extra = {}) => ({
  id,
  kind: 'scene',
  at,
  end,
  url: `${SCENES}/?scene=${id.replace(/-.*/, '')}&lang=${lang}&p=${encodeURIComponent(JSON.stringify(p))}`,
  p,
  ...extra
})

const site = (id, url, at, end, extra) => ({ id, kind: 'site', at, end, url, out: [WINDOW.w, WINDOW.h], ...extra })

const card = (name, at2 = [0.5, 0.36]) => ({ toSel: '.card', text: name, at2 })
const strip = (label) => ({ toSel: '.film .strip-hit', text: label })

export function plan({ edit, lang, beats, vo }) {
  const zh = lang === 'zh'
  const cloud = zh ? '小云' : 'Puff'
  const ghost = zh ? '飘飘' : 'Boo'
  const marks = {}
  const shots = []

  if (edit === 'short') {
    const bar = (k, b = 0) => beats[4 * k + b] ?? beats.at(-1) + (4 * k + b - beats.length + 1) * (beats[1] - beats[0])
    const END = bar(20) + 0.5
    // home → straight to the card that splits into sixteen → zoom in, pick moves, play
    const home = site('home', `${SITE}/`, 0, bar(7), {
      actions: [
        { at: 0.25, type: 'move', from: [1400, 790], to: [1050, 560], dur: 0.6, ease: 'out' },
        { at: bar(0, 2), type: 'move', ...card(ghost), dur: 0.6 },
        { at: bar(1), type: 'move', ...card(cloud), dur: 0.9, arc: 0.05 },
        { at: bar(2) - 0.19, type: 'click' },
        { at: bar(3), type: 'move', toSel: '.grid-canvas', at2: [0.13, 0.14], dur: 0.45 },
        { at: bar(3, 1), type: 'click' },
        { at: bar(3, 3) - 0.1, type: 'move', ...strip(zh ? '打雷' : 'Thunder'), dur: 0.35 },
        { at: bar(4), type: 'click' },
        { at: bar(4, 1), type: 'move', ...strip(zh ? '晒太阳' : 'Sunbathe'), dur: 0.35 },
        { at: bar(4, 2), type: 'click' },
        { at: bar(4, 3), type: 'move', toSel: '.grid-canvas', at2: [0.5, 0.42], dur: 0.4 },
        { at: bar(5), type: 'click' },
        { at: bar(5, 1), type: 'drag', toSel: '.grid-canvas', at2: [0.8, 0.36], dur: 0.5 },
        { at: bar(5, 2) + 0.05, type: 'move', toSel: '.grid-canvas', at2: [0.5, 0.45], dur: 0.15 },
        ...[0, 1, 2, 3, 4, 5].map((k) => ({ at: bar(6) + k * 0.13, type: 'move', toSel: '.grid-canvas', at2: [k % 2 ? 0.54 : 0.46, 0.46], dur: 0.12, ease: 'linear', arc: 0 })),
        { at: bar(6, 3), type: 'move', toSel: '.grid-canvas', at2: [0.85, 0.3], dur: 0.6 }
      ]
    })
    shots.push(home)
    marks.hello = bar(1) + 0.9
    marks.cardClick = bar(2) - 0.19
    marks.split = bar(2)
    marks.zoom = bar(3, 1)
    marks.picks = [bar(4), bar(4, 2)]
    marks.poke = bar(5)
    marks.release = bar(5, 1) + 0.5
    marks.tickle = bar(6)

    // tricks: one every two beats, then everyone
    const T = bar(7)
    const tricks = [
      ['inky', 'stamp', 0],
      ['dice', 'lucky', 0.8],
      ['ghost', 'boo', 0.1],
      ['duck', 'flip', 0.15],
      ['blocks', 'topple', 0.35],
      ['moon', 'wax', 0.9]
    ].map(([id, act, pre], k) => ({ id, act, pre, from: bar(7, 2 * k) - T }))
    shots.push(scene('tricks', lang, T, bar(11), { items: [...tricks, { family: true, act: 'celebrate', from: bar(10) - T, stagger: 0.05 }] }))
    marks.tricks = tricks.map((x) => T + x.from)
    marks.family = bar(10)

    const C = bar(11)
    shots.push(scene('code', lang, C, bar(13), {
      character: 'cloud',
      lines: [[0.05, 0.45], [0.45, 1.3], [1.3, 1.95]],
      appearAt: bar(12) - C,
      states: [{ at: bar(12, 2) - C, state: 'done' }],
      depsAt: bar(12, 3) - C
    }))
    marks.codeType = [C + 0.05, C + 1.95]
    marks.codeAppear = bar(12)
    marks.codeDone = bar(12, 2)

    const S = bar(13)
    const skill = { typeFrom: 0.1, typeTo: 1.5, sendAt: 1.7, liftAt: 1.75, popAt: bar(14) - S, name: true }
    shots.push(scene('skill', lang, S, bar(15), skill))
    marks.prompt = { from: S + skill.typeFrom, to: S + skill.typeTo, send: S + skill.sendAt, chars: null }
    marks.ding = bar(14)

    shots.push(site('studio', `${LOCAL}/skill/livelings/workspace/studio.html?char=./characters/toast.js`, bar(15), bar(16), { setup: [{ run: 600 }] }))

    const E = bar(16)
    shots.push(scene('end', lang, E, END, { titleAt: 0, launchAt: bar(16, 2) - E, enterAt: 0.15, subAt: 0.6, urlAt: 0.9, cheerAt: [bar(18) - E], jumpAt: [bar(20) - E] }))
    marks.end = E
    marks.launch = bar(16, 2)
    marks.cheer = bar(18)
    marks.finalHit = bar(20)
    return { shots, marks, duration: END }
  }

  // long: narrated. A cold open on the split, then the narration from bar 2 of the music.
  const V = beats[8]
  const F = (phrase, from) => V + vo.at(phrase, from)
  const bar = (k, b = 0) => beats[4 * k + b]
  const END = beats.at(-1) + 1.2
  marks.voice = V

  shots.push(site('teaser', `${SITE}/`, 0, V, {
    actions: [
      { at: 0.05, type: 'move', from: [1000, 640], ...card(cloud), dur: 0.35, ease: 'out' },
      { at: bar(0, 2) - 0.19, type: 'click' },
      { at: bar(1, 1), type: 'move', toSel: '.grid-canvas', at2: [0.6, 0.5], dur: 1.2 }
    ]
  }))
  marks.teaserClick = bar(0, 2) - 0.19
  marks.teaserSplit = bar(0, 2)

  const homeEnd = F('每个活宝') - 0.3
  // the home shot starts with the narration; its pointer times are from that start
  const at0 = (x) => x - V
  shots.push(site('home', `${SITE}/`, V, homeEnd, {
    actions: [
      { at: 0.3, type: 'move', from: [1400, 790], to: [1050, 560], dur: 0.9, ease: 'out' },
      { at: at0(F('你的鼠标')), type: 'move', ...card(cloud), dur: 0.7 },
      { at: at0(F('你的鼠标') + 1.0), type: 'move', ...card(ghost), dur: 1.1, arc: 0.05 },
      { at: at0(F('点一下') - 0.2), type: 'move', to: [650, 104], dur: 0.7 },
      { at: at0(F('吓一跳')), type: 'click' },
      { at: at0(F('吓一跳') + 0.45), type: 'move', ...card(cloud), dur: 0.8 },
      { at: at0(F('点开小云') + 0.37), type: 'click' },
      { at: at0(F('每一个演') + 0.2), type: 'move', toSel: '.grid-canvas', at2: [0.13, 0.14], dur: 0.6 },
      { at: at0(F('放大任意')), type: 'click' },
      { at: at0(F('放大任意') + 0.55), type: 'move', toSel: '.grid-canvas', at2: [0.5, 0.42], dur: 0.4 },
      { at: at0(F('戳它')), type: 'click' },
      { at: at0(F('拖它')), type: 'drag', toSel: '.grid-canvas', at2: [0.78, 0.36], dur: 0.5 },
      { at: at0(F('拖它') + 0.52), type: 'move', toSel: '.grid-canvas', at2: [0.5, 0.45], dur: 0.12 },
      ...[0, 1, 2, 3, 4, 5].map((k) => ({ at: at0(F('挠它') + 0.05 + k * 0.13), type: 'move', toSel: '.grid-canvas', at2: [k % 2 ? 0.54 : 0.46, 0.46], dur: 0.12, ease: 'linear', arc: 0 }))
    ]
  }))
  marks.inkDrop = F('吓一跳')
  marks.cardClick = F('点开小云') + 0.37
  marks.split = F('点开小云') + 0.56
  marks.zoom = F('放大任意')
  marks.poke = F('戳它')
  marks.drag = F('拖它') + 0.5
  marks.hello = F('你的鼠标') + 0.7
  marks.tickle = F('挠它')

  const T = homeEnd
  const tricksEnd = F('做产品') - 0.25
  const items = [
    { family: true, act: 'hello', from: 0 },
    { id: 'inky', act: 'stamp', from: F('小墨') - T },
    { id: 'dice', act: 'roll', pre: 0.1, from: F('点点') - T },
    { id: 'ghost', act: 'vanish', from: F('飘飘') - T },
    { id: 'duck', act: 'squeak', from: F('嘎嘎') - T },
    { id: 'moon', act: 'wax', pre: 0.1, from: F('月月') - T }
  ]
  shots.push(scene('tricks', lang, T, tricksEnd, { items }))
  marks.tricks = items.slice(1).map((x) => T + x.from)

  const S1 = tricksEnd
  const codeStart = F('现在复制') - 0.2
  shots.push(scene('states', lang, S1, codeStart, { cards: [F('加载') - S1, F('出错') - S1, F('完成', '出错') - S1], focusAt: F('转圈圈') - S1 }))
  marks.cards = ['加载', '出错'].map((w) => F(w)).concat(F('完成', '出错'))

  const C = codeStart
  const skillStart = F('想要一个') - 0.3
  shots.push(scene('code', lang, C, skillStart, {
    character: 'cloud',
    lines: [[0.2, 0.7], [0.7, 1.8], [1.8, 2.6]],
    appearAt: F('会思考') - 0.15 - C,
    states: [{ at: F('会欢呼') - C, state: 'done' }, { at: F('也会沮丧') - C, state: 'error' }],
    depsAt: F('没有任何') - C
  }))
  marks.codeType = [C + 0.2, C + 2.6]
  marks.codeAppear = F('会思考') - 0.15
  marks.codeDone = F('会欢呼')
  marks.codeError = F('也会沮丧')

  const S = skillStart
  const studioStart = F('导出图片') - 0.2
  const skill = { askAt: F('想要一个') - S, typeFrom: F('说一句') - S, typeTo: F('它先给你') - 0.5 - S, sendAt: F('它先给你') - 0.3 - S, liftAt: F('它先给你') - S, popAt: F('再把你选中') + 0.3 - S, name: true }
  shots.push(scene('skill', lang, S, studioStart, skill))
  marks.prompt = { from: S + skill.typeFrom, to: S + skill.typeTo, send: S + skill.sendAt }
  marks.ding = S + skill.popAt

  const cardStart = F('配插画') - 0.25
  shots.push(site('studio', `${LOCAL}/skill/livelings/workspace/studio.html?char=./characters/toast.js`, studioStart, cardStart, {
    setup: [{ run: 600 }],
    actions: [
      { at: 0.1, type: 'move', from: [1300, 700], toSel: '#png', dur: 0.6 },
      { at: F('视频') - studioStart, type: 'move', toSel: '#rec', dur: 0.4 }
    ]
  }))
  const lastToast = F('这片吐司') - 0.15
  shots.push(site('card', `${LOCAL}/skill/livelings/workspace/card.html?spec=${encodeURIComponent(`${SCENES}/cards/inky-${lang}.json`)}`, cardStart, lastToast, {
    css: '#bar { display: none !important; } body { background: #f7f3ea !important; } canvas { width: 100vw !important; height: 100vh !important; box-shadow: none !important; }'
  }))
  const endStart = F('活宝是') - 0.4
  shots.push(scene('skill-again', lang, lastToast, endStart, { popAt: 0.25, happyAt: 1.5, tone: '#fde7c8', name: true }))
  marks.ding2 = lastToast + 0.25

  const E = endStart
  shots.push(scene('end', lang, E, END, {
    titleAt: 0,
    enterAt: 0.15,
    launchAt: F('开源项目') - E,
    subAt: F('免费商用') - 1.2 - E,
    urlAt: F('打开活宝') - E,
    urlFlashAt: F('打开活宝') - E,
    jumpAt: [F('戳戳它们') + 0.35 - E],
    cheerAt: [bar(34) - E]
  }))
  marks.end = E
  marks.launch = F('开源项目')
  marks.url = F('打开活宝')
  marks.finalHit = F('戳戳它们') + 0.35
  marks.cheer = bar(34)
  return { shots, marks, duration: END }
}
