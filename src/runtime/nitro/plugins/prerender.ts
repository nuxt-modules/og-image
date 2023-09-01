import { appendHeader } from 'h3'
import { joinURL, parseURL, withoutLeadingSlash } from 'ufo'
import type { NitroAppPlugin } from 'nitropack'
import { extractAndNormaliseOgImageOptions } from '../utils-pure'
import { useNitroCache } from '../../cache'
import type { OgImageOptions } from '../../types'
import { getRouteRules } from '#internal/nitro'
import { useRuntimeConfig } from '#imports'

const OgImagePrenderNitroPlugin: NitroAppPlugin = async (nitroApp) => {
  if (!process.env.prerender)
    return
  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  // always use cache for prerendering to speed it up
  nitroApp.hooks.hook('render:html', async (ctx, { event }) => {
    const path = parseURL(event.path).pathname
    if (path.includes('.') || path.startsWith('/__nuxt_island/'))
      return
    const routeRules = (getRouteRules(event)?.ogImage || {}) as false | OgImageOptions
    if (routeRules === false)
      return
    const options = extractAndNormaliseOgImageOptions(path, ctx.head.join('\n'), routeRules, defaults)
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
    await update(options)
    if (options.provider === 'satori')
      appendHeader(event, 'x-nitro-prerender', joinURL(path, '/__og_image__/og.png'))
  })
}

export default OgImagePrenderNitroPlugin
