import { appendHeader } from 'h3'
import { joinURL } from 'ufo'
import type { NitroAppPlugin } from 'nitropack'
import { prefixStorage } from 'unstorage'
import { extractOgImageOptions } from '../utils-pure'
import { useStorage, useRuntimeConfig } from '#imports'

const OgImagePrenderNitroPlugin: NitroAppPlugin = (nitroApp) => {
  if (!process.env.prerender)
    return
  const { runtimeCacheStorage } = useRuntimeConfig()['nuxt-og-image']
  // always use cache for prerendering to speed it up
  const baseCacheKey = runtimeCacheStorage === 'default' ? '/cache/og-image' : '/og-image'
  const cache = prefixStorage(useStorage(), `${baseCacheKey}/options`)
  nitroApp.hooks.hook('render:html', async (ctx, { event }) => {
    const url = event.node.req.url!
    if (url.includes('.') || url.startsWith('/__nuxt_island/'))
      return
    const options = extractOgImageOptions(ctx.head.join('\n'))
    if (!options)
      return
    // save it in the cache
    await cache.setItem((url === '/' || !url) ? 'index' : url, {
      value: JSON.stringify(options),
      expiresAt: Date.now() + 60 * 60 * 1000, // 60 minutes to prerender
    })
    if (options.cache && options.provider === 'satori')
      appendHeader(event, 'x-nitro-prerender', joinURL(url, '/__og_image__/og.png'))
  })
}

export default OgImagePrenderNitroPlugin
