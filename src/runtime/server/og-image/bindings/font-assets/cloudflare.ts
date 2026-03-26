import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)

  // Try ASSETS binding first (Cloudflare Pages / Workers with static assets)
  // This is the recommended approach and requires either:
  // - nitro.cloudflare.deployConfig: true (generates wrangler.json with ASSETS binding)
  // - A wrangler.toml/json with [assets] configured
  const assets = event.context.cloudflare?.env?.ASSETS || event.context.ASSETS
  if (assets && typeof assets.fetch === 'function') {
    const origin = event.context.cloudflare?.request?.url || `https://${event.headers.get('host') || 'localhost'}`
    const url = new URL(fullPath, origin).href
    const res = await assets.fetch(url).catch(() => null) as Response | null
    if (res?.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
  }

  // Fallback: use event.fetch (Nitro localFetch) which routes through the h3 app
  // and can serve public assets from Nitro's built-in asset handler.
  if (typeof event.fetch === 'function') {
    const origin = event.context.cloudflare?.request?.url || `https://${event.headers.get('host') || 'localhost'}`
    const url = new URL(fullPath, origin).href
    const res = await event.fetch(url).catch(() => null) as Response | null
    if (res?.ok) {
      return Buffer.from(await res.arrayBuffer())
    }
  }

  if (!assets && !event.context._ogImageWarnedMissingAssets) {
    event.context._ogImageWarnedMissingAssets = true
    console.warn(
      `[Nuxt OG Image] No ASSETS binding found on Cloudflare Workers. Font loading will fail. `
      + `To fix this, add \`nitro: { cloudflare: { deployConfig: true } }\` to your nuxt.config `
      + `and deploy with \`npx wrangler --cwd .output deploy\` instead of using the --assets flag.`,
    )
  }

  throw new Error(`[Nuxt OG Image] Cannot resolve font "${font.family}" on Cloudflare Workers: no ASSETS binding available (path: ${fullPath}).`)
}
