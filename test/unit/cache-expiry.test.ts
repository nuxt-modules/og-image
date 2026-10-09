import { createStorage } from 'unstorage'
import { afterEach, expect, it, vi } from 'vitest'

const storage = createStorage()
vi.mock('#nuxtseo/nitro', () => ({ useStorage: () => storage }))
vi.mock('#nuxtseo/h3', () => ({
  setHeader: () => {},
  setHeaders: () => {},
  handleCacheHeaders: () => false,
  createError: (error: unknown) => error,
}))

const { useOgImageBufferCache } = await import('../../src/runtime/server/util/cache')

afterEach(() => vi.useRealTimers())

it('retains the original buffer expiry when serving a cache hit', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  const ctx = { e: { path: '/_og/d/title_Test.png' }, key: 'expiry-test', _nitro: {} } as any
  const options = { baseCacheKey: 'test-cache', cacheMaxAgeSeconds: 60 }
  const miss = await useOgImageBufferCache(ctx, options)
  if (!miss || !('update' in miss))
    throw new Error('Expected buffer cache')
  await miss.update(new Uint8Array([1, 2, 3]))
  expect(miss.expiresAt).toBe(61000)

  vi.setSystemTime(31000)
  const hit = await useOgImageBufferCache(ctx, options)
  if (!hit || !('cachedItem' in hit))
    throw new Error('Expected buffer cache')
  expect(hit.cachedItem).toEqual(Buffer.from([1, 2, 3]))
  expect(hit.expiresAt).toBe(61000)
})
