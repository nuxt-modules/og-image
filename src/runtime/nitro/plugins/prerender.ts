import { parseURL } from 'ufo'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { extractAndNormaliseOgImageOptions } from '../../core/options/extract'
import { prerenderOptionsCache } from '../../core/cache/prerender'
import { isInternalRoute } from '../../utils.pure'
import { resolvePathCacheKey } from '../utils'
import { createNitroRouteRuleMatcher } from '../kit'

export default defineNitroPlugin(async (nitro) => {
  if (!import.meta.prerender)
    return

  nitro.hooks.hook('render:html', async (html, ctx) => {
    const { head, bodyAppend } = html
    const path = parseURL(ctx.event.path).pathname
    if (isInternalRoute(path))
      return

    const routeRuleMatcher = createNitroRouteRuleMatcher()
    const routeRules = routeRuleMatcher(path)
    if (routeRules.ogImage === false)
      return
    // when prerendering we want to cache the options for a quicker response when we render the image
    const options = extractAndNormaliseOgImageOptions([
      head.join('\n'),
      bodyAppend.join('\n'),
    ].join('\n'))
    if (!options)
      return
    const key = resolvePathCacheKey(ctx.event)
    await prerenderOptionsCache!.setItem(key, options)
  })
})
