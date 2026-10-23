import React from 'react'
import { loadFont } from '@remotion/google-fonts/BricolageGrotesque'
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { CAPTIONS, f, FPS, type Caption, type Lang, MUSIC_END, type Shot, SHOTS, soundsFor } from './edl'

const { fontFamily: BRAND } = loadFont('normal', { weights: ['600', '700', '800'], subsets: ['latin'] })
const ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif'
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const BACK = Easing.bezier(0.34, 1.56, 0.64, 1)
const OUT = Easing.bezier(0.16, 1, 0.3, 1)

const ShotView: React.FC<{ shot: Shot; lang: Lang }> = ({ shot, lang }) => {
  const frame = useCurrentFrame()
  const len = f(shot.end - shot.at)
  const [z0, z1] = shot.zoom ?? [1, 1]
  const z = interpolate(frame, [0, Math.max(1, len - 1)], [z0, z1], { ...CL, easing: Easing.bezier(0.33, 0, 0.67, 1) })
  const [ox, oy] = shot.origin ?? [0.5, 0.5]
  return (
    <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%` }}>
      <OffthreadVideo muted src={staticFile(`footage/${lang}/${shot.id}.mp4`)} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  )
}

/** Plain text with `**highlighted**` parts. */
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

/** A caption: an ink sticker at the bottom that lands like a stamp. */
const CaptionView: React.FC<{ c: Caption; lang: Lang }> = ({ c, lang }) => {
  const frame = useCurrentFrame()
  const len = f(c.to - c.from)
  const inn = interpolate(frame, [0, 14], [0, 1], { ...CL, easing: BACK })
  const fade = interpolate(frame, [0, 5], [0, 1], CL)
  const out = interpolate(frame, [len - 8, len], [0, 1], { ...CL, easing: OUT })
  const plain = (t: string) => t.replace(/\*\*/g, '')
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: lang === 'zh' ? '20px 40px 18px' : '22px 42px',
          borderRadius: 30,
          background: 'rgba(23, 22, 20, 0.92)',
          boxShadow: '0 18px 40px -16px rgba(40, 30, 10, 0.55)',
          opacity: fade * (1 - out),
          transform: `translateY(${(1 - inn) * 18 + out * 10}px) scale(${0.9 + 0.1 * inn - out * 0.04}) rotate(${(1 - inn) * -2}deg)`
        }}
      >
        {lang === 'zh' ? (
          <>
            <div style={{ fontFamily: ZH, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: '#fffdf8', letterSpacing: 1 }}>
              <Marked text={c.zh} />
            </div>
            <div style={{ fontFamily: BRAND, fontWeight: 600, fontSize: 25, lineHeight: 1.2, color: '#bdb6a6' }}>{plain(c.en)}</div>
          </>
        ) : (
          <div style={{ fontFamily: BRAND, fontWeight: 700, fontSize: 50, lineHeight: 1.15, color: '#fffdf8' }}>
            <Marked text={c.en} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

export const Film: React.FC<{ lang: Lang }> = ({ lang }) => {
  const sounds = soundsFor(lang)
  return (
    <AbsoluteFill style={{ background: '#f4f0e6' }}>
      {SHOTS.map((shot) => (
        <Sequence key={shot.id} from={f(shot.at)} durationInFrames={f(shot.end) - f(shot.at)} name={shot.id}>
          <ShotView shot={shot} lang={lang} />
        </Sequence>
      ))}
      {CAPTIONS.map((c, i) => (
        <Sequence key={i} from={f(c.from)} durationInFrames={f(c.to) - f(c.from)} name={`caption ${i + 1}`}>
          <CaptionView c={c} lang={lang} />
        </Sequence>
      ))}
      <Audio src={staticFile('music/scene-funk-90.mp3')} volume={0.82} endAt={f(MUSIC_END)} />
      {sounds.map((x, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, f(x.at))} durationInFrames={FPS * 3} name={x.src}>
          <Audio src={staticFile(`sfx/${x.src}.wav`)} volume={x.volume ?? 0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
