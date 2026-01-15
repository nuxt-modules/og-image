import type { H3Event } from 'h3'
import type { FetchResponse } from 'ofetch'
import { getNitroOrigin } from '#site-config/server/composables'

export async function resolve(event: H3Event, path: string) {
  // In Cloudflare Workers, use the built-in ASSETS binding
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (!assets) {
    throw new Error('Cloudflare ASSETS binding not available')
  }

  try {
    const res = await assets.fetch(new URL(path, getNitroOrigin(event)).href) as FetchResponse<any>
    if (res.ok) {
      const b64 = await res.text()
      return Buffer.from(b64, 'base64')
    }
  }
  catch (error) {
    console.error(`[Nuxt OG Image] Failed to fetch asset from Cloudflare ASSETS: ${path}`, error)
  }
  // fetch as public dir
  const res = await fetch(new URL(path, getNitroOrigin(event)).href)
  if (res.ok) {
    const b64 = await res.text()
    return Buffer.from(b64, 'base64')
  }
  throw new Error(`[Nuxt OG Image] Failed to resolve public assets: ${path}`)
}
