import { hkdfSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeOgImageSigning } from '../../src/runtime/server/signing-secret'

const runtime = vi.hoisted(() => ({
  config: { 'appSecret': '', 'nuxt-og-image': { security: { secret: undefined, strict: false } } },
  derive: vi.fn<(purpose: string) => Promise<string>>(),
}))

vi.mock('nuxt/server', () => ({
  useRuntimeConfig: () => runtime.config,
  deriveSecret: runtime.derive,
  createError: (options: { message: string }) => new Error(options.message),
}))

let sequence = 0
const event = () => ({ context: {} as Record<string, unknown> })
const derived = (root: string) => Buffer.from(hkdfSync('sha256', root, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex')

describe('signing derivation cache', () => {
  beforeEach(() => {
    runtime.config.appSecret = `signing-cache-root-at-least-32-characters-${++sequence}`
    runtime.derive.mockReset().mockImplementation(async () => derived(runtime.config.appSecret))
  })
  afterEach(() => vi.restoreAllMocks())

  it('reuses a successful derivation for the current root', async () => {
    const first = event()
    const second = event()
    await initializeOgImageSigning(first)
    await initializeOgImageSigning(second)
    expect(first.context._ogImageSigningSecret).toBe(derived(runtime.config.appSecret))
    expect(second.context._ogImageSigningSecret).toBe(first.context._ogImageSigningSecret)
    expect(runtime.derive).toHaveBeenCalledTimes(1)
  })

  it('shares an in-flight derivation between requests with the same root', async () => {
    const pending = Promise.withResolvers<string>()
    runtime.derive.mockReturnValue(pending.promise)
    const first = event()
    const second = event()
    const requests = [initializeOgImageSigning(first), initializeOgImageSigning(second)]
    pending.resolve(derived(runtime.config.appSecret))
    await Promise.all(requests)
    expect(first.context._ogImageSigningSecret).toBe(second.context._ogImageSigningSecret)
    expect(first.context._ogImageSigningSecret).toBe(derived(runtime.config.appSecret))
    expect(runtime.derive).toHaveBeenCalledTimes(1)
  })

  it('captures each Nuxt root before a concurrent request rotates it', async () => {
    const firstRoot = runtime.config.appSecret
    const first = event()
    const firstRequest = initializeOgImageSigning(first)
    runtime.config.appSecret = `${firstRoot}-rotated`
    const second = event()
    await Promise.all([firstRequest, initializeOgImageSigning(second)])
    expect(first.context._ogImageSigningSecret).toBe(derived(firstRoot))
    expect(second.context._ogImageSigningSecret).toBe(derived(runtime.config.appSecret))
  })

  it('keeps only the current root instead of retaining old roots', async () => {
    const root = runtime.config.appSecret
    await initializeOgImageSigning(event())
    runtime.config.appSecret = `${root}-rotated`
    await initializeOgImageSigning(event())
    runtime.config.appSecret = root
    const restored = event()
    await initializeOgImageSigning(restored)
    expect(restored.context._ogImageSigningSecret).toBe(derived(root))
    expect(runtime.derive).toHaveBeenCalledTimes(3)
  })

  it('retries a failed derivation for the same root', async () => {
    runtime.derive.mockRejectedValueOnce(new Error('temporary crypto failure'))
    await expect(initializeOgImageSigning(event())).rejects.toThrow('temporary crypto failure')
    const retry = event()
    await initializeOgImageSigning(retry)
    expect(retry.context._ogImageSigningSecret).toBe(derived(runtime.config.appSecret))
    expect(runtime.derive).toHaveBeenCalledTimes(2)
  })

  it('keeps a newer cached root when an older derivation rejects', async () => {
    const old = Promise.withResolvers<string>()
    runtime.derive.mockReturnValueOnce(old.promise)
    const oldRequest = expect(initializeOgImageSigning(event())).rejects.toThrow('old crypto failure')
    runtime.config.appSecret += '-rotated'
    const current = event()
    await initializeOgImageSigning(current)
    old.reject(new Error('old crypto failure'))
    await oldRequest
    const next = event()
    await initializeOgImageSigning(next)
    expect(next.context._ogImageSigningSecret).toBe(current.context._ogImageSigningSecret)
    expect(runtime.derive).toHaveBeenCalledTimes(2)
  })

  it('does not reuse a warm key after the configured root becomes invalid', async () => {
    await initializeOgImageSigning(event())
    runtime.config.appSecret = ''
    runtime.derive.mockRejectedValue(new Error('Set NUXT_APP_SECRET'))
    await expect(initializeOgImageSigning(event())).rejects.toThrow('Set NUXT_APP_SECRET')
  })

  it('does not replace an observed Worker key with a Node cache entry', async () => {
    const configRoot = runtime.config.appSecret
    const bindingRoot = `${configRoot}-worker`
    const worker = { context: { cloudflare: { env: { NUXT_APP_SECRET: bindingRoot } } } as Record<string, unknown> }
    await initializeOgImageSigning(worker)
    runtime.config.appSecret = `${configRoot}-node`
    await initializeOgImageSigning(event())
    runtime.config.appSecret = configRoot
    const synthetic = event()
    await initializeOgImageSigning(synthetic)
    expect(synthetic.context._ogImageSigningSecret).toBe(derived(bindingRoot))
  })

  it('shares in-flight derivation for request-only Worker bindings', async () => {
    const root = `${runtime.config.appSecret}-binding`
    const importKey = vi.spyOn(crypto.subtle, 'importKey')
    const first = { context: { cloudflare: { env: { NUXT_APP_SECRET: root } } } as Record<string, unknown> }
    const second = { context: { cloudflare: { env: { NUXT_APP_SECRET: root } } } as Record<string, unknown> }
    await Promise.all([initializeOgImageSigning(first), initializeOgImageSigning(second)])
    expect(first.context._ogImageSigningSecret).toBe(derived(root))
    expect(second.context._ogImageSigningSecret).toBe(derived(root))
    expect(importKey).toHaveBeenCalledTimes(1)
  })
})
