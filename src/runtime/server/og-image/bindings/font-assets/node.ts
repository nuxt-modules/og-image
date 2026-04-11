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
  const res = await fetch(new URL(fullPath, origin).href).catch(() => null)
  if (res?.ok) {
    return Buffer.from(await res.arrayBuffer())
  }
  // Fallback to Nitro's internal handler when origin is unreachable
  // (behind a proxy, serverless, or server not fully started)
  const arrayBuffer = await event.$fetch(fullPath, {
    responseType: 'arrayBuffer',
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
