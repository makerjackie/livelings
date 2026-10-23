/**
 * The shot list. Every shot starts at a bar of the soundtrack; action times are
 * seconds from the start of the shot, worked out from the beat map so clicks
 * and transitions land on the beat. Pages: the Mascots dev server (:5280) and
 * the scene page (tools/serve.mjs, :5290). Viewport 1440×810, captured at 1080p.
 */
export const SITE = 'http://localhost:5280'
export const SCENES = 'http://localhost:5290'

/** bar k starts on beat 1 + 4k (see beats.json) */
export const timing = (beats) => {
  const beat = (i) => beats[i]
  const bar = (k, b = 0) => beats[1 + 4 * k + b]
  return { beat, bar }
}

/** Where each shot sits in the film: first bar, last bar (exclusive). */
export const PLACES = {
  hook: [-0.25, 2], // starts at 0 s (before bar 0)
  states: [2, 6],
  title: [6, 8],
  home: [8, 16],
  play: [16, 20],
  tricks: [20, 24],
  showcase: [24, 28],
  code: [28, 30],
  pause: [30, 31.75],
  toasty: [31.75, 33],
  studio: [33, 35],
  card: [35, 37],
  end: [37, 41]
}

export function shots({ beats, lang }) {
  const { bar } = timing(beats)
  const zh = lang === 'zh'
  const start = (id) => (id === 'hook' ? 0 : bar(PLACES[id][0]))
  // length of a shot: to the end of its last bar, plus a little handle for the edit
  const length = (id, handle = 0.4) => {
    const [, b] = PLACES[id]
    const end = b >= 41 ? beats.at(-1) + 2 : bar(b)
    return end - start(id) + handle
  }
  // seconds into the shot at which a bar (and beat) of the film happens
  const at = (id, k, b = 0) => bar(k, b) - start(id)
  const scene = (id, extra = '') => ({
    id,
    url: `${SCENES}/?scene=${id}&lang=${lang}&t0=${start(id).toFixed(4)}${extra}`,
    duration: length(id)
  })

  const ghost = zh ? '飘飘' : 'Boo'
  const pips = zh ? '点点' : 'Pips'
  const inky = zh ? '墨团' : 'Inky'
  const card = (name, at2 = [0.5, 0.36]) => ({ toSel: '.card', text: name, at2 })

  return [
    scene('hook'),
    scene('states'),
    scene('title'),
    {
      // the index stamps itself in, everyone watches the cursor, a drop of ink,
      // then a card opens and splits into sixteen
      id: 'home',
      url: `${SITE}/`,
      duration: length('home'),
      actions: [
        { at: 0.35, type: 'move', from: [1400, 790], to: [1090, 600], dur: 0.9, ease: 'out' },
        { at: at('home', 8, 3), type: 'move', ...card(inky), dur: 1.0 },
        { at: at('home', 9, 1), type: 'move', ...card(pips), dur: 0.9 },
        { at: at('home', 10, 0), type: 'move', to: [650, 104], dur: 0.8 },
        { at: at('home', 10, 2), type: 'click' },
        { at: at('home', 11, 0), type: 'scroll', from: 0, to: 330, dur: 1.4 },
        { at: at('home', 11, 1), type: 'move', to: [1150, 470], dur: 1.0, arc: 0.06 },
        { at: at('home', 11, 3), type: 'scroll', from: 330, to: 120, dur: 0.8 },
        { at: at('home', 11, 3), type: 'move', ...card(ghost), dur: 0.55 },
        // the card waits 0.19 s before it leaves, so the split starts on bar 12
        { at: at('home', 12) - 0.19, type: 'click' },
        { at: at('home', 13, 0), type: 'move', toSel: '.grid-canvas', at2: [0.62, 0.55], dur: 1.0 },
        { at: at('home', 13, 2), type: 'move', toSel: '.grid-canvas', at2: [0.13, 0.14], dur: 0.9 },
        { at: at('home', 14, 0), type: 'click' },
        { at: at('home', 14, 3), type: 'move', toSel: '.film .strip-hit', text: zh ? '穿墙' : 'Through the wall', dur: 0.7 },
        { at: at('home', 15, 0), type: 'click' },
        { at: at('home', 15, 2), type: 'move', toSel: '.grid-canvas', at2: [0.72, 0.42], dur: 0.8 }
      ]
    },
    {
      // Inky up close: poke, stretch, tickle, three taps
      id: 'play',
      url: `${SITE}/c/inky`,
      duration: length('play'),
      // zoom into the first tile and let Inky simply stand there
      setup: [{ run: 1500 }, { click: { toSel: '.grid-canvas', at2: [0.13, 0.14] } }, { run: 900 }, { click: { toSel: '.film .strip-hit', text: zh ? '待机' : 'Idle' } }, { run: 900 }],
      actions: [
        { at: 0.05, type: 'move', from: [1300, 700], toSel: '.grid-canvas', at2: [0.5, 0.42], dur: 0.6, ease: 'out' },
        { at: at('play', 16, 1) - 0.02, type: 'click' },
        { at: at('play', 17, 0), type: 'drag', toSel: '.grid-canvas', at2: [0.78, 0.36], dur: 0.9 },
        { at: at('play', 17, 3), type: 'move', toSel: '.grid-canvas', at2: [0.5, 0.45], dur: 0.4 },
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ at: at('play', 18, 0) + k * 0.14, type: 'move', toSel: '.grid-canvas', at2: [k % 2 ? 0.54 : 0.46, 0.46], dur: 0.13, ease: 'linear', arc: 0 })),
        { at: at('play', 19, 0), type: 'click' },
        { at: at('play', 19, 1), type: 'click' },
        { at: at('play', 19, 2), type: 'click' }
      ]
    },
    scene('tricks'),
    {
      id: 'showcase',
      url: `${SITE}/`,
      duration: length('showcase'),
      setup: [{ eval: `window.scrollTo(0, document.getElementById('in-products').offsetTop - 70)` }, { run: 300 }],
      actions: [
        { at: 0.1, type: 'move', from: [1380, 760], toSel: '.show-mini .mp-row', at2: [0.5, 0.5], dur: 1.2 },
        { at: at('showcase', 25, 0) - 0.02, type: 'click' },
        { at: at('showcase', 26, 0), type: 'move', toSel: '.show-web .web-assistant', at2: [0.6, 0.6], dur: 1.4 }
      ]
    },
    scene('code'),
    scene('pause'),
    scene('toasty'),
    {
      id: 'studio',
      url: `${SITE}/skill/livelings/workspace/studio.html?char=./characters/toast.js`,
      duration: length('studio'),
      setup: [{ run: 600 }],
      actions: [{ at: 0.2, type: 'move', from: [1300, 760], to: [760, 470], dur: 1.6 }]
    },
    {
      id: 'card',
      url: `${SITE}/skill/livelings/workspace/card.html?spec=${encodeURIComponent(`${SCENES}/cards/inky-${lang}.json`)}`,
      duration: length('card'),
      css: '#bar { display: none !important; } body { background: #f7f3ea !important; } canvas { width: 100vw !important; height: 100vh !important; box-shadow: none !important; }'
    },
    scene('end')
  ]
}
