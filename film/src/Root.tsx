import React from 'react'
import { Composition } from 'remotion'
import { FILM_FRAMES, FPS } from './edl'
import { Film } from './Film'

export const Root: React.FC = () => (
  <>
    <Composition id="Film-zh" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ lang: 'zh' as const }} />
    <Composition id="Film-en" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ lang: 'en' as const }} />
  </>
)
