import { describe, expect, it, vi } from 'vitest'
import { resolveSigningSecret } from '../../src/build/signing-secret'

const gen = () => 'GENERATED'

describe('resolveSigningSecret', () => {
  it('uses an explicit config secret', () => {
    const r = resolveSigningSecret('cfg-secret', undefined, gen)
    expect(r).toEqual({ secret: 'cfg-secret', hasExplicit: true, optOut: false, generated: false })
  })

  it('falls back to the env secret when no config value', () => {
    const r = resolveSigningSecret(undefined, 'env-secret', gen)
    expect(r).toEqual({ secret: 'env-secret', hasExplicit: true, optOut: false, generated: false })
  })

  it('prefers the config secret over the env secret', () => {
    const r = resolveSigningSecret('cfg-secret', 'env-secret', gen)
    expect(r.secret).toBe('cfg-secret')
  })

  it('auto-generates when neither config nor env is set', () => {
    const generate = vi.fn(() => 'RANDOM')
    const r = resolveSigningSecret(undefined, undefined, generate)
    expect(generate).toHaveBeenCalledOnce()
    expect(r).toEqual({ secret: 'RANDOM', hasExplicit: false, optOut: false, generated: true })
  })

  it('treats an empty-string config/env as unset and auto-generates', () => {
    const r = resolveSigningSecret('', '', gen)
    expect(r).toEqual({ secret: 'GENERATED', hasExplicit: false, optOut: false, generated: true })
  })

  it('opts out of signing entirely on `secret: false`', () => {
    const generate = vi.fn(gen)
    const r = resolveSigningSecret(false, 'env-secret', generate)
    // Opt-out wins over an env var, and never generates.
    expect(r).toEqual({ secret: '', hasExplicit: false, optOut: true, generated: false })
    expect(generate).not.toHaveBeenCalled()
  })
})
