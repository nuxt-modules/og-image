import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import type { Storage } from 'unstorage'
import type { OgImageOptions } from '../../../types'

export const htmlPayloadCache: Storage<{ expiresAt: number, value: OgImageOptions }> = createStorage<{ expiresAt: number, value: OgImageOptions }>({
  // short cache time so we don't need many entries at runtime
  driver: lruCacheDriver({ max: import.meta.prerender ? 10000 : 50 }),
})

export const prerenderOptionsCache: Storage<OgImageOptions> | undefined = import.meta.prerender
  ? createStorage<OgImageOptions>({
    driver: lruCacheDriver({ max: 10000 }),
  })
  : undefined

export const fontCache = createStorage<BufferSource>({
  driver: lruCacheDriver({ max: 10 }),
})

export const emojiCache: Storage<string> = createStorage<string>({
  driver: lruCacheDriver({ max: 1000 }),
})
