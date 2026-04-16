import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'
import { getCloudflareAssets } from '../../../util/cloudflareAssets'
import { fetchLocalAsset } from '../../../util/fetchLocalAsset'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { useOgImageRuntimeConfig } from '../../../utils'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const { app } = useRuntimeConfig()
  const fullPath = withBase(path, app.baseURL)
  const timeout = getFetchTimeout(useOgImageRuntimeConfig())

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
