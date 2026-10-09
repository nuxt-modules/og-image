import { hkdfSync } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeOgImageSigning } from '../../src/runtime/server/signing-secret'

const runtime = vi.hoisted(() => ({
  config: { 'appSecret': '', 'nuxt-og-image': { security: { secret: '' as string | false, strict: false } } },
  derive: vi.fn<(purpose: string) => Promise<string>>(),
}))

vi.mock('nuxt/server', () => ({
  useRuntimeConfig: () => runtime.config,
  deriveSecret: runtime.derive,
  createError: (options: { message: string }) => new Error(options.message),
}))

const rootSecret = 'root-secret-with-at-least-32-characters'
const expectedSecret = Buffer.from(hkdfSync('sha256', rootSecret, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex')

describe('request signing initialization', () => {
  beforeEach(() => {
    runtime.config.appSecret = rootSecret
    runtime.config['nuxt-og-image'].security.secret = ''
    runtime.derive.mockReset().mockImplementation(async purpose =>
      Buffer.from(hkdfSync('sha256', runtime.config.appSecret, 'nuxt', purpose, 32)).toString('hex'))
  })

  it('stores the purpose-derived Nuxt secret for synchronous URL helpers', async () => {
    const event = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(event)
    expect(event.context._ogImageSigningSecret).toBe(expectedSecret)
  })

  it('derives the same secret from request-only Cloudflare bindings', async () => {
    runtime.config.appSecret = ''
    const event = { context: { cloudflare: { env: { NUXT_APP_SECRET: rootSecret } } } as Record<string, unknown> }
    await initializeOgImageSigning(event)
    expect(event.context._ogImageSigningSecret).toBe(expectedSecret)
  })

  it.each(['short', '', false, 123, null])('rejects an invalid Cloudflare root %s', async (root) => {
    const event = { context: { cloudflare: { env: { NUXT_APP_SECRET: root } } } }
    await expect(initializeOgImageSigning(event)).rejects.toThrow('at least 32 characters')
  })

  it('propagates Nuxt secret failures instead of serving unsigned URLs', async () => {
    runtime.derive.mockRejectedValue(new Error('Missing appSecret'))
    await expect(initializeOgImageSigning({ context: {} })).rejects.toThrow('Missing appSecret')
  })

  it('keeps signing disabled without requiring appSecret', async () => {
    runtime.config['nuxt-og-image'].security.secret = false
    runtime.derive.mockRejectedValue(new Error('Missing appSecret'))
    const event = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(event)
    expect(event.context._ogImageSigningSecret).toBeUndefined()
  })

  it('isolates concurrent requests with different roots', async () => {
    runtime.config.appSecret = ''
    const otherRoot = `${rootSecret}-other`
    const first = { context: { cloudflare: { env: { NUXT_APP_SECRET: rootSecret } } } as Record<string, unknown> }
    const second = { context: { cloudflare: { env: { NUXT_APP_SECRET: otherRoot } } } as Record<string, unknown> }
    await Promise.all([initializeOgImageSigning(first), initializeOgImageSigning(second)])
    expect(first.context._ogImageSigningSecret).toBe(expectedSecret)
    expect(second.context._ogImageSigningSecret).toBe(Buffer.from(hkdfSync('sha256', otherRoot, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex'))
  })

  it('reuses the observed Cloudflare root for binding-less internal events', async () => {
    runtime.config.appSecret = ''
    runtime.derive.mockRejectedValue(new Error('`appSecret` is not set. Set `NUXT_APP_SECRET` to at least 32 characters, or pass a secret explicitly.'))
    const real = { context: { cloudflare: { env: { NUXT_APP_SECRET: rootSecret } } } as Record<string, unknown> }
    await initializeOgImageSigning(real)
    // Nitro internal $fetch events carry no Worker bindings.
    const synthetic = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(synthetic)
    expect(synthetic.context._ogImageSigningSecret).toBe(expectedSecret)
  })

  it('prefers Nuxt deriveSecret over the observed root when the shared appSecret is usable', async () => {
    runtime.config.appSecret = ''
    const real = { context: { cloudflare: { env: { NUXT_APP_SECRET: rootSecret } } } as Record<string, unknown> }
    await initializeOgImageSigning(real)
    runtime.config.appSecret = rootSecret
    runtime.derive.mockResolvedValue('nuxt-derived')
    const event = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(event)
    expect(event.context._ogImageSigningSecret).toBe('nuxt-derived')
  })

  it('refreshes the reused secret when the observed Cloudflare root changes', async () => {
    runtime.config.appSecret = ''
    const otherRoot = `${rootSecret}-other`
    await initializeOgImageSigning({ context: { cloudflare: { env: { NUXT_APP_SECRET: rootSecret } } } })
    await initializeOgImageSigning({ context: { cloudflare: { env: { NUXT_APP_SECRET: otherRoot } } } })
    const synthetic = { context: {} as Record<string, unknown> }
    await initializeOgImageSigning(synthetic)
    expect(synthetic.context._ogImageSigningSecret).toBe(Buffer.from(hkdfSync('sha256', otherRoot, 'nuxt', 'nuxt-og-image:url-signing', 32)).toString('hex'))
  })
})
