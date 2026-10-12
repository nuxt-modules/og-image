import { describe, expect, it } from 'vitest'
import { buildOgImageUrl, extractEncodedSegment, parseOgImageUrl, signEncodedParams, verifyOgImageSignature } from '../../src/runtime/shared'

describe('dynamic URL delimiters', () => {
  const options = { width: 1200, props: { title: 'Hello World', description: 'Comma, plus+ and %2C' } }
  const secret = 'delimiter-regression-secret'

  it('normalizes transport escapes before reading the signed segment', () => {
    const segment = 'w_1200,title_Hello+World'
    const signature = signEncodedParams(segment, secret)
    const path = `/_og/d/w_1200%2Ctitle_Hello%2BWorld%2Cs_${signature}.png`
    expect(extractEncodedSegment(path, 'png')).toBe(`${segment},s_${signature}`)
    expect(parseOgImageUrl(path).options).toEqual({ width: 1200, props: { title: 'Hello World' } })
  })

  it('emits escaped separators and spaces without changing decoded options', () => {
    const { url } = buildOgImageUrl(options)
    expect(url).not.toMatch(/[,+]/)
    expect(url).toContain('w_1200%2Ctitle_Hello%2BWorld%2C')
    expect(parseOgImageUrl(url).options).toEqual(options)
  })

  it.each(['escaped', 'decoded', 'lowercase', 'mixed'])('verifies a signed URL after %s transport', (transport) => {
    const { url } = buildOgImageUrl(options, 'png', false, undefined, secret)
    expect(url).not.toMatch(/[,+]/)
    const path = transport === 'decoded'
      ? decodeURIComponent(url)
      : transport === 'lowercase'
        ? url.replace(/%2C/g, '%2c').replace(/%2B/g, '%2b')
        : transport === 'mixed' ? url.replace(/%2C/g, ',') : url
    const segment = extractEncodedSegment(`/prefix${path}`, 'png')
    const [, params, signature] = segment.match(/^(.*),s_([^,]+)$/)!
    expect(signature).toBe(signEncodedParams(params!, secret))
    expect(verifyOgImageSignature(params!, signature!, secret)).toBe(true)
    expect(verifyOgImageSignature(params!.replace('w_1200', 'w_1201'), signature!, secret)).toBe(false)
    expect(parseOgImageUrl(path).options).toEqual(options)
  })

  it('keeps static hash URLs free of reserved characters', () => {
    const result = buildOgImageUrl(options, 'png', true, undefined, secret)
    expect(result.url).toBe(`/_og/s/o_${result.hash}.png`)
    expect(result.hash).toMatch(/^[a-f0-9]{16}$/)
    expect(parseOgImageUrl(result.url).hash).toBe(result.hash)
  })
})
