import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import type { Browser } from 'playwright-core'
import type { OgImageOptions } from '../../types'

export const prerenderOptionsCache = import.meta.prerender
  ? createStorage<OgImageOptions>({
    driver: lruCacheDriver({ max: 1000 }),
  })
  : undefined
