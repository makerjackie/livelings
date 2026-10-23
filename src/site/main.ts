import './styles.css'
import { cloud } from '../characters'
import { createMascot } from '../engine/mascot'
import { lang, setLang, t } from './i18n'
import { named } from '../engine/library'
import { takeReturning, warmUp } from './fx'
import { renderDocs } from './pages/docs'
import { renderHome } from './pages/home'
import { renderStudio, type Studio } from './pages/studio'

const app = document.getElementById('app')!
type Page = { kind: 'studio'; studio: Studio } | { kind: 'home' | 'docs'; destroy: () => void }
let page: Page | null = null

const brand = createMascot(document.getElementById('brand-mark') as HTMLCanvasElement, {
  character: cloud,
  shadow: false,
  zoom: 1.45,
  fidget: true
})

function chrome(kind: Page['kind']) {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en'
  document.getElementById('brand-tag')!.textContent = t('tagline')
  document.querySelector('.brand b')!.textContent = lang === 'zh' ? '活宝 Livelings' : 'Livelings'
  document.getElementById('lang')!.textContent = lang === 'zh' ? 'EN' : '中文'
  const links: Record<string, [string, Page['kind'][]]> = { 'nav-characters': [t('navCharacters'), ['home', 'studio']], 'nav-docs': [t('navDocs'), ['docs']] }
  for (const [id, [label, kinds]] of Object.entries(links)) {
    const a = document.getElementById(id)!
    a.textContent = label
    if (kinds.includes(kind)) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  }
  document.body.dataset.page = kind
}

function route(force = false) {
  const path = location.pathname.replace(/\/+$/, '') || '/'
  const m = path.match(/^\/c\/([\w-]+)$/)
  const kind: Page['kind'] = m ? 'studio' : path === '/docs' ? 'docs' : 'home'
  chrome(kind)
  if (m && page?.kind === 'studio' && !force) {
    page.studio.select(m[1])
    return
  }
  if (page?.kind === 'studio') {
    // the characters fly home only when home is where we are going
    if (kind === 'home') page.studio.leave()
    page.studio.destroy()
  } else page?.destroy()
  if (kind !== 'home') takeReturning()
  app.innerHTML = ''
  if (m) page = { kind: 'studio', studio: renderStudio(app, m[1], navigate) }
  else if (kind === 'docs') page = { kind: 'docs', destroy: renderDocs(app) }
  else page = { kind: 'home', destroy: renderHome(app, navigate) }
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView())
  else window.scrollTo(0, 0)
}

export function navigate(href: string) {
  const url = new URL(href, location.href)
  if (url.href === location.href) return
  history.pushState(null, '', url)
  route()
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-link]')
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return
  e.preventDefault()
  navigate(a.href)
})

window.addEventListener('popstate', () => route())

document.getElementById('lang')!.addEventListener('click', () => {
  setLang(lang === 'zh' ? 'en' : 'zh')
  brand.play('acknowledge')
  route(true)
})

route()

// shapes traced from text and the transition canvas are slow to make the
// first time: make them while the page is idle, not as a transition starts
const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 800))
idle(() => {
  warmUp()
  for (const text of ['7', 'OK', '?']) named(`text:${text}`)
})
