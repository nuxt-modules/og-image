import { describe, expect, it } from 'vitest'
import {
  buildOgImageUrl,
  decodeOgImageParams,
  encodeOgImageParams,
  parseOgImageUrl,
} from '../../src/runtime/shared/urlEncoding'

describe('urlEncoding', () => {
  describe('encodeOgImageParams', () => {
    it('encodes simple width/height', () => {
      const encoded = encodeOgImageParams({ width: 1200, height: 630 })
      expect(encoded).toBe('w_1200,h_630')
    })

    it('encodes component props at top level', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        props: { title: 'Hello World' },
      })
      expect(encoded).toBe('w_1200,title_Hello+World')
    })

    it('encodes multiple props', () => {
      const encoded = encodeOgImageParams({
        props: { title: 'Hello', description: 'World' },
      })
      expect(encoded).toContain('title_Hello')
      expect(encoded).toContain('description_World')
    })

    it('encodes component name with alias', () => {
      const encoded = encodeOgImageParams({ component: 'NuxtSeo' })
      expect(encoded).toBe('c_NuxtSeo')
    })

    it('escapes underscores in values', () => {
      const encoded = encodeOgImageParams({
        props: { title: 'Hello_World' },
      })
      expect(encoded).toBe('title_Hello__World')
    })

    it('escapes commas in values', () => {
      const encoded = encodeOgImageParams({
        props: { title: 'Hello, World' },
      })
      expect(encoded).toBe('title_Hello%2C+World')
    })

    it('base64 encodes complex objects', () => {
      const encoded = encodeOgImageParams({
        satori: { fonts: [] },
      })
      // satori should be base64 encoded
      expect(encoded).toMatch(/^satori_[A-Za-z0-9+/]+$/)
    })

    it('skips undefined and null values', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        height: undefined,
        component: null,
      })
      expect(encoded).toBe('w_1200')
    })

    it('skips extension and socialPreview', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        extension: 'png',
        socialPreview: { og: {} },
      })
      expect(encoded).toBe('w_1200')
    })
  })

  describe('decodeOgImageParams', () => {
    it('decodes simple width/height', () => {
      const decoded = decodeOgImageParams('w_1200,h_630')
      expect(decoded).toEqual({ width: 1200, height: 630 })
    })

    it('decodes unknown params as props', () => {
      const decoded = decodeOgImageParams('title_Hello+World')
      expect(decoded).toEqual({ props: { title: 'Hello World' } })
    })

    it('decodes component alias', () => {
      const decoded = decodeOgImageParams('c_NuxtSeo')
      expect(decoded).toEqual({ component: 'NuxtSeo' })
    })

    it('decodes escaped underscores', () => {
      const decoded = decodeOgImageParams('title_Hello__World')
      expect(decoded).toEqual({ props: { title: 'Hello_World' } })
    })

    it('decodes escaped commas', () => {
      const decoded = decodeOgImageParams('title_Hello%2C+World')
      expect(decoded).toEqual({ props: { title: 'Hello, World' } })
    })

    it('decodes boolean values', () => {
      const decoded = decodeOgImageParams('debug_true,disabled_false')
      expect(decoded).toEqual({ props: { debug: true, disabled: false } })
    })

    it('decodes numeric values', () => {
      const decoded = decodeOgImageParams('w_1200,count_42')
      expect(decoded).toEqual({ width: 1200, props: { count: 42 } })
    })

    it('handles empty string', () => {
      const decoded = decodeOgImageParams('')
      expect(decoded).toEqual({})
    })

    it('handles default', () => {
      const decoded = decodeOgImageParams('default')
      expect(decoded).toEqual({})
    })
  })

  describe('roundtrip encode/decode', () => {
    it('preserves simple options', () => {
      const original = { width: 1200, height: 630, component: 'NuxtSeo' }
      const encoded = encodeOgImageParams(original)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })

    it('preserves props', () => {
      const original = {
        width: 1200,
        props: { title: 'Hello World', count: 42 },
      }
      const encoded = encodeOgImageParams(original)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })

    it('preserves special characters in props', () => {
      const original = {
        props: { title: 'Hello, World_Test' },
      }
      const encoded = encodeOgImageParams(original)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })

    it('preserves _path with slashes (base64 encoded)', () => {
      const original = {
        _path: '/satori/custom-font',
        width: 1200,
      }
      const encoded = encodeOgImageParams(original)
      expect(encoded).not.toContain('/satori') // slashes should not appear
      expect(encoded).toMatch(/p_[A-Za-z0-9+/]+/) // base64 encoded
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })
  })

  describe('buildOgImageUrl', () => {
    it('builds static URL', () => {
      const url = buildOgImageUrl({ width: 1200 }, 'png', true)
      expect(url).toBe('/_og/s/w_1200.png')
    })

    it('builds dynamic URL', () => {
      const url = buildOgImageUrl({ width: 1200 }, 'png', false)
      expect(url).toBe('/_og/d/w_1200.png')
    })

    it('uses jpeg extension', () => {
      const url = buildOgImageUrl({ width: 1200 }, 'jpeg', true)
      expect(url).toBe('/_og/s/w_1200.jpeg')
    })

    it('handles empty options', () => {
      const url = buildOgImageUrl({}, 'png', true)
      expect(url).toBe('/_og/s/default.png')
    })
  })

  describe('parseOgImageUrl', () => {
    it('parses static URL', () => {
      const result = parseOgImageUrl('/_og/s/w_1200,h_630.png')
      expect(result).toEqual({
        options: { width: 1200, height: 630 },
        extension: 'png',
        isStatic: true,
      })
    })

    it('parses dynamic URL', () => {
      const result = parseOgImageUrl('/_og/d/w_1200.jpeg')
      expect(result).toEqual({
        options: { width: 1200 },
        extension: 'jpeg',
        isStatic: false,
      })
    })

    it('parses URL with props', () => {
      const result = parseOgImageUrl('/_og/s/title_Hello+World.png')
      expect(result).toEqual({
        options: { props: { title: 'Hello World' } },
        extension: 'png',
        isStatic: true,
      })
    })
  })
})
