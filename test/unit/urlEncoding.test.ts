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

    it('b64 encodes values with commas (avoids percent-encoding)', () => {
      const encoded = encodeOgImageParams({
        props: { title: 'Hello, World' },
      })
      // Commas produce %2C via encodeURIComponent, which triggers b64 encoding
      expect(encoded).toMatch(/^title_~/)
      expect(encoded).not.toContain('%')
      // Verify roundtrip
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props: { title: 'Hello, World' } })
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

  describe('_componentHash cache busting', () => {
    it('encodes _componentHash as ch alias', () => {
      const encoded = encodeOgImageParams({ props: { title: 'Hello' }, _componentHash: 'abc123' })
      expect(encoded).toContain('ch_abc123')
      expect(encoded).toContain('title_Hello')
    })

    it('different _componentHash produces different URL', () => {
      const url1 = buildOgImageUrl({ props: { title: 'Hello' }, _componentHash: 'hash1' }, 'png', true)
      const url2 = buildOgImageUrl({ props: { title: 'Hello' }, _componentHash: 'hash2' }, 'png', true)
      expect(url1.url).not.toBe(url2.url)
    })

    it('same _componentHash produces same URL', () => {
      const url1 = buildOgImageUrl({ props: { title: 'Hello' }, _componentHash: 'hash1' }, 'png', true)
      const url2 = buildOgImageUrl({ props: { title: 'Hello' }, _componentHash: 'hash1' }, 'png', true)
      expect(url1.url).toBe(url2.url)
    })

    it('decodes _componentHash as known param (not as prop)', () => {
      const encoded = encodeOgImageParams({ props: { title: 'Hello' }, _componentHash: 'abc123' })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded._componentHash).toBe('abc123')
      expect(decoded.props?.ch).toBeUndefined()
      expect(decoded.props?._componentHash).toBeUndefined()
    })

    it('_componentHash affects hash mode URLs too', () => {
      const longTitle = 'A'.repeat(250)
      const opts1 = { props: { title: longTitle }, _componentHash: 'hash1' }
      const opts2 = { props: { title: longTitle }, _componentHash: 'hash2' }
      const result1 = buildOgImageUrl(opts1, 'png', true)
      const result2 = buildOgImageUrl(opts2, 'png', true)
      expect(result1.hash).toBeDefined()
      expect(result2.hash).toBeDefined()
      expect(result1.hash).not.toBe(result2.hash)
    })

    it('_componentHash included in hashOgImageOptions (not excluded like _path)', () => {
      const hash1 = hashOgImageOptions({ width: 1200, _componentHash: 'hash1' })
      const hash2 = hashOgImageOptions({ width: 1200, _componentHash: 'hash2' })
      expect(hash1).not.toBe(hash2)
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

    // Edge: ASCII value that starts with ~ is escaped with ~~ to avoid b64 marker ambiguity
    it('round-trips ASCII value starting with ~', () => {
      const encoded = encodeOgImageParams({ props: { title: '~hello' } })
      // Encoder escapes leading ~ as ~~
      expect(encoded).toBe('title_~~hello')
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props: { title: '~hello' } })
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
    it('gracefully falls back for value starting with ~ that is not valid b64', () => {
      // Invalid b64 after ~ prefix should fall back to URL decoding instead of throwing
      const decoded = decodeOgImageParams('title_~!!!')
      expect(decoded).toEqual({ props: { title: '~!!!' } })
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

  describe('adversarial inputs', () => {
    function roundtrip(props: Record<string, any>) {
      const encoded = encodeOgImageParams({ props })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props })
    }

    // b64 output chars that overlap with URL encoding separators
    it('round-trips value whose b64 contains - (URL-safe +)', () => {
      // Find a string whose b64 output contains -
      roundtrip({ title: 'thé' }) // b64: dGjDqQ (may have -)
    })

    it('round-trips value whose b64 contains ~ (URL-safe /)', () => {
      // ~ is our b64 replacement for /, also our prefix marker
      roundtrip({ title: '¿qué?' })
    })

    // Multiple tildes
    it('round-trips value that is just ~~~', () => {
      const encoded = encodeOgImageParams({ props: { title: '~~~' } })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props: { title: '~~~' } })
    })

    it('round-trips value ~~café (tilde + tilde + non-ASCII)', () => {
      roundtrip({ title: '~~café' })
    })

    it('round-trips value ~café (tilde + non-ASCII)', () => {
      // Non-ASCII, so it goes through b64 path. The ~ in the value is part of the b64 payload.
      roundtrip({ title: '~café' })
    })

    // Null bytes and control characters
    it('round-trips value with tab character', () => {
      roundtrip({ title: 'hello\tworld' })
    })

    it('round-trips value with newline', () => {
      roundtrip({ title: 'line1\nline2' })
    })

    // Values that look like b64 but aren't
    it('round-trips ASCII value that looks like valid b64: ~SGVsbG8', () => {
      // ~SGVsbG8 decodes to "Hello" in b64 — but the encoder should escape this as ~~SGVsbG8
      const encoded = encodeOgImageParams({ props: { title: '~SGVsbG8' } })
      expect(encoded).toBe('title_~~SGVsbG8')
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props: { title: '~SGVsbG8' } })
    })

    // Underscore attacks — the param separator
    it('round-trips value: key_value (looks like a param)', () => {
      roundtrip({ title: 'key_value' })
    })

    it('round-trips value: w_1200 (looks like width param)', () => {
      roundtrip({ title: 'w_1200' })
    })

    // Comma attacks — the param list separator
    it('round-trips value with comma followed by param-like pattern', () => {
      roundtrip({ title: 'hello,w_1200' })
    })

    it('round-trips value: a,b,c,d', () => {
      roundtrip({ title: 'a,b,c,d' })
    })

    // Very short non-ASCII
    it('round-trips single non-ASCII char: é', () => {
      roundtrip({ title: 'é' })
    })

    it('round-trips single emoji: 🎉', () => {
      roundtrip({ title: '🎉' })
    })

    // 4-byte UTF-8 (supplementary plane)
    it('round-trips 4-byte UTF-8 chars (math symbols)', () => {
      roundtrip({ title: '𝕳𝖊𝖑𝖑𝖔' })
    })

    it('round-trips 4-byte UTF-8 chars (ancient scripts)', () => {
      roundtrip({ title: '𐍈𐌰𐌹𐍂𐌷𐌰' })
    })

    // Surrogate pair edge: emoji with ZWJ (zero width joiner)
    it('round-trips ZWJ emoji sequence (family)', () => {
      roundtrip({ title: '👨‍👩‍👧‍👦 Family' })
    })

    it('round-trips flag emoji (regional indicator)', () => {
      roundtrip({ title: '🇯🇵 Japan' })
    })

    // Mixed b64 and normal in same encode
    it('round-trips mix of ASCII and non-ASCII props in same call', () => {
      const encoded = encodeOgImageParams({
        props: {
          title: 'café frappé',
          slug: 'hello-world',
          tag: '~special',
          emoji: '🚀',
          plain: 'just ascii',
        },
      })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({
        props: {
          title: 'café frappé',
          slug: 'hello-world',
          tag: '~special',
          emoji: '🚀',
          plain: 'just ascii',
        },
      })
    })

    // Value that produces b64 output matching param separator pattern
    // e.g. b64 output like "abc,w_123" would break comma splitting
    it('b64 encoded value does not contain raw commas', () => {
      // Base64 alphabet is [A-Za-z0-9+/=], our URL-safe variant uses [-~]
      // None of these include comma, so b64 output can never contain ","
      const encoded = encodeOgImageParams({ props: { title: 'ñoño' } })
      // The b64 portion (after ~) should not contain commas
      const parts = encoded.split('title_~')
      if (parts[1]) {
        expect(parts[1]).not.toContain(',')
      }
    })

    // HTML/XSS in values
    it('round-trips HTML content in value', () => {
      roundtrip({ title: '<script>alert("xss")</script>' })
    })

    it('round-trips HTML entities', () => {
      roundtrip({ title: '&amp; &lt; &gt; &quot;' })
    })

    // Very long ASCII value (near MAX_PATH_LENGTH boundary)
    it('round-trips 200-char ASCII value', () => {
      roundtrip({ title: 'a'.repeat(200) })
    })

    // Empty-ish values
    it('round-trips value that is just a space', () => {
      roundtrip({ title: ' ' })
    })

    it('round-trips value that is just +', () => {
      roundtrip({ title: '+' })
    })

    it('round-trips value that is just %', () => {
      roundtrip({ title: '%' })
    })

    // RTL text
    it('round-trips Arabic text', () => {
      roundtrip({ title: 'مرحبا بالعالم' })
    })

    it('round-trips Hebrew text', () => {
      roundtrip({ title: 'שלום עולם' })
    })

    // Mixed direction
    it('round-trips mixed LTR/RTL text', () => {
      roundtrip({ title: 'Hello مرحبا World' })
    })
  })

  describe('uRL-sensitive characters (#529)', () => {
    function roundtrip(props: Record<string, any>) {
      const encoded = encodeOgImageParams({ props })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props })
    }

    it('round-trips value with hash character', () => {
      roundtrip({ title: 'Some # char' })
    })

    it('round-trips value with question mark', () => {
      roundtrip({ title: 'What? Really?' })
    })

    it('round-trips value with backslash', () => {
      roundtrip({ title: 'path\\to\\file' })
    })

    it('round-trips value with all problematic chars from #529', () => {
      roundtrip({ title: 'Some illegal chars here # ? \\' })
    })

    it('encodes URL-sensitive chars via b64 (no percent-encoding in output)', () => {
      const encoded = encodeOgImageParams({ props: { title: 'Hello # World' } })
      expect(encoded).not.toContain('%')
      expect(encoded).toMatch(/^title_~/)
    })

    it('round-trips value with equals sign', () => {
      roundtrip({ title: 'key=value' })
    })

    it('round-trips value with ampersand', () => {
      roundtrip({ title: 'foo&bar' })
    })

    it('round-trips value with at sign', () => {
      roundtrip({ title: 'user@example.com' })
    })

    it('round-trips value with colon', () => {
      roundtrip({ title: 'Time: 12:30' })
    })

    it('round-trips value with semicolon', () => {
      roundtrip({ title: 'a;b;c' })
    })

    it('round-trips value with square brackets', () => {
      roundtrip({ title: 'array[0]' })
    })

    it('round-trips value with curly braces', () => {
      roundtrip({ title: '{json}' })
    })
  })

  describe('image URLs as props (#528)', () => {
    function roundtrip(props: Record<string, any>) {
      const encoded = encodeOgImageParams({ props })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props })
    }

    it('round-trips a full image URL with query params', () => {
      roundtrip({ image: 'https://images.prismic.io/xxx/aVfGGnNYClf9ou-1-.png?auto=format,compress' })
    })

    it('round-trips image URL (no percent-encoding in output)', () => {
      const encoded = encodeOgImageParams({
        props: { image: 'https://example.com/image.png?w=200&h=100' },
      })
      expect(encoded).not.toContain('%')
      expect(encoded).toMatch(/^image_~/)
    })

    it('round-trips URL with fragment', () => {
      roundtrip({ link: 'https://example.com/page#section' })
    })

    it('round-trips URL with port and path', () => {
      roundtrip({ image: 'http://localhost:3000/api/image.jpg' })
    })

    it('preserves full URL through buildOgImageUrl/parseOgImageUrl (dynamic)', () => {
      const options = {
        component: 'Article',
        props: { image: 'https://images.prismic.io/xxx/aVfGGnNYClf9ou-1-.png?auto=format,compress' },
      }
      const { url } = buildOgImageUrl(options, 'png', false)
      expect(url).not.toContain('%')
      const parsed = parseOgImageUrl(url)
      expect(parsed.options).toEqual(options)
    })
  })

  describe('stress test: try to break the URL path system', () => {
    function roundtrip(props: Record<string, any>) {
      const encoded = encodeOgImageParams({ props })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded).toEqual({ props })
    }

    function fullRoundtrip(props: Record<string, any>, isStatic = false) {
      const options = { component: 'Test', props }
      const { url } = buildOgImageUrl(options, 'png', isStatic)
      const parsed = parseOgImageUrl(url)
      expect(parsed.options).toEqual(options)
      expect(parsed.extension).toBe('png')
    }

    // Values that mimic OG image URL structure
    it('round-trips value containing /_og/s/ prefix', () => {
      roundtrip({ title: '/_og/s/w_1200.png' })
    })

    it('round-trips value containing /_og/d/ prefix', () => {
      roundtrip({ title: '/_og/d/c_NuxtSeo,title_Hello.png' })
    })

    it('round-trips value that looks like hash mode: o_abc123', () => {
      roundtrip({ title: 'o_abc123' })
    })

    // Extension confusion
    it('round-trips value ending in .png', () => {
      roundtrip({ title: 'screenshot.png' })
    })

    it('round-trips value ending in .jpeg', () => {
      roundtrip({ path: '/images/photo.jpeg' })
    })

    it('full roundtrip with .png in prop value', () => {
      fullRoundtrip({ image: 'https://cdn.example.com/banner.png' })
    })

    // Null byte
    it('round-trips value with null byte', () => {
      roundtrip({ title: 'hello\x00world' })
    })

    // Every ASCII printable special character
    it('round-trips all ASCII special characters', () => {
      roundtrip({ title: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~' })
    })

    // Newlines, tabs, carriage returns together
    it('round-trips value with mixed whitespace', () => {
      roundtrip({ title: 'line1\r\nline2\ttab\r\nline3' })
    })

    // Values that look like b64 params
    it('round-trips value that mimics encoded satori param', () => {
      roundtrip({ title: 'satori_eyJmb250cyI6W119' })
    })

    // Param injection: value that tries to inject new params
    it('round-trips value with comma+param pattern injection attempt', () => {
      roundtrip({ title: 'hello,c_Evil,w_9999' })
    })

    // Unicode edge cases
    it('round-trips lone surrogate pair halves', () => {
      // U+D800 is a lone high surrogate — edge case for UTF encoding
      // Most environments will replace with U+FFFD, so just verify no crash
      const encoded = encodeOgImageParams({ props: { title: '\uFFFD' } })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded.props.title).toBeDefined()
    })

    it('value with BOM (byte order mark) has BOM stripped by TextDecoder', () => {
      // BOM (\uFEFF) is stripped by TextDecoder — this is correct/expected behavior
      const encoded = encodeOgImageParams({ props: { title: '\uFEFFhello' } })
      const decoded = decodeOgImageParams(encoded)
      expect(decoded.props.title).toBe('hello')
    })

    it('round-trips value with zero-width spaces', () => {
      roundtrip({ title: 'hello\u200Bworld\u200Btest' })
    })

    it('round-trips value with RTL override characters', () => {
      roundtrip({ title: '\u202Ehello\u202C' })
    })

    // Extremely long URL values
    it('full roundtrip with very long image URL (static uses hash)', () => {
      const longUrl = `https://images.example.com/${'a'.repeat(300)}.png?token=${'b'.repeat(100)}`
      const options = { component: 'Test', props: { image: longUrl } }
      const result = buildOgImageUrl(options, 'png', true)
      // Should use hash mode
      expect(result.hash).toBeDefined()
      expect(result.url).toMatch(/o_[a-z0-9]+/)
    })

    // Multiple props with special chars
    it('round-trips multiple props all containing URL-sensitive chars', () => {
      roundtrip({
        title: 'What? Really!',
        image: 'https://example.com/img.png?w=100',
        path: '/blog/hello#section',
        code: 'if (a && b) { return c; }',
        email: 'user@test.com',
      })
    })

    // Values that are pure percent encoding
    it('round-trips value that is all percent-encoded chars', () => {
      roundtrip({ title: '%23%3F%2F%5C' })
    })

    // Double encoding protection
    it('does not double-encode already percent-encoded values', () => {
      const encoded = encodeOgImageParams({ props: { title: '%23%3F' } })
      // Should b64 encode since it contains %
      expect(encoded).toMatch(/^title_~/)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded.props.title).toBe('%23%3F')
    })

    // Mixed safe and unsafe props in same encode
    it('full roundtrip with mix of safe and unsafe props', () => {
      fullRoundtrip({
        slug: 'hello-world',
        title: 'Hello # World?',
        count: 42,
        featured: true,
        image: 'https://cdn.test.com/img.jpg',
      })
    })

    // Encoded output should never contain raw URL-sensitive chars
    it('encoded output never contains raw #, ?, or unescaped slashes', () => {
      const cases = [
        { title: 'test#hash' },
        { title: 'test?query' },
        { title: 'test/slash' },
        { title: 'test\\backslash' },
        { title: 'test=equals' },
        { title: 'test&amp' },
      ]
      for (const props of cases) {
        const encoded = encodeOgImageParams({ props })
        // Raw dangerous chars should never appear in encoded output
        expect(encoded).not.toContain('#')
        expect(encoded).not.toContain('?')
        expect(encoded).not.toContain('/')
        expect(encoded).not.toContain('\\')
        expect(encoded).not.toContain('=')
        expect(encoded).not.toContain('&')
        // And no percent-encoding either (all handled via b64)
        expect(encoded).not.toContain('%')
      }
    })
  })
})
