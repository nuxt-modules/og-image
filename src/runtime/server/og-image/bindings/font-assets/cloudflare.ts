import type { H3Event } from 'h3'
import type { FetchResponse } from 'ofetch'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { $fetch } from 'ofetch'
import { withBase } from 'ufo'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const origin = getNitroOrigin(event)
  const url = new URL(fullPath, origin).href

  // Try ASSETS binding first (Cloudflare Pages)
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (assets && typeof assets.fetch === 'function') {
    const res = await assets.fetch(url).catch(() => null) as FetchResponse<any> | null
    if (res?.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
  }

  // Fallback to $fetch (handles Workers Sites better)
  const arrayBuffer = await $fetch(fullPath, {
    responseType: 'arrayBuffer',
    baseURL: origin,
  }) as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
