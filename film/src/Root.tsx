import React from 'react'
import { Composition } from 'remotion'
import { buildEdit, f, FPS } from './edl'
import { Film } from './Film'

const COMPS = [
  ['Short-zh', 'short', 'zh'],
  ['Short-en', 'short', 'en'],
  ['Long-zh', 'long', 'zh']
] as const

export const Root: React.FC = () => (
  <>
    {COMPS.map(([id, edit, lang]) => (
      <Composition key={id} id={id} component={Film} durationInFrames={f(buildEdit(edit, lang).duration)} fps={FPS} width={1920} height={1080} defaultProps={{ edit, lang }} />
    ))}
  </>
)
