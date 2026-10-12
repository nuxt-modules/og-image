import { describe, expect, it } from 'vitest'
import { isSupportedSatoriVersion } from '../../src/util'

describe('isSupportedSatoriVersion', () => {
  it('rejects versions before the native layout baseline', () => {
    expect(isSupportedSatoriVersion('0.19.2')).toBe(false)
    expect(isSupportedSatoriVersion('0.32.0')).toBe(false)
    expect(isSupportedSatoriVersion('0.47.0')).toBe(false)
    expect(isSupportedSatoriVersion(undefined)).toBe(false)
  })

  it('accepts the patched release and later', () => {
    expect(isSupportedSatoriVersion('0.47.1')).toBe(true)
    expect(isSupportedSatoriVersion('0.47.2')).toBe(true)
    expect(isSupportedSatoriVersion('0.48.0')).toBe(true)
    expect(isSupportedSatoriVersion('1.0.0')).toBe(true)
  })
})
