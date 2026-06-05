import { describe, expect, it, vi } from 'vitest'

// Controllable storage backing `useStorage()` so we can simulate a KV binding
// that probes fine but fails on read (NuxtHub binding dropping mid-request).
const storage = {
  hasItem: vi.fn(async () => true),
  getItem: vi.fn(async () => {
    throw new Error('KV unreachable')
  }),
  setItem: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
}

vi.mock('nitropack/runtime', () => ({
  useStorage: () => storage,
}))

// h3 helpers operate on a real event; record header writes on a plain object instead.
vi.mock('h3', () => ({
  getQuery: () => ({}),
  setHeader: (e: any, k: string, v: string) => {
    e._headers[k] = v
  },
  setHeaders: (e: any, h: Record<string, string>) => Object.assign(e._headers, h),
  handleCacheHeaders: () => false,
  createError: (e: any) => e,
}))

const { useOgImageBufferCache } = await import('../../src/runtime/server/util/cache')
const { logger } = await import('../../src/runtime/logger')

function makeCtx(nitro: any = {}) {
  return { e: { _headers: {} as Record<string, string> }, key: 'k', _nitro: nitro } as any
}

describe('useOgImageBufferCache backend degradation', () => {
  it('treats a getItem failure after a successful hasItem as degraded, not a normal miss', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const ctx = makeCtx()

    const result = await useOgImageBufferCache(ctx, { baseCacheKey: 'og', cacheMaxAgeSeconds: 3600 }) as any

    // Degraded: caching disabled for this request, nothing served from cache.
    expect(result.enabled).toBe(false)
    expect(result.cachedItem).toBe(false)
    // No-store headers so the broken read isn't cached downstream.
    expect(ctx.e._headers['Cache-Control']).toContain('no-store')
    expect(warn).toHaveBeenCalledTimes(1)

    // The render still completes; the response is reported DISABLED, never written back.
    await result.update(Buffer.from('img'))
    expect(ctx.e._headers['X-OG-Cache']).toBe('DISABLED')
    expect(storage.setItem).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it('warns only once per Nitro app even across requests', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const nitro = {}

    await useOgImageBufferCache(makeCtx(nitro), { baseCacheKey: 'og', cacheMaxAgeSeconds: 3600 })
    await useOgImageBufferCache(makeCtx(nitro), { baseCacheKey: 'og', cacheMaxAgeSeconds: 3600 })

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
