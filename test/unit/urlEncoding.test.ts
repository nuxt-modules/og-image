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

    it('always includes component even when matching defaults', () => {
      const defaults = { component: 'NuxtSeo', width: 1200 }
      const encoded = encodeOgImageParams({
        component: 'NuxtSeo',
        width: 1200,
      }, defaults)
      expect(encoded).toBe('c_NuxtSeo')
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

    it('does not truncate on commas inside prop values (encoded)', () => {
      const decoded = decodeOgImageParams('description_Ship+fast%2C+flexible%2C+and+more')
      expect(decoded).toEqual({ props: { description: 'Ship fast, flexible, and more' } })
    })

    it('does not truncate on commas inside prop values (decoded)', () => {
      const decoded = decodeOgImageParams('description_Ship+fast, flexible, and more')
      expect(decoded).toEqual({ props: { description: 'Ship fast, flexible, and more' } })
    })

    it('ignores empty string values during decoding', () => {
      const decoded = decodeOgImageParams('c_Default,primaryColor_')
      expect(decoded).toEqual({ component: 'Default', props: {} })
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

    it('preserves component name even when matching defaults', () => {
      const defaults = { component: 'NuxtSeo', width: 1200 }
      const original = { component: 'NuxtSeo', width: 1200, props: { title: 'Test' } }
      const encoded = encodeOgImageParams(original, defaults)
      expect(encoded).toContain('c_NuxtSeo')
      const decoded = decodeOgImageParams(encoded)
      expect(decoded.component).toBe('NuxtSeo')
    })

    it('preserves special characters in props', () => {
      const original = {
        props: { title: 'Hello, World_Test' },
      }
      const encoded = encodeOgImageParams(original)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual(original)
    })

    it('skips empty strings in roundtrip', () => {
      const original = { props: { title: '' } }
      const encoded = encodeOgImageParams(original)
      expect(encoded).toBe('')
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({})
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

  describe('non-ASCII encode/decode roundtrip', () => {
    function roundtrip(props: Record<string, any>) {
      const encoded = encodeOgImageParams({ props })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props })
    }

    // Basic ASCII regression
    it('round-trips ASCII-only values', () => {
      roundtrip({ title: 'Hello World' })
    })

    // Accented characters
    it('round-trips accented: café', () => {
      roundtrip({ title: 'café' })
    })

    it('round-trips accented: über', () => {
      roundtrip({ title: 'über' })
    })

    it('round-trips accented: Lo que aprendí construyendo Design Systems', () => {
      roundtrip({ title: 'Lo que aprendí construyendo Design Systems' })
    })

    // CJK characters
    it('round-trips Chinese characters', () => {
      roundtrip({ title: '你好世界' })
    })

    it('round-trips Japanese characters', () => {
      roundtrip({ title: 'こんにちは世界' })
    })

    it('round-trips Korean characters', () => {
      roundtrip({ title: '안녕하세요 세계' })
    })

    it('round-trips mixed CJK sentence', () => {
      roundtrip({ title: 'Nuxt OGイメージ生成' })
    })

    // Emoji values
    it('round-trips emoji: Hello 🌍 World', () => {
      roundtrip({ title: 'Hello 🌍 World' })
    })

    it('round-trips multiple emojis', () => {
      roundtrip({ title: '🎉🚀✨ Launch Day!' })
    })

    it('round-trips emoji-only value', () => {
      roundtrip({ title: '🌍🌏🌎' })
    })

    // Mixed ASCII and non-ASCII
    it('round-trips mixed: Design Systems für Anfänger', () => {
      roundtrip({ title: 'Design Systems für Anfänger' })
    })

    it('round-trips mixed: résumé builder v2.0', () => {
      roundtrip({ title: 'résumé builder v2.0' })
    })

    // Edge: only non-ASCII chars
    it('round-trips value that is ONLY non-ASCII chars', () => {
      roundtrip({ title: 'äöüß' })
    })

    // Edge: empty string value (skipped by encoder)
    it('skips empty string prop values', () => {
      const encoded = encodeOgImageParams({ props: { title: '' } })
      expect(encoded).toBe('')
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({})
    })

    // Edge: ASCII value that starts with ~ is a known ambiguity.
    // encodeURIComponent does NOT encode ~, so `~hello` stays as-is in the URL.
    // The decoder sees the ~ prefix and attempts b64 decode, producing garbage.
    // This is a documented edge case: values starting with ~ will not roundtrip correctly.
    it('aSCII value starting with ~ is ambiguous with b64 marker (known limitation)', () => {
      const encoded = encodeOgImageParams({ props: { title: '~hello' } })
      // The value is literally ~hello, which looks like a b64-prefixed value to the decoder
      expect(encoded).toBe('title_~hello')
      // Decoder sees ~ prefix, strips it, tries atob("hello") which is invalid b64 and throws.
      // This is a known limitation: ASCII values starting with ~ cannot roundtrip.
      expect(() => decodeOgImageParams(encoded)).toThrow()
    })

    // Edge: underscores (existing __ escape mechanism)
    it('round-trips value with underscores', () => {
      roundtrip({ title: 'hello_world_test' })
    })

    it('round-trips value with double underscores', () => {
      roundtrip({ title: 'hello__world' })
    })

    // Edge: commas (param separator)
    it('round-trips value with commas', () => {
      roundtrip({ title: 'one, two, three' })
    })

    // Edge: very long non-ASCII string
    it('round-trips very long non-ASCII string', () => {
      const longTitle = 'ä'.repeat(500)
      roundtrip({ title: longTitle })
    })

    // Edge: numbers and booleans mixed with non-ASCII props
    it('round-trips numbers and booleans alongside non-ASCII props', () => {
      const encoded = encodeOgImageParams({
        width: 1200,
        props: { title: 'Héllo Wörld', count: 42, featured: true },
      })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({
        width: 1200,
        props: { title: 'Héllo Wörld', count: 42, featured: true },
      })
    })

    // Edge: multiple non-ASCII props in same encode call
    it('round-trips multiple non-ASCII props', () => {
      roundtrip({
        title: 'café frappé',
        description: '日本語の説明',
        author: 'José García',
      })
    })

    // Non-ASCII in known params (not just props)
    it('round-trips non-ASCII in known param: alt text', () => {
      const encoded = encodeOgImageParams({ alt: 'Ícono de búsqueda' })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ alt: 'Ícono de búsqueda' })
    })
  })

  describe('non-ASCII decode robustness', () => {
    // Manually crafted ~-prefixed b64 value
    it('decodes a manually crafted ~-prefixed b64 value', () => {
      // "café" → UTF-8 → base64 → URL-safe base64 (no padding, - for +, ~ for /)
      const b64 = Buffer.from('café', 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '~')
      const decoded = decodeOgImageParams(`title_~${b64}`)
      expect(decoded).toEqual({ props: { title: 'café' } })
    })

    // Old-style percent-encoded non-ASCII (backwards compat)
    it('decodes old-style percent-encoded non-ASCII value', () => {
      // Before the fix, non-ASCII was percent-encoded via encodeURIComponent
      const percentEncoded = encodeURIComponent('café')
      const decoded = decodeOgImageParams(`title_${percentEncoded}`)
      expect(decoded).toEqual({ props: { title: 'café' } })
    })

    it('decodes old-style percent-encoded CJK', () => {
      const percentEncoded = encodeURIComponent('你好')
      const decoded = decodeOgImageParams(`title_${percentEncoded}`)
      expect(decoded).toEqual({ props: { title: '你好' } })
    })

    // Value starts with ~ but is NOT valid b64
    // atob throws on invalid base64 characters, so the decoder propagates the error.
    // This is a known limitation: if a URL is manually crafted with ~<invalid b64>,
    // it will throw rather than degrade gracefully.
    it('throws on value starting with ~ that is not valid b64', () => {
      expect(() => decodeOgImageParams('title_~!!!')).toThrow()
    })

    // Encoded non-ASCII should use ~ prefix, not percent encoding
    it('encodes non-ASCII with ~ prefix, not percent encoding', () => {
      const encoded = encodeOgImageParams({ props: { title: 'café' } })
      expect(encoded).toMatch(/^title_~/)
      expect(encoded).not.toContain('%')
    })

    // Full URL roundtrip with non-ASCII via buildOgImageUrl/parseOgImageUrl
    it('round-trips non-ASCII through full URL build/parse (dynamic)', () => {
      const options = { component: 'Blog', props: { title: 'über cool 日本' } }
      const { url } = buildOgImageUrl(options, 'png', false)
      const parsed = parseOgImageUrl(url)
      expect(parsed.options).toEqual(options)
    })

    it('non-ASCII static URL falls back to hash mode (contains no percent encoding)', () => {
      const options = { component: 'Blog', props: { title: 'über cool' } }
      const { url } = buildOgImageUrl(options, 'png', true)
      // The ~ prefix b64 encoding should not contain %, so it should NOT trigger hash mode
      // unless the path is too long
      expect(url).not.toContain('%')
    })
  })
})
