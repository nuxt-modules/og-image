import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { $fetch } from 'ofetch'
import { withBase } from 'ufo'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)

  // Try ASSETS binding first (Cloudflare Pages / Workers with static assets)
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (assets && typeof assets.fetch === 'function') {
    const origin = event.context.cloudflare?.request?.url || `https://${event.headers.get('host') || 'localhost'}`
    const url = new URL(fullPath, origin).href
    const res = await assets.fetch(url).catch(() => null) as Response | null
    if (res?.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
  }

  // Fallback: use event.$fetch for in-process resolution when available,
  // otherwise fall back to $fetch with origin (for presets without ASSETS binding)
  const internalFetch = (event as any).$fetch as ((path: string, opts: { responseType: string }) => Promise<ArrayBuffer>) | undefined
  if (typeof internalFetch === 'function') {
    const arrayBuffer = await internalFetch(fullPath, { responseType: 'arrayBuffer' })
    return Buffer.from(arrayBuffer)
  }
  const origin = getNitroOrigin(event)
  const arrayBuffer = await $fetch(fullPath, {
    responseType: 'arrayBuffer',
    baseURL: origin,
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
