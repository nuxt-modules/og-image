import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = import.meta.dev ? font.src : font.localPath
  const arrayBuffer = await $fetch<ArrayBuffer>(path, {
    responseType: 'arrayBuffer',
    baseURL: getNitroOrigin(event),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  })
  const res = Buffer.from(arrayBuffer)
  // quick check of the content to make sure it's not html
  const asString = res.toString('utf-8', 0, 15).toLowerCase()
  if (asString.includes('<!doctype html>') || asString.includes('<html')) {
    throw new Error(`Failed to fetch font ${font.family} from ${font.src}, received HTML content instead of font data.`)
  }
  return res
}
