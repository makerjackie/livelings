import { cloud, inky } from '../characters'
import { createMascot } from '../engine/mascot'
import { ORIGIN_URLS } from './data'
import { lang, t } from './i18n'
import { h } from './util'

const L = (en: string, zh: string) => (lang === 'zh' ? zh : en)

/** Timers that die with the page. */
function clock(cleanups: Array<() => void>) {
  const ids = new Set<number>()
  cleanups.push(() => ids.forEach((id) => window.clearTimeout(id)))
  return (seconds: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      ids.delete(id)
      fn()
    }, seconds * 1000)
    ids.add(id)
  }
}

/* --------------------------------------------------------------- app */

function appColumn(cleanups: Array<() => void>) {
  const video = h('video', { muted: true, loop: true, playsinline: true, preload: 'none', poster: '/showcase/inky-habits.jpg', 'aria-label': L('Inky Habits promo video', '墨团习惯宣传片') })
  video.muted = true
  const sound = h('button', { class: 'sound', type: 'button', 'aria-label': L('Sound', '声音') }, '🔇')
  sound.addEventListener('click', () => {
    video.muted = !video.muted
    sound.textContent = video.muted ? '🔇' : '🔊'
    if (video.paused) void video.play()
  })
  // only fetch and play the video while it is on screen
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!video.src) video.src = '/showcase/inky-habits.mp4'
      void video.play().catch(() => {})
    } else video.pause()
  })
  io.observe(video)
  cleanups.push(() => io.disconnect())
  return h(
    'figure',
    { class: 'show show-app' },
    h('div', { class: 'show-media' }, video, sound),
    h(
      'figcaption',
      {},
      h('span', { class: 'kind' }, L('iOS app · live on the App Store', 'iOS App · 已上架')),
      h('b', {}, L('Inky Habits', '墨团习惯')),
      h('span', {}, L('Inky is the whole interface: it flies over to stamp your habits.', '小墨就是整个界面：打完卡，它飞过去盖章。')),
      h('a', { href: ORIGIN_URLS.inky, target: '_blank', rel: 'noopener' }, 'App Store ↗')
    )
  )
}

/* ------------------------------------------------------- mini program */

function miniProgram(cleanups: Array<() => void>) {
  const later = clock(cleanups)
  const habits = [
    { icon: '💧', name: L('Drink water', '喝水'), sub: L('8 glasses', '8 杯') },
    { icon: '🚶', name: L('Walk', '散步'), sub: L('20 minutes', '20 分钟') },
    { icon: '📖', name: L('Read', '读书'), sub: L('One chapter', '一章') },
    { icon: '🌙', name: L('Sleep early', '早睡'), sub: L('Before 23:00', '23 点前') }
  ]
  const avatar = h('div', { class: 'mp-avatar' })
  const count = h('b', {})
  const line = h('span', {})
  const bar = h('i', {})
  const rows = habits.map((x) => {
    const row = h(
      'button',
      { class: 'mp-row', type: 'button' },
      h('span', { class: 'mp-icon' }, x.icon),
      h('span', { class: 'mp-text' }, h('b', {}, x.name), h('small', {}, x.sub)),
      h('span', { class: 'mp-check' })
    )
    return row
  })
  const done = new Set<number>()
  let pausedUntil = 0
  const m = createMascot(avatar, { character: inky, shadow: false, zoom: 1.2 })
  cleanups.push(() => m.destroy())

  const render = () => {
    count.textContent = `${done.size}/${habits.length}`
    line.textContent = done.size === habits.length ? L('All done. Stamped!', '全部完成，盖章！') : L(`${habits.length - done.size} to go, Inky is waiting`, `还差 ${habits.length - done.size} 个，小墨等你`)
    bar.style.width = `${(done.size / habits.length) * 100}%`
    rows.forEach((r, i) => r.classList.toggle('on', done.has(i)))
  }
  const tick = (i: number) => {
    if (done.has(i)) {
      done.delete(i)
      m.play('sad')
    } else {
      done.add(i)
      m.play(done.size === habits.length ? 'celebrate' : 'stamp')
    }
    render()
  }
  rows.forEach((r, i) =>
    r.addEventListener('click', () => {
      pausedUntil = performance.now() + 8000
      tick(i)
    })
  )
  const step = () => {
    if (performance.now() > pausedUntil) {
      if (done.size === habits.length) {
        done.clear()
        m.play('hello')
        render()
      } else {
        const next = habits.findIndex((_, i) => !done.has(i))
        tick(next)
      }
    }
    later(done.size === habits.length ? 3.4 : 2.2, step)
  }
  render()
  later(1.6, step)

  return h(
    'figure',
    { class: 'show show-mini' },
    h(
      'div',
      { class: 'phone' },
      h('div', { class: 'phone-status' }, h('b', {}, '9:41'), h('span', {}, '●●● ◗')),
      h('div', { class: 'mp-nav' }, h('b', {}, L('Habit stamps', '习惯打卡')), h('span', { class: 'capsule' }, h('i', {}, '•••'), h('i', {}, '◉'))),
      h('div', { class: 'mp-hero' }, avatar, h('div', { class: 'mp-score' }, h('small', {}, L('Today', '今天')), count, line, h('span', { class: 'mp-bar' }, bar))),
      h('div', { class: 'mp-list' }, ...rows),
      h('div', { class: 'phone-home' })
    ),
    h(
      'figcaption',
      {},
      h('span', { class: 'kind' }, L('Mini program', '小程序')),
      h('b', {}, L('A check-in that answers back', '会回应的打卡')),
      h('span', {}, L('Each tick gets a stamp; finish the day and it celebrates.', '每打一个卡它就盖个章，全部完成就庆祝。'))
    )
  )
}

