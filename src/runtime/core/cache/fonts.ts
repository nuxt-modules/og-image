import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import type { ResolvedFontConfig } from '../../types'

export const fontPromises: Record<string, Promise<ResolvedFontConfig>> = {}

export const fontCache = createStorage<BufferSource>({
  driver: lruCacheDriver({ max: 10 }),
})
