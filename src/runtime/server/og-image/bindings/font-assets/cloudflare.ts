import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'
import { getSiteConfig } from '#site-config/server/composables'
import { getCloudflareAssets } from '../../../util/cloudflareAssets'
import { fetchLocalAsset } from '../../../util/fetchLocalAsset'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { useOgImageRuntimeConfig } from '../../../utils'
import { fetchSpecialFontUrl, isDataFontUrl, isExternalFontUrl } from './external-url'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const runtimeConfig = useOgImageRuntimeConfig()
  const timeout = getFetchTimeout(runtimeConfig)
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)

  // `data:` and external font URLs are attacker-reachable via the `fonts` URL
  // param (GHSA-q8hw-4fvp-9rwv). fetchLocalAsset would otherwise fall back to an
  // unvalidated $fetch against the absolute URL. `data:` is decoded inline;
  // external URLs are unsupported (use @nuxt/fonts) except the site's own origin,
  // fetched through the SSRF guard.
  if (path && (isDataFontUrl(path) || isExternalFontUrl(path)))
    return fetchSpecialFontUrl(path, getSiteConfig(event).url, timeout)

  const ab = await fetchLocalAsset(event, fullPath, { fetchTimeout: timeout })
  if (ab)
    return Buffer.from(ab)

  if (!getCloudflareAssets(event) && !event.context._ogImageWarnedMissingAssets) {
    event.context._ogImageWarnedMissingAssets = true
    console.warn(
      `[Nuxt OG Image] No ASSETS binding found on Cloudflare Workers. Font loading will fail. `
      + `To fix this, add \`nitro: { cloudflare: { deployConfig: true } }\` to your nuxt.config `
      + `and deploy with \`npx wrangler --cwd .output deploy\` instead of using the --assets flag.`,
    )
  }

  throw new Error(`[Nuxt OG Image] Cannot resolve font "${font.family}" on Cloudflare Workers: no ASSETS binding available (path: ${fullPath}).`)
}
