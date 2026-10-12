import type { FontPreviewFace } from '../../devtools/lib/og-image/fonts'
import { describe, expect, it } from 'vitest'
import { createFontPreviewCss, getFontPreviewFaces } from '../../devtools/lib/og-image/fonts'

const latin: FontPreviewFace = { family: 'Public Sans', weight: 400, style: 'normal', src: '/app/_nuxt/fonts/latin.woff2', unicodeRange: 'U+0000-00FF', weightRange: [100, 900] }

describe('devtools font previews', () => {
  it('loads font URLs from the app origin and keeps its base URL', () => {
    expect(createFontPreviewCss([latin], 'http://localhost:3100/app/')).toContain('http://localhost:3100/app/_nuxt/fonts/latin.woff2')
  })

  it('adds the app base URL to module-owned static font paths', () => {
    const face = { ...latin, src: '/_og-static-fonts/inter.ttf' }
    expect(createFontPreviewCss([face], 'http://localhost:3100/app/')).toContain('http://localhost:3100/app/_og-static-fonts/inter.ttf')
  })

  it('keeps an existing app base URL on static font paths', () => {
    const face = { ...latin, src: '/app/_og-static-fonts/inter.ttf' }
    expect(createFontPreviewCss([face], 'http://localhost:3100/app/')).toContain('http://localhost:3100/app/_og-static-fonts/inter.ttf')
  })

  it('registers every subset and the variable weight range', () => {
    const css = createFontPreviewCss([latin, { ...latin, src: '/app/_nuxt/fonts/greek.woff2', unicodeRange: 'U+0370-03FF' }], 'http://localhost:3100')
    expect(css).toContain('greek.woff2')
    expect(css).toContain('font-weight: 100 900')
    expect(css).toContain('unicode-range: U+0370-03FF')
    expect(css).toContain('font-style: normal')
  })

  it('shows resolved fallback families alongside available custom fonts', () => {
    const fallback = { family: 'Inter', weight: 400, style: 'normal', src: '/_og-static-fonts/inter.ttf' }
    expect(getFontPreviewFaces([latin], [latin, fallback])).toEqual([latin, fallback])
  })

  it('registers a shared variable file only once', () => {
    const css = createFontPreviewCss(getFontPreviewFaces([latin, { ...latin, weight: 700 }], [latin]), 'http://localhost:3100')
    expect(css.match(/@font-face/g)).toHaveLength(1)
  })
})
