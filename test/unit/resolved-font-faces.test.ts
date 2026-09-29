import { describe, expect, it } from 'vitest'
import { fontFacesFromResolved } from '../../src/build/css/font-face'

describe('fontFacesFromResolved', () => {
  it('reads the served URL, subset and unicode range of each face', () => {
    const faces = fontFacesFromResolved('Poppins', [{
      src: [{ name: 'Poppins' }, { url: '/docs/_nuxt/fonts/a.woff2', originalURL: 'https://x.test/a.woff2', format: 'woff2' }],
      weight: 400,
      style: 'normal',
      unicodeRange: ['U+0000-00FF', 'U+0131'],
      meta: { subset: 'latin' },
    }])
    expect(faces).toEqual([{ family: 'Poppins', src: '/docs/_nuxt/fonts/a.woff2', weight: 400, style: 'normal', unicodeRange: 'U+0000-00FF,U+0131', isWoff2: true, subset: 'latin', weightRange: undefined }])
  })

  it('keeps a variable weight range and defaults to 400 inside it', () => {
    const [face] = fontFacesFromResolved('Inter', [{ src: [{ url: '/_fonts/i.woff2', format: 'woff2' }], weight: [100, 900] }])
    expect(face).toMatchObject({ weight: 400, weightRange: [100, 900], style: 'normal' })
  })

  it('parses a string weight range', () => {
    const [face] = fontFacesFromResolved('Inter', [{ src: [{ url: '/_fonts/i.woff2' }], weight: '500 700' }])
    expect(face).toMatchObject({ weight: 500, weightRange: [500, 700] })
  })

  it('skips faces with only local sources', () => {
    expect(fontFacesFromResolved('Arial', [{ src: [{ name: 'Arial' }] }])).toEqual([])
  })
})
