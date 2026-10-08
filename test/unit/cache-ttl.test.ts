import { beforeEach, describe, expect, it, vi } from 'vitest'

// Storage backing `useStorage()` that always misses, so every render is written back.
const storage = {
  hasItem: vi.fn(async () => false),
  getItem: vi.fn(async () => null),
  setItem: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
}

vi.mock('#nuxtseo/nitro', () => ({
  useStorage: () => storage,
}))

vi.mock('#nuxtseo/h3', () => ({
  getQuery: () => ({}),
  setHeader: (e: any, k: string, v: string) => {
    e._headers[k] = v
  },
  setHeaders: (e: any, h: Record<string, string>) => Object.assign(e._headers, h),
  handleCacheHeaders: () => false,
  createError: (e: any) => e,
}))

const { useOgImageBufferCache } = await import('../../src/runtime/server/util/cache')

function makeCtx() {
  return { e: { _headers: {} as Record<string, string> }, key: 'k', _nitro: {} } as any
}

describe('useOgImageBufferCache storage TTL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not read or write storage when runtime caching is disabled', async () => {
    const ctx = makeCtx()
    const result = await useOgImageBufferCache(ctx, { baseCacheKey: false, cacheMaxAgeSeconds: 3600 }) as any
    await result.update(Buffer.from('img'))

    expect(result.enabled).toBe(false)
    expect(storage.hasItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(ctx.e._headers['X-OG-Cache']).toBe('DISABLED')
    expect(ctx.e._headers['Cache-Control']).toContain('no-store')
  })

  it('passes the cache TTL to the storage driver so unread entries expire', async () => {
    const result = await useOgImageBufferCache(makeCtx(), { baseCacheKey: 'og', cacheMaxAgeSeconds: 3600 }) as any
    await result.update(Buffer.from('img'))

    expect(storage.setItem).toHaveBeenCalledTimes(1)
    const [, entry, options] = storage.setItem.mock.calls[0] as any[]
    expect(options).toEqual({ ttl: 3600 })
    expect(entry.expiresAt).toBeGreaterThan(Date.now())
  })

  it('never passes a TTL under 60 seconds (Cloudflare KV minimum)', async () => {
    const result = await useOgImageBufferCache(makeCtx(), { baseCacheKey: 'og', cacheMaxAgeSeconds: 30 }) as any
    await result.update(Buffer.from('img'))

    const [, entry, options] = storage.setItem.mock.calls[0] as any[]
    expect(options).toEqual({ ttl: 60 })
    // Reads still honour the shorter lifetime
    expect(entry.expiresAt).toBeLessThanOrEqual(Date.now() + 30_000)
  })
})
