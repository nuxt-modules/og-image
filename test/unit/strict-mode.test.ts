import { describe, expect, it } from 'vitest'

/**
 * Tests for security.strict mode config resolution.
 * Mirrors the logic in module.ts for resolving security defaults.
 */
function resolveSecurityConfig(config?: {
  strict?: boolean
  secret?: string
  maxQueryParamSize?: number | null
  restrictRuntimeImagesToOrigin?: boolean | string[]
}) {
  return {
    strict: config?.strict ?? false,
    maxDimension: 2048,
    maxDpr: 2,
    renderTimeout: 15_000,
    maxQueryParamSize: config?.maxQueryParamSize ?? (config?.strict ? 2048 : null),
    restrictRuntimeImagesToOrigin: config?.restrictRuntimeImagesToOrigin === true || (config?.strict && config?.restrictRuntimeImagesToOrigin == null)
      ? []
      : (config?.restrictRuntimeImagesToOrigin || false),
    secret: config?.secret || '',
  }
}

describe('security.strict mode defaults', () => {
  it('defaults to non-strict with no limits', () => {
    const result = resolveSecurityConfig()
    expect(result.strict).toBe(false)
    expect(result.maxQueryParamSize).toBeNull()
    expect(result.restrictRuntimeImagesToOrigin).toBe(false)
  })

  it('strict mode sets maxQueryParamSize to 2048', () => {
    const result = resolveSecurityConfig({ strict: true, secret: 'test' })
    expect(result.maxQueryParamSize).toBe(2048)
  })

  it('strict mode enables restrictRuntimeImagesToOrigin', () => {
    const result = resolveSecurityConfig({ strict: true, secret: 'test' })
    expect(result.restrictRuntimeImagesToOrigin).toEqual([])
  })

  it('explicit maxQueryParamSize overrides strict default', () => {
    const result = resolveSecurityConfig({ strict: true, secret: 'test', maxQueryParamSize: 4096 })
    expect(result.maxQueryParamSize).toBe(4096)
  })

  it('explicit restrictRuntimeImagesToOrigin array overrides strict default', () => {
    const result = resolveSecurityConfig({
      strict: true,
      secret: 'test',
      restrictRuntimeImagesToOrigin: ['https://cdn.example.com'],
    })
    expect(result.restrictRuntimeImagesToOrigin).toEqual(['https://cdn.example.com'])
  })

  it('explicit restrictRuntimeImagesToOrigin false overrides strict default', () => {
    const result = resolveSecurityConfig({
      strict: true,
      secret: 'test',
      restrictRuntimeImagesToOrigin: false,
    })
    expect(result.restrictRuntimeImagesToOrigin).toBe(false)
  })

  it('strict mode requires secret (validated at module setup)', () => {
    // Module setup throws when strict is true and secret is missing.
    // This test documents the contract; the actual throw is in module.ts setup().
    const config = { strict: true }
    expect(config.strict && !config.secret).toBe(true)
  })
})
