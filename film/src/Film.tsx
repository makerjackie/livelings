import React from 'react'
import { loadFont } from '@remotion/google-fonts/BricolageGrotesque'
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { WINDOW } from '../tools/shots.mjs'
import { buildEdit, type Caption, type EditId, f, FPS, type Lang, type Shot } from './edl'

const { fontFamily: BRAND } = loadFont('normal', { weights: ['600', '700', '800'], subsets: ['latin'] })
const ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif'
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const BACK = Easing.bezier(0.34, 1.56, 0.64, 1)
const OUT = Easing.bezier(0.16, 1, 0.3, 1)
const SITE_HOST = 'livelings.makerjackie.com'

/** The address shown for a page: the live site, or the skill's local workspace. */
const addressOf = (url: string) => {
  if (url.includes(':5280/skill/')) return `localhost:4321/${url.split('/workspace/')[1].split('?')[0]}`
  const path = new URL(url).pathname
  return SITE_HOST + (path === '/' ? '' : path)
}

/** A browser window around footage of a page, with its address bar. */
const BrowserFrame: React.FC<{ shot: Shot; src: string }> = ({ shot, src }) => {
  const { x, y, w, h, bar } = WINDOW
  const lock = addressOf(shot.url).startsWith(SITE_HOST)
  return (
    <AbsoluteFill style={{ background: '#e9e3d4' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y - bar,
          width: w,
          height: h + bar,
          borderRadius: 20,
          overflow: 'hidden',
          background: '#f4f0e6',
          boxShadow: '0 30px 70px -30px rgba(60, 45, 10, 0.45), 0 0 0 1px rgba(23, 22, 20, 0.06)'
        }}
      >
        <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', background: '#ece6d8' }}>
          <div style={{ display: 'flex', gap: 9 }}>
            {['#ff6b6b', '#ffd43b', '#51cf66'].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              maxWidth: 760,
              margin: '0 auto',
              height: 34,
              borderRadius: 17,
              background: '#fffdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: BRAND,
              fontWeight: 600,
              fontSize: 19,
              color: '#171614'
            }}
          >
            {lock ? <span style={{ fontSize: 15, opacity: 0.6 }}>🔒</span> : null}
            {addressOf(shot.url)}
          </div>
          <div style={{ width: 60 }} />
        </div>
        <OffthreadVideo muted src={src} style={{ display: 'block', width: w, height: h }} />
      </div>
    </AbsoluteFill>
  )
}

/** A small address tag on full-frame scenes, so the site is always on screen. */
const AddressTag: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 34,
      top: 30,
      padding: '9px 18px',
      borderRadius: 22,
      background: 'rgba(255, 253, 248, 0.92)',
      fontFamily: BRAND,
      fontWeight: 700,
      fontSize: 22,
      color: '#171614',
      boxShadow: '0 6px 18px -8px rgba(60, 45, 10, 0.35)'
    }}
  >
    {SITE_HOST}
  </div>
)

const ShotView: React.FC<{ shot: Shot; edit: EditId; lang: Lang }> = ({ shot, edit, lang }) => {
  const src = staticFile(`footage/${edit}-${lang}/${shot.id}.mp4`)
  if (shot.kind === 'site') return <BrowserFrame shot={shot} src={src} />
  return (
    <AbsoluteFill>
      <OffthreadVideo muted src={src} style={{ width: '100%', height: '100%' }} />
      {shot.id === 'end' ? null : <AddressTag />}
    </AbsoluteFill>
  )
}

const Marked: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part, i) =>
      part.startsWith('**') ? (
        <span key={i} style={{ color: '#ffd43b' }}>
          {part.slice(2, -2)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    )}
  </>
)

/** Short film: a big ink sticker that lands like a stamp. */
const Sticker: React.FC<{ c: Caption; lang: Lang }> = ({ c, lang }) => {
  const frame = useCurrentFrame()
  const len = f(c.to - c.from)
  const inn = interpolate(frame, [0, 13], [0, 1], { ...CL, easing: BACK })
  const fade = interpolate(frame, [0, 4], [0, 1], CL)
  const out = interpolate(frame, [len - 7, len], [0, 1], { ...CL, easing: OUT })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: lang === 'zh' ? '20px 46px 18px' : '22px 46px',
          borderRadius: 32,
          background: 'rgba(23, 22, 20, 0.94)',
          boxShadow: '0 18px 40px -16px rgba(40, 30, 10, 0.55)',
          opacity: fade * (1 - out),
          transform: `translateY(${(1 - inn) * 20 + out * 10}px) scale(${1.12 - 0.12 * inn - out * 0.05}) rotate(${(1 - inn) * -2.5}deg)`
        }}
      >
        {lang === 'zh' ? (
          <>
            <div style={{ fontFamily: ZH, fontWeight: 600, fontSize: 60, lineHeight: 1.12, color: '#fffdf8', letterSpacing: 1 }}>
              <Marked text={c.zh} />
            </div>
            <div style={{ fontFamily: BRAND, fontWeight: 600, fontSize: 26, lineHeight: 1.2, color: '#bdb6a6' }}>{c.en.replace(/\*\*/g, '')}</div>
          </>
        ) : (
          <div style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 58, lineHeight: 1.12, color: '#fffdf8' }}>
            <Marked text={c.en} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

/** Narrated film: plain subtitles that follow the voice. */
const Subtitle: React.FC<{ c: Caption }> = ({ c }) => {
  const frame = useCurrentFrame()
  const len = f(c.to - c.from)
  const a = interpolate(frame, [0, 4, len - 4, len], [0, 1, 1, 0], CL)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 48 }}>
      <div
        style={{
          padding: '12px 30px',
          borderRadius: 18,
          background: 'rgba(23, 22, 20, 0.86)',
          fontFamily: ZH,
          fontWeight: 600,
          fontSize: 44,
          lineHeight: 1.2,
          color: '#fffdf8',
          letterSpacing: 1,
          opacity: a
        }}
      >
        {c.zh}
      </div>
    </AbsoluteFill>
  )
}

export const Film: React.FC<{ edit: EditId; lang: Lang }> = ({ edit, lang }) => {
  const e = buildEdit(edit, lang)
  return (
    <AbsoluteFill style={{ background: '#f4f0e6' }}>
      {e.shots.map((shot) => (
        <Sequence key={shot.id} from={f(shot.at)} durationInFrames={f(shot.end) - f(shot.at)} name={shot.id}>
          <ShotView shot={shot} edit={edit} lang={lang} />
        </Sequence>
      ))}
      {e.captions.map((c, i) => (
        <Sequence key={`c${i}`} from={f(c.from)} durationInFrames={Math.max(1, f(c.to) - f(c.from))} name={`caption ${i + 1}`}>
          {e.captionStyle === 'sticker' ? <Sticker c={c} lang={lang} /> : <Subtitle c={c} />}
        </Sequence>
      ))}
      <Audio src={staticFile(e.music)} volume={(fr) => e.musicVolume(fr / FPS)} />
      {e.voice ? (
        <Sequence from={f(e.voice.at)} name="voice">
          <Audio src={staticFile(e.voice.src)} volume={1} />
        </Sequence>
      ) : null}
      {e.sounds.map((x, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, f(x.at))} durationInFrames={FPS * 4} name={x.src}>
          <Audio src={staticFile(`sfx/${x.src}.wav`)} volume={x.volume ?? 0.6} startFrom={x.trim ? f(x.trim) : undefined} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

