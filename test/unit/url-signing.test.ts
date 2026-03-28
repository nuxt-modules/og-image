import { describe, expect, it } from 'vitest'
import {
  buildOgImageUrl,
  encodeOgImageParams,
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
  })

  describe('verifyOgImageSignature', () => {
    it('accepts valid signature', () => {
      const encoded = 'w_1200,h_600,c_OgImage'
      const sig = signEncodedParams(encoded, secret)
      expect(verifyOgImageSignature(encoded, sig, secret)).toBe(true)
    })

    it('rejects wrong signature', () => {
      expect(verifyOgImageSignature('w_1200,h_600', 'wrongsig000000000', secret)).toBe(false)
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
      // Extract the encoded segment and signature from the URL
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
  })
})
