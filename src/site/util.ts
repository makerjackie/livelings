/** Tiny element helper: h('div', { class: 'x' }, child, 'text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener)
    else if (v === true) el.setAttribute(k, '')
    else if (v !== false) el.setAttribute(k, v)
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c)
  return el
}

/** Light syntax colouring for code (keywords, strings, comments, tags). */
export function highlight(code: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/(^|\s)(\/\/[^\n]*)/gm, '$1<span class="tok-c">$2</span>')
    .replace(/('[^'\n]*'|"[^"\n]*")/g, '<span class="tok-s">$1</span>')
    .replace(/\b(const|let|await|import|from|new|function|return|if|else|=&gt;)\b/g, '<span class="tok-k">$1</span>')
    .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-t">$2</span>')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
