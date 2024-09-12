import type { Storage } from 'unstorage'
import type { OgImageOptions } from '../../../types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

const storage = createStorage<OgImageOptions>({
  driver: memoryDriver(),
})

export const htmlPayloadCache: Storage<{ expiresAt: number, value: OgImageOptions }> = storage
export const prerenderOptionsCache: Storage<OgImageOptions> | undefined = storage
export const fontCache = storage
export const emojiCache: Storage<string> = storage
