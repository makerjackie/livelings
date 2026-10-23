// Text shared by the scene page and the edit.

export const PROMPT = {
  zh: '用 livelings skill 给我的面包店做一个吉祥物',
  en: 'Use the livelings skill to make a mascot for my bakery'
}

/** The three lines of the code scene. */
export const codeLines = (character = 'cloud') => [
  '<script type="module"',
  '  src="https://livelings.makerjackie.com/livelings.js"></script>',
  `<live-ling character="${character}" state="thinking"></live-ling>`
]
