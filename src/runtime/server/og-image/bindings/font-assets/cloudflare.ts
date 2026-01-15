import type { H3Event } from 'h3'
import type { FetchResponse } from 'ofetch'
import type { FontConfig } from '../../../../types'
import { getNitroOrigin } from '#site-config/server/composables'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.localPath
  // In Cloudflare Workers, use the built-in ASSETS binding
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (!assets) {
    throw new Error('Cloudflare ASSETS binding not available')
  }

  const res = await assets.fetch(new URL(path, getNitroOrigin(event)).href).catch(() => null) as FetchResponse<any> | null
  if (res?.ok) {
    const b64 = await res.text()
    return Buffer.from(b64, 'base64')
  }
  // fetch as public dir
  const publicRes = await fetch(new URL(path, getNitroOrigin(event)).href)
  if (publicRes.ok) {
    const b64 = await publicRes.text()
    return Buffer.from(b64, 'base64')
  }
  throw new Error(`[Nuxt OG Image] Failed to resolve public assets: ${path}`)
}
