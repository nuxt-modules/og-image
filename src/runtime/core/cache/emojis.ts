import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'

export const emojiCache = createStorage<string>({
  driver: lruCacheDriver({ max: 1000 }),
})
