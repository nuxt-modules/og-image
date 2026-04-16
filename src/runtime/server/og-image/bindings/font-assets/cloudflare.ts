import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { getRequestHost } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'
import { getCloudflareAssets, tryCloudflareAssetsFetch } from '../../../util/cloudflareAssets'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { useOgImageRuntimeConfig } from '../../../utils'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const timeout = getFetchTimeout(useOgImageRuntimeConfig())
  const assets = getCloudflareAssets(event)

  const assetsBuffer = await tryCloudflareAssetsFetch(event, fullPath, AbortSignal.timeout(timeout))
  if (assetsBuffer)
    return Buffer.from(assetsBuffer)

  // Fallback: use event.fetch (Nitro localFetch) which routes through the h3 app
  // and can serve public assets from Nitro's built-in asset handler.
  if (typeof event.fetch === 'function') {
    const origin = event.context.cloudflare?.request?.url || `https://${getRequestHost(event) || 'localhost'}`
    const url = new URL(fullPath, origin).href
    const res = await event.fetch(url, { signal: AbortSignal.timeout(timeout) } as any).catch(() => null) as Response | null
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
