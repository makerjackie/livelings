// Timings shared by the scene page and the edit, so sounds land on what they belong to.

export const PROMPT = {
  zh: '用 livelings skill 给我的面包店做一个吉祥物',
  en: 'Use the livelings skill to make a mascot for my bakery'
}

/** The prompt types itself during the pause: first key at `start` s, then one every `per` s. */
export const TYPING = { start: 0.5, per: { zh: 0.105, en: 0.046 } }

export const typedAt = (lang, i) => TYPING.start + i * TYPING.per[lang]

/** The code scene types three lines, each starting on a beat (beat offsets from bar 28). */
export const CODE = [
  { text: '<script type="module"', from: 0, to: 0.9 },
  { text: '  src="https://livelings.makerjackie.com/livelings.js"></script>', from: 0.9, to: 2.6 },
  { text: '<live-ling character="ghost" state="thinking"></live-ling>', from: 2.6, to: 4 }
]
