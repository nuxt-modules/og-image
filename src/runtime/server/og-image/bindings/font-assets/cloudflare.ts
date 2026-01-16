import type { H3Event } from 'h3'
import type { FetchResponse } from 'ofetch'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  // In Cloudflare Workers, use the built-in ASSETS binding
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (!assets) {
    throw new Error('Cloudflare ASSETS binding not available')
  }

  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const origin = getNitroOrigin(event)
  const res = await assets.fetch(new URL(fullPath, origin).href).catch(() => null) as FetchResponse<any> | null
  if (res?.ok) {
    return Buffer.from(await res.arrayBuffer())
  }
  // fetch as public dir
  const publicRes = await fetch(new URL(fullPath, origin).href)
  if (publicRes.ok) {
    return Buffer.from(await publicRes.arrayBuffer())
  }
  throw new Error(`[Nuxt OG Image] Failed to resolve public assets: ${path}`)
}
