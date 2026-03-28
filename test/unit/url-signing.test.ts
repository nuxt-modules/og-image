import { describe, expect, it } from 'vitest'
import {
  buildOgImageUrl,
  decodeOgImageParams,
  encodeOgImageParams,
  parseOgImageUrl,
  signEncodedParams,
  verifyOgImageSignature,
} from '../../src/runtime/shared/urlEncoding'

describe('url signing', () => {
  const secret = 'test-secret-abc123'

  describe('signEncodedParams', () => {
    it('produces a 16-char signature', () => {
      const sig = signEncodedParams('w_1200,h_600', secret)
      expect(sig).toHaveLength(16)
    })

    it('is deterministic', () => {
      const a = signEncodedParams('w_1200,h_600', secret)
      const b = signEncodedParams('w_1200,h_600', secret)
      expect(a).toBe(b)
    })

    it('changes with different input', () => {
      const a = signEncodedParams('w_1200,h_600', secret)
      const b = signEncodedParams('w_800,h_400', secret)
      expect(a).not.toBe(b)
    })

    it('changes with different secret', () => {
      const a = signEncodedParams('w_1200,h_600', secret)
      const b = signEncodedParams('w_1200,h_600', 'other-secret')
      expect(a).not.toBe(b)
    })

    it('handles unicode content', () => {
      const sig = signEncodedParams('title_~SGVsbG8g8J-Yig', secret)
      expect(sig).toHaveLength(16)
    })

    it('handles empty string', () => {
      const sig = signEncodedParams('default', secret)
      expect(sig).toHaveLength(16)
    })
  })

  describe('verifyOgImageSignature', () => {
    it('accepts valid signature', () => {
      const encoded = 'w_1200,h_600,c_OgImage'
      const sig = signEncodedParams(encoded, secret)
      expect(verifyOgImageSignature(encoded, sig, secret)).toBe(true)
    })

    it('rejects wrong signature', () => {
      expect(verifyOgImageSignature('w_1200,h_600', 'wrongsig00000000', secret)).toBe(false)
    })

    it('rejects wrong secret', () => {
      const encoded = 'w_1200,h_600'
      const sig = signEncodedParams(encoded, secret)
      expect(verifyOgImageSignature(encoded, sig, 'wrong-secret')).toBe(false)
    })

    it('rejects tampered params', () => {
      const encoded = 'w_1200,h_600'
      const sig = signEncodedParams(encoded, secret)
      expect(verifyOgImageSignature('w_9999,h_9999', sig, secret)).toBe(false)
    })

    it('rejects mismatched length signatures', () => {
      expect(verifyOgImageSignature('w_1200', 'short', secret)).toBe(false)
    })

    it('rejects single-char difference', () => {
      const encoded = 'w_1200,h_600'
      const sig = signEncodedParams(encoded, secret)
      const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
      expect(verifyOgImageSignature(encoded, tampered, secret)).toBe(false)
    })
  })

  describe('buildOgImageUrl with signing', () => {
    const options = { width: 1200, height: 600, component: 'OgImage', _path: '/about' }

    it('appends signature when secret provided', () => {
      const result = buildOgImageUrl(options, 'png', false, undefined, secret)
      expect(result.url).toMatch(/,s_[\w-]{16}\.png$/)
    })

    it('does not append signature without secret', () => {
      const result = buildOgImageUrl(options, 'png', false, undefined)
      expect(result.url).not.toContain(',s_')
    })

    it('does not sign static/prerender URLs', () => {
      const result = buildOgImageUrl(options, 'png', true, undefined, secret)
      expect(result.url).not.toContain(',s_')
    })

    it('produces verifiable signatures', () => {
      const result = buildOgImageUrl(options, 'png', false, undefined, secret)
      const path = result.url.replace(/^\/_og\/d\//, '').replace(/\.png$/, '')
      const sigMatch = path.match(/,s_([^,]+)$/)
      expect(sigMatch).toBeTruthy()
      const signature = sigMatch![1]
      const paramsSegment = path.slice(0, sigMatch!.index!)
      expect(verifyOgImageSignature(paramsSegment, signature, secret)).toBe(true)
    })

    it('signature is stable across calls', () => {
      const a = buildOgImageUrl(options, 'png', false, undefined, secret)
      const b = buildOgImageUrl(options, 'png', false, undefined, secret)
      expect(a.url).toBe(b.url)
    })

    it('uses dynamic prefix for signed URLs', () => {
      const result = buildOgImageUrl(options, 'png', false, undefined, secret)
      expect(result.url).toMatch(/^\/_og\/d\//)
    })

    it('works with all extensions', () => {
      for (const ext of ['png', 'jpeg', 'webp', 'svg', 'html']) {
        const result = buildOgImageUrl(options, ext, false, undefined, secret)
        expect(result.url).toContain(`,s_`)
        expect(result.url.endsWith(`.${ext}`)).toBe(true)
      }
    })

    it('does not sign hash-mode URLs', () => {
      // Hash mode triggers when isStatic + path too long
      const longProps: Record<string, string> = {}
      for (let i = 0; i < 20; i++)
        longProps[`prop${i}`] = `value-that-is-long-enough-${i}`
      const result = buildOgImageUrl({ ...options, props: longProps }, 'png', true, undefined, secret)
      // Hash mode uses o_ prefix
      if (result.url.includes('/o_')) {
        expect(result.url).not.toContain(',s_')
      }
    })
  })

  describe('encode/decode round-trip with signatures', () => {
    it('signature does not interfere with param decoding', () => {
      const options = { width: 1200, height: 600, component: 'OgImage' }
      const encoded = encodeOgImageParams(options)
      const sig = signEncodedParams(encoded, secret)
      const withSig = `${encoded},s_${sig}`

      // Stripping signature should yield original params
      const stripped = withSig.replace(/,s_[^,]+$/, '')
      const decoded = decodeOgImageParams(stripped)
      expect(decoded.width).toBe(1200)
      expect(decoded.height).toBe(600)
      expect(decoded.component).toBe('OgImage')
    })

    it('prop named "s" does not conflict when no signing', () => {
      // A component prop named "s" should encode as s_value
      const options = { width: 1200, props: { s: 'hello' } }
      const encoded = encodeOgImageParams(options)
      const decoded = decodeOgImageParams(encoded)
      expect(decoded.props?.s).toBe('hello')
    })

    it('parseOgImageUrl strips signature from signed URLs', () => {
      const options = { width: 1200, height: 600, component: 'OgImage' }
      const result = buildOgImageUrl(options, 'png', false, undefined, secret)
      const parsed = parseOgImageUrl(result.url)
      expect(parsed.options.width).toBe(1200)
      expect(parsed.options.height).toBe(600)
      expect(parsed.options.component).toBe('OgImage')
      // Signature should not appear as a prop
      expect(parsed.options.props?.s).toBeUndefined()
    })

    it('parseOgImageUrl works with unsigned URLs', () => {
      const options = { width: 800, height: 400 }
      const result = buildOgImageUrl(options, 'png', false)
      const parsed = parseOgImageUrl(result.url)
      expect(parsed.options.width).toBe(800)
      expect(parsed.options.height).toBe(400)
    })
  })
})
