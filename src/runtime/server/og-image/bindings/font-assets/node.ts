import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const origin = getNitroOrigin(event)
  const res = await fetch(new URL(path, origin).href)
  if (res.ok) {
    return Buffer.from(await res.arrayBuffer())
  }
  throw new Error(`[Nuxt OG Image] Failed to resolve font: ${path}`)
}
