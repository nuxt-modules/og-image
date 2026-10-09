import type { OgImageRenderEventContext } from '../../../types'
import type { Published } from './publish'
import { LRUCache } from 'lru-cache'

type Entry = { _tag: 'Published', image: Published, validUntil: number } | { _tag: 'Publishing', token: symbol, validUntil: number }

export function createPublishedImageCache(max = 1000) {
  const entries = new LRUCache<string, Entry>({ max })
  function read(key: string, now: number) {
    const entry = entries.get(key)
    if (entry && entry.validUntil <= now) {
      entries.delete(key)
      return
    }
    return entry
  }
  function remember(key: string, image: Published, now: number) {
    if (image.expiresAt > now)
      entries.set(key, { _tag: 'Published', image, validUntil: Math.min(image.expiresAt, now + 60_000) })
  }
  return {
    get(key: string, now: number) {
      const entry = read(key, now)
      return entry?._tag === 'Published' ? entry.image : undefined
    },
    isPublishing: (key: string, now: number) => read(key, now)?._tag === 'Publishing',
    remember,
    forget: (key: string) => { entries.delete(key) },
    begin(key: string, now: number, timeoutMs: number): symbol | undefined {
      if (read(key, now)?._tag === 'Publishing')
        return
      const token = Symbol(key)
      entries.set(key, { _tag: 'Publishing', token, validUntil: now + timeoutMs })
      return token
    },
    complete(key: string, token: symbol, result: Published | { _tag: 'Unavailable' }, now: number) {
      const entry = entries.peek(key)
      if (entry?._tag !== 'Publishing' || entry.token !== token)
        return
      entries.delete(key)
      if (result._tag === 'Published')
        remember(key, result, now)
    },
  }
}

export function getPublishedImageCache(app: OgImageRenderEventContext['_nitro']) {
  const state = app as typeof app & { _ogImagePublishedImages?: ReturnType<typeof createPublishedImageCache> }
  return state._ogImagePublishedImages ??= createPublishedImageCache()
}

export function getPublishedImageCacheKey(publish: { storage: string, baseURL: string }, key: string, extension: string): string {
  return JSON.stringify([publish.storage, publish.baseURL, key, extension])
}
