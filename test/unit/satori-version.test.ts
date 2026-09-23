import { describe, expect, it } from 'vitest'
import { isSupportedSatoriVersion } from '../../src/util'

describe('isSupportedSatoriVersion', () => {
  it('rejects versions without the GHSA-wx4j-mvgx-mqwp fix', () => {
    expect(isSupportedSatoriVersion('0.19.2')).toBe(false)
    expect(isSupportedSatoriVersion('0.32.0')).toBe(false)
    expect(isSupportedSatoriVersion('0.33.4')).toBe(false)
    expect(isSupportedSatoriVersion(undefined)).toBe(false)
  })

  it('accepts the patched release and later', () => {
    expect(isSupportedSatoriVersion('0.33.5')).toBe(true)
    expect(isSupportedSatoriVersion('0.33.10')).toBe(true)
    expect(isSupportedSatoriVersion('0.34.0')).toBe(true)
    expect(isSupportedSatoriVersion('1.0.0')).toBe(true)
  })
})
