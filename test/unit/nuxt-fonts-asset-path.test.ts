import { describe, expect, it } from 'vitest'
import { nuxtFontFilename, toNuxtFontSource } from '../../src/runtime/server/og-image/bindings/font-assets/nuxt-fonts'

// Regression: https://github.com/nuxt-modules/og-image/issues/696
describe('nuxtFontFilename', () => {
  it('matches the @nuxt/fonts v0 public path', () => {
    expect(nuxtFontFilename('/_fonts/abc.woff2', '/_fonts')).toBe('abc.woff2')
  })

  it('matches the @nuxt/fonts v1 build assets path', () => {
    expect(nuxtFontFilename('/_nuxt/fonts/kLYc5.woff2', '/_nuxt/fonts')).toBe('kLYc5.woff2')
  })

  it('accepts a trailing slash on the base URL', () => {
    expect(nuxtFontFilename('/_nuxt/fonts/a.woff2', '/_nuxt/fonts/')).toBe('a.woff2')
  })

  it('rejects paths outside the base URL', () => {
    expect(nuxtFontFilename('/_fonts/a.woff2', '/_nuxt/fonts')).toBeUndefined()
    expect(nuxtFontFilename('/_nuxt/fontsx/a.woff2', '/_nuxt/fonts')).toBeUndefined()
  })

  it('rejects nested paths', () => {
    expect(nuxtFontFilename('/_nuxt/fonts/../../secret', '/_nuxt/fonts')).toBeUndefined()
  })
})

describe('toNuxtFontSource', () => {
  it('reads the @nuxt/fonts v0 string entry', () => {
    expect(toNuxtFontSource('https://fonts.gstatic.com/a.woff2')).toEqual({ url: 'https://fonts.gstatic.com/a.woff2' })
  })

  it('reads the @nuxt/fonts v1 RenderedFont entry', () => {
    expect(toNuxtFontSource({ url: 'https://fonts.gstatic.com/a.woff2' })).toEqual({ url: 'https://fonts.gstatic.com/a.woff2' })
  })

  it('keeps provider request headers as a plain object', () => {
    const source = toNuxtFontSource({ url: 'https://x.test/a.woff2', init: { headers: new Headers({ Authorization: 'Bearer t' }) } })
    expect(JSON.parse(JSON.stringify(source))).toEqual({ url: 'https://x.test/a.woff2', headers: { authorization: 'Bearer t' } })
  })
})
