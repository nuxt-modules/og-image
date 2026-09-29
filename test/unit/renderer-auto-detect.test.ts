import { describe, expect, it } from 'vitest'
import { resolveAutoDetectedProvider } from '../../src/utils/dependencies'

describe('resolveAutoDetectedProvider', () => {
  it('keeps the provider renderer on mixed sites with screenshot pages', () => {
    const decision = resolveAutoDetectedProvider({
      hasUserComponents: false,
      installedProviders: ['takumi', 'satori'],
    })
    expect(decision).toEqual({ preferred: 'takumi', noRenderer: false })
  })

  it('prefers the first installed provider when takumi is absent', () => {
    const decision = resolveAutoDetectedProvider({
      hasUserComponents: false,
      installedProviders: ['satori'],
    })
    expect(decision).toEqual({ preferred: 'satori', noRenderer: false })
  })

  it('treats an installed browser provider as the preferred renderer', () => {
    const decision = resolveAutoDetectedProvider({
      hasUserComponents: false,
      installedProviders: ['browser'],
    })
    expect(decision).toEqual({ preferred: 'browser', noRenderer: false })
  })

  it('keeps the fallback when screenshot pages have no installed provider', () => {
    const decision = resolveAutoDetectedProvider({
      hasUserComponents: false,
      installedProviders: [],
    })
    expect(decision).toEqual({ preferred: null, noRenderer: true })
  })

  it('never auto-detects when user components were found on disk', () => {
    const decision = resolveAutoDetectedProvider({
      hasUserComponents: true,
      installedProviders: ['takumi'],
    })
    expect(decision).toEqual({ preferred: null, noRenderer: false })
  })
})
