import { describe, expect, it } from 'vitest'
import { extractFontFacesSimple } from '../../src/build/css/font-face'

describe('manual font faces', () => {
  it.each([
    { source: 'url("/fonts/manual.ttf")', src: '/fonts/manual.ttf', isWoff2: false },
    { source: 'url("/fonts/manual.woff2")', src: '/fonts/manual.woff2', isWoff2: true },
    { source: 'local("Manual"), url("/fonts/manual.ttf")', src: '/fonts/manual.ttf', isWoff2: false },
    { source: 'url("/fonts/manual.ttf") format("truetype")', src: '/fonts/manual.ttf', isWoff2: false },
  ])('extracts a URL source from $source', async ({ source, src, isWoff2 }) => {
    const css = `@font-face { font-family: Manual; src: ${source}; font-weight: 400; }`

    const fonts = await extractFontFacesSimple(css)

    expect(fonts).toEqual([{
      family: 'Manual',
      src,
      weight: 400,
      style: 'normal',
      unicodeRange: undefined,
      isWoff2,
      weightRange: undefined,
    }])
  })
})
