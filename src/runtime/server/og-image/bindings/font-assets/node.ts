import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const origin = getNitroOrigin(event)
  const res = await fetch(new URL(fullPath, origin).href)
  if (res.ok) {
    return Buffer.from(await res.arrayBuffer())
  }
  throw new Error(`[Nuxt OG Image] Failed to resolve font: ${path}`)
}
