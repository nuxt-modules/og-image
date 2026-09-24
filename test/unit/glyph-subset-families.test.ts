import { describe, expect, it } from 'vitest'
import { isGlyphSubsetFamily } from '../../src/build/fontless'

describe('isGlyphSubsetFamily', () => {
  it('is false without @nuxt/fonts options', () => {
    expect(isGlyphSubsetFamily(undefined, 'Poppins')).toBe(false)
  })

  it('matches a family with glyphs set, ignoring case', () => {
    const fonts = { families: [{ name: 'Poppins', glyphs: 'Tak' }, { name: 'Inter' }] }
    expect(isGlyphSubsetFamily(fonts, 'poppins')).toBe(true)
    expect(isGlyphSubsetFamily(fonts, 'Inter')).toBe(false)
  })

  it('applies defaults.glyphs to every family', () => {
    expect(isGlyphSubsetFamily({ defaults: { glyphs: ['a'] } }, 'Anything')).toBe(true)
  })

  it('lets a family opt out of defaults.glyphs with an empty value', () => {
    const fonts = { defaults: { glyphs: 'abc' }, families: [{ name: 'Poppins', glyphs: [] }] }
    expect(isGlyphSubsetFamily(fonts, 'Poppins')).toBe(false)
  })
})
