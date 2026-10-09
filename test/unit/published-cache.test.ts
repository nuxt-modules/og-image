import { describe, expect, it } from 'vitest'
import { createPublishedImageCache } from '../../src/runtime/server/og-image/cache/published'

const image = { _tag: 'Published' as const, url: 'https://images.example/image.png', objectKey: 'image.png', expiresAt: 121000 }

describe('local published image URLs', () => {
  it('bounds local reuse to one minute and the original manifest expiry', () => {
    const cache = createPublishedImageCache()
    cache.remember('long', image, 1000)
    cache.remember('short', { ...image, expiresAt: 2000 }, 1000)
    expect(cache.get('long', 60999)).toEqual(image)
    expect(cache.get('long', 61000)).toBeUndefined()
    expect(cache.get('short', 2000)).toBeUndefined()
    cache.remember('expired', { ...image, expiresAt: 1000 }, 1000)
    expect(cache.get('expired', 1000)).toBeUndefined()
  })

  it('evicts the least recently used URL when capacity is reached', () => {
    const cache = createPublishedImageCache(2)
    cache.remember('a', image, 1000)
    cache.remember('b', image, 1000)
    expect(cache.get('a', 1000)).toEqual(image)
    cache.remember('c', image, 1000)
    expect(cache.get('b', 1000)).toBeUndefined()
    expect(cache.get('a', 1000)).toEqual(image)
    expect(cache.get('c', 1000)).toEqual(image)
  })

  it('deduplicates pending uploads and exposes URLs only after publication completes', () => {
    const cache = createPublishedImageCache()
    const token = cache.begin('image', 1000, 15000)!
    expect(cache.get('image', 1000)).toBeUndefined()
    expect(cache.begin('image', 1000, 15000)).toBeUndefined()
    cache.complete('image', token, image, 1000)
    expect(cache.get('image', 1000)).toEqual(image)
  })

  it('ignores an old upload result after a purge starts a replacement', () => {
    const cache = createPublishedImageCache()
    const old = cache.begin('image', 1000, 15000)!
    cache.forget('image')
    const fresh = cache.begin('image', 2000, 15000)!
    cache.complete('image', old, image, 2000)
    expect(cache.get('image', 2000)).toBeUndefined()
    cache.complete('image', fresh, { ...image, url: 'https://images.example/fresh.png' }, 2000)
    expect(cache.get('image', 2000)?.url).toBe('https://images.example/fresh.png')
  })

  it('allows retry after failed or expired pending uploads', () => {
    const cache = createPublishedImageCache()
    const failed = cache.begin('failed', 1000, 100)!
    cache.complete('failed', failed, { _tag: 'Unavailable' }, 1000)
    expect(cache.begin('failed', 1000, 100)).toBeDefined()
    cache.begin('expired', 1000, 100)
    expect(cache.begin('expired', 1100, 100)).toBeDefined()
  })
})
