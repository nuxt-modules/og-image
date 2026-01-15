import type { H3Event } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { prefixStorage } from 'unstorage'

export async function resolve(event: H3Event, path: string) {
  const assets = prefixStorage(useStorage(), '/assets')
  let item = await assets.getItem(path) as any as string | Uint8Array
  if (item instanceof Uint8Array) {
    const decoder = new TextDecoder()
    item = decoder.decode(item)
  }
  return Buffer.from(String(fontData), 'base64')
}
