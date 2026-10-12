import { createStorage, defineDriver } from 'unstorage'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Records every key the storage backend receives, after mount prefixes apply.
const received: string[] = []
const recordingDriver = defineDriver(() => {
  const data = new Map<string, unknown>()
  return {
    name: 'recording',
    hasItem: (key: string) => {
      received.push(key)
      return data.has(key)
    },
    getItem: (key: string) => {
      received.push(key)
      return data.get(key) ?? null
    },
    setItem: (key: string, value: unknown) => {
      received.push(key)
      data.set(key, value)
    },
    removeItem: (key: string) => {
      received.push(key)
      data.delete(key)
    },
    getKeys: () => [...data.keys()],
    clear: () => data.clear(),
  }
})

const storage = createStorage({ driver: recordingDriver() })
vi.mock('#nuxtseo/nitro', () => ({ useStorage: () => storage }))
vi.mock('#nuxtseo/h3', () => ({
  setHeader: () => {},
  setHeaders: () => {},
  handleCacheHeaders: () => false,
  createError: (error: unknown) => error,
}))

const { useOgImageBufferCache } = await import('../../src/runtime/server/util/cache')

const options = { baseCacheKey: '/og', cacheMaxAgeSeconds: 60 }

function contextFor(key: string) {
  return { e: { path: '/_og/d/c_Test.png' }, key, _nitro: {} } as any
}

async function store(key: string, image: Uint8Array) {
  const cache = await useOgImageBufferCache(contextFor(key), options)
  if (!cache || !('update' in cache))
    throw new Error('Expected buffer cache')
  await cache.update(image)
}

async function read(key: string, purge = false) {
  const cache = await useOgImageBufferCache(contextFor(key), { ...options, purge })
  if (!cache || !('cachedItem' in cache))
    throw new Error('Expected buffer cache')
  return cache.cachedItem
}

beforeEach(async () => {
  await storage.clear()
  received.length = 0
})

describe('runtime cache keys', () => {
  it.each([
    '/blog/post',
    '/blog/post#intro',
    '/search?q=1',
    '/a/../b',
    '/a/%2e%2e/b',
    '/a%2fb',
    '/a\\b',
    'custom key with spaces',
  ])('stores %j under a fixed-format key', async (key) => {
    await store(key, new Uint8Array([1]))
    expect(await read(key)).toEqual(Buffer.from([1]))
    expect(received.length).toBeGreaterThan(0)
    for (const storedKey of received)
      expect(storedKey).toMatch(/^og:image:[0-9a-f]{64}$/)
  })

  it('keeps one entry per key', async () => {
    await store('/page?v=1', new Uint8Array([1]))
    await store('/page?v=2', new Uint8Array([2]))
    await store('/page#v=3', new Uint8Array([3]))
    await store('/page', new Uint8Array([4]))

    expect(await read('/page?v=1')).toEqual(Buffer.from([1]))
    expect(await read('/page?v=2')).toEqual(Buffer.from([2]))
    expect(await read('/page#v=3')).toEqual(Buffer.from([3]))
    expect(await read('/page')).toEqual(Buffer.from([4]))
  })

  it('reads one stable key per identity', async () => {
    await store('/blog/post', new Uint8Array([7]))
    const first = [...received]
    received.length = 0
    await read('/blog/post')
    expect(new Set(received)).toEqual(new Set(first))
  })

  it('drops the entry when the caller passes an authorized purge', async () => {
    await store('/blog/post', new Uint8Array([7]))
    expect(await read('/blog/post', true)).toBe(false)
    expect(await read('/blog/post')).toBe(false)
  })
})
