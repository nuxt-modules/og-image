import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import type { OgImageOptions } from '../../types'

export const htmlPayloadCache = createStorage<{ expiresAt: number, value: OgImageOptions }>({
  // short cache time so we don't need many entries at runtime
  driver: lruCacheDriver({ max: import.meta.prerender ? 1000 : 50 }),
})

export const prerenderOptionsCache = import.meta.prerender
  ? createStorage<OgImageOptions>({
    driver: lruCacheDriver({ max: 1000 }),
  })
  : undefined