/* ------------------------------------------------------------- website */

function website(cleanups: Array<() => void>) {
  const later = clock(cleanups)
  const thread = h('div', { class: 'web-thread' })
  const helper = h('div', { class: 'web-helper' })
  const bubble = h('div', { class: 'web-bubble' })
  const m = createMascot(helper, { character: cloud, shadow: false, zoom: 1.1 })
  cleanups.push(() => m.destroy())
  const say = (text: string) => {
    bubble.textContent = text
    bubble.classList.remove('pop')
    void bubble.offsetWidth
    bubble.classList.add('pop')
  }
  const tasks = [L('Reply to Mia about Friday', '回复 Mia 周五的安排'), L('Book the dentist', '预约牙医'), L('Draft the launch post', '写发布文案')]
  const run = () => {
    thread.replaceChildren(h('div', { class: 'msg me' }, L('Turn this week’s notes into a to-do list', '把这周的笔记整理成待办')))
    m.play('acknowledge')
    say(L('On it!', '收到！'))
    later(1.1, () => {
      m.play('thinking')
      say(L('Let me think…', '让我想想…'))
    })
    later(2.8, () => {
      m.play('working')
      const list = h('div', { class: 'msg bot' }, h('b', {}, L('This week', '本周待办')))
      thread.append(list)
      tasks.forEach((task, i) =>
        later(0.7 * i, () => {
          list.append(h('span', { class: 'todo' }, task))
          say(L(`Tidying… ${i + 1}/${tasks.length}`, `整理中… ${i + 1}/${tasks.length}`))
        })
      )
    })
    later(5.4, () => {
      m.play('idle')
      m.play('done')
      say(L('All tidy ✓', '整理好了 ✓'))
    })
    later(9, run)
  }
  later(0.8, run)

  return h(
    'figure',
    { class: 'show show-web' },
    h(
      'div',
      { class: 'browser' },
      h('div', { class: 'browser-bar' }, h('span', { class: 'lights' }, h('i', {}), h('i', {}), h('i', {})), h('span', { class: 'url' }, 'notely.app')),
      h(
        'div',
        { class: 'web' },
        h('div', { class: 'web-nav' }, h('b', {}, 'Notely'), h('span', {}, L('Notes', '笔记')), h('span', {}, L('Tasks', '待办')), h('span', {}, L('Calendar', '日历'))),
        h('div', { class: 'web-main' }, h('h4', {}, L('Good morning, Ada', '早上好，Ada')), thread),
        h('div', { class: 'web-assistant' }, bubble, helper)
      )
    ),
    h(
      'figcaption',
      {},
      h('span', { class: 'kind' }, L('Website', '网站')),
      h('b', {}, L('An assistant you can see working', '看得见在干活的助手')),
      h('span', {}, L('Got it, thinking, working, done: the states map straight onto an AI request.', '收到、思考、干活、完成：状态正好对上一次 AI 请求。'))
    )
  )
}

export function renderShowcase(cleanups: Array<() => void>): HTMLElement {
  return h(
    'section',
    { class: 'showcase', id: 'in-products' },
    h('header', {}, h('h2', {}, t('showTitle')), h('p', {}, t('showSub'))),
    h('div', { class: 'show-grid' }, appColumn(cleanups), miniProgram(cleanups), website(cleanups))
  )
}
