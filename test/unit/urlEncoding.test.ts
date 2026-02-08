import { describe, expect, it } from 'vitest'
import {
  buildOgImageUrl,
  decodeOgImageParams,
  encodeOgImageParams,
  hashOgImageOptions,
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
      // satori should be URL-safe base64 encoded (- and ~ instead of + and /)
      expect(encoded).toMatch(/^satori_[A-Za-z0-9\-~]+$/)
    })

    it('skips undefined and null values', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        height: undefined,
        component: null,
      })
      expect(encoded).toBe('w_1200')
    })

    it('skips empty props', () => {
      const encoded = encodeOgImageParams({ props: {} })
      expect(encoded).toBe('')
    })

    it('skips props with only undefined values', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        props: { title: undefined, description: undefined },
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

    it('skips values matching defaults', () => {
      const defaults = { width: 1200, height: 600, emojis: 'noto', renderer: 'satori' }
      const encoded = encodeOgImageParams({
        width: 1200, // matches default
        height: 600, // matches default
        emojis: 'noto', // matches default
        renderer: 'satori', // matches default
        component: 'MyComponent', // not a default
        props: { title: 'Test' },
      }, defaults)
      expect(encoded).toBe('c_MyComponent,title_Test')
    })

    it('includes values different from defaults', () => {
      const defaults = { width: 1200, height: 600 }
      const encoded = encodeOgImageParams({
        width: 800, // different
        height: 600, // matches default
      }, defaults)
      expect(encoded).toBe('w_800')
    })

    it('works without defaults parameter', () => {
      const encoded = encodeOgImageParams({ width: 1200, height: 600 })
      expect(encoded).toBe('w_1200,h_600')
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
      expect(encoded).not.toContain('/') // no slashes in URL-safe base64
      expect(encoded).toMatch(/p_[A-Za-z0-9\-~]+/) // URL-safe base64 encoded
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })

    it('preserves _path that produces / in standard base64 (regression)', () => {
      // '/blog/hello' produces base64 with / chars that break URL path parsing
      const original = {
        _path: '/blog/hello',
        key: 'og',
      }
      const encoded = encodeOgImageParams(original)
      expect(encoded).not.toContain('/') // must not contain / for URL safety
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })
  })

  describe('buildOgImageUrl', () => {
    it('builds static URL', () => {
      const result = buildOgImageUrl({ width: 1200 }, 'png', true)
      expect(result.url).toBe('/_og/s/w_1200.png')
      expect(result.hash).toBeUndefined()
    })

    it('builds dynamic URL', () => {
      const result = buildOgImageUrl({ width: 1200 }, 'png', false)
      expect(result.url).toBe('/_og/d/w_1200.png')
    })

    it('uses jpeg extension', () => {
      const result = buildOgImageUrl({ width: 1200 }, 'jpeg', true)
      expect(result.url).toBe('/_og/s/w_1200.jpeg')
    })

    it('handles empty options', () => {
      const result = buildOgImageUrl({}, 'png', true)
      expect(result.url).toBe('/_og/s/default.png')
    })

    it('uses hash mode for long URLs', () => {
      const longTitle = 'A'.repeat(250)
      const result = buildOgImageUrl({ props: { title: longTitle } }, 'png', true)
      expect(result.url).toMatch(/^\/_og\/s\/o_[a-z0-9]+\.png$/)
      expect(result.hash).toBeDefined()
    })

    it('excludes _path from hash', () => {
      const opts = { props: { title: 'A'.repeat(250) } }
      const result1 = buildOgImageUrl({ ...opts, _path: '/page1' }, 'png', true)
      const result2 = buildOgImageUrl({ ...opts, _path: '/page2' }, 'png', true)
      expect(result1.hash).toBe(result2.hash)
    })

    it('skips default values when defaults provided', () => {
      const defaults = { width: 1200, height: 600, emojis: 'noto', renderer: 'satori' }
      const result = buildOgImageUrl({
        width: 1200,
        height: 600,
        component: 'Test',
        props: { title: 'Hello' },
      }, 'png', true, defaults)
      expect(result.url).toBe('/_og/s/c_Test,title_Hello.png')
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

  describe('hashOgImageOptions', () => {
    it('generates consistent hash for same options', () => {
      const options = { width: 1200, props: { title: 'Hello' } }
      const hash1 = hashOgImageOptions(options)
      const hash2 = hashOgImageOptions(options)
      expect(hash1).toBe(hash2)
    })

    it('excludes _path from hash', () => {
      const hash1 = hashOgImageOptions({ width: 1200, _path: '/page1' })
      const hash2 = hashOgImageOptions({ width: 1200, _path: '/page2' })
      expect(hash1).toBe(hash2)
    })

    it('excludes _hash from hash', () => {
      const hash1 = hashOgImageOptions({ width: 1200, _hash: 'abc123' })
      const hash2 = hashOgImageOptions({ width: 1200, _hash: 'def456' })
      expect(hash1).toBe(hash2)
    })

    it('includes componentHash when provided', () => {
      const options = { width: 1200 }
      const hash1 = hashOgImageOptions(options, 'componentHash1')
      const hash2 = hashOgImageOptions(options, 'componentHash2')
      expect(hash1).not.toBe(hash2)
    })

    it('includes version when provided', () => {
      const options = { width: 1200 }
      const hash1 = hashOgImageOptions(options, undefined, '1.0.0')
      const hash2 = hashOgImageOptions(options, undefined, '2.0.0')
      expect(hash1).not.toBe(hash2)
    })

    it('includes both componentHash and version', () => {
      const options = { width: 1200 }
      const hash1 = hashOgImageOptions(options, 'compHash', '1.0.0')
      const hash2 = hashOgImageOptions(options, 'compHash', '1.0.0')
      const hash3 = hashOgImageOptions(options, 'otherHash', '1.0.0')
      const hash4 = hashOgImageOptions(options, 'compHash', '2.0.0')
      expect(hash1).toBe(hash2) // Same inputs = same hash
      expect(hash1).not.toBe(hash3) // Different componentHash = different hash
      expect(hash1).not.toBe(hash4) // Different version = different hash
    })

    it('without componentHash/version produces same hash as before', () => {
      const options = { width: 1200, props: { title: 'Test' } }
      const hashWithout = hashOgImageOptions(options)
      const hashWithEmpty = hashOgImageOptions(options, '', '')
      // Empty strings are treated as not providing values (backward compatible)
      expect(hashWithout).toBe(hashWithEmpty)
    })
  })
})
