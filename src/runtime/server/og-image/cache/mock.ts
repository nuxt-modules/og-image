import type { Storage } from 'unstorage'
import type { OgImageOptions } from '../../../types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

const storage = createStorage<OgImageOptions>({
  driver: memoryDriver(),
})

export const htmlPayloadCache: Storage<{ expiresAt: number, value: OgImageOptions }> = storage as any
export const prerenderOptionsCache: Storage<OgImageOptions | [string, OgImageOptions][]> | undefined = storage as any
export const emojiCache: Storage<string> = storage as any
