import { appendHeader } from 'h3'
import { joinURL, withoutLeadingSlash } from 'ufo'
import type { NitroAppPlugin } from 'nitropack'
import { extractOgImageOptions } from '../utils-pure'
import { useNitroCache } from '../../cache'
import type { OgImageOptions } from '../../types'
import { getRouteRules } from '#internal/nitro'

const OgImagePrenderNitroPlugin: NitroAppPlugin = async (nitroApp) => {
  if (!process.env.prerender)
    return
  // always use cache for prerendering to speed it up
  nitroApp.hooks.hook('render:html', async (ctx, { event }) => {
    const path = event.node.req.url!
    if (path.includes('.') || path.startsWith('/__nuxt_island/'))
      return
    const routeRules = (getRouteRules(e)?.ogImage || {}) as false | OgImageOptions
    if (routeRules === false)
      return
    const options = extractOgImageOptions(ctx.head.join('\n'), routeRules)
    if (!options)
      return
    const key = [
      withoutLeadingSlash((path === '/' || !path) ? 'index' : path).replaceAll('/', '-'),
      'options',
    ].join(':')
    const { update } = await useNitroCache(event, 'nuxt-og-image', {
      key,
      // shouldn't change for the prerender, 5 min cache
      cacheTtl: 5 * 60 * 1000,
      cache: true,
      headers: false,
      skipRestore: true,
    })
    await update(JSON.stringify(options))
    if (options.provider === 'satori')
      appendHeader(event, 'x-nitro-prerender', joinURL(path, '/__og_image__/og.png'))
  })
}

export default OgImagePrenderNitroPlugin
