import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useStorage } from 'nitropack/runtime'
import { prefixStorage } from 'unstorage'

export async function resolve(_event: H3Event, font: FontConfig) {
  const assets = prefixStorage(useStorage(), '/assets')
  let item = await assets.getItem(font.localPath) as any as string | Uint8Array
  if (item instanceof Uint8Array) {
    const decoder = new TextDecoder()
    item = decoder.decode(item)
  }
  return Buffer.from(String(item), 'base64')
}
