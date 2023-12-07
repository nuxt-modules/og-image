import { parseURL, withoutBase } from 'ufo'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import type { NitroRouteRules } from 'nitropack'
import { extractAndNormaliseOgImageOptions } from '../../core/options/extract'
import { prerenderChromiumContext, prerenderOptionsCache } from '../../core/cache/prerender'
import { isInternalRoute } from '../../utils.pure'
import { resolvePathCacheKey } from '../utils'
import { useRuntimeConfig } from '#imports'

export default defineNitroPlugin(async (nitro) => {
  if (!import.meta.prerender)
    return

  nitro.hooks.hook('render:html', async (html, ctx) => {
    const { head, bodyAppend } = html
    const path = parseURL(ctx.event.path).pathname
    if (isInternalRoute(path))
      return

    const runtimeConfig = useRuntimeConfig()
    const _routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: runtimeConfig.nitro?.routeRules }),
    )
    const routeRules = defu({}, ..._routeRulesMatcher.matchAll(
      withoutBase(path.split('?')[0], runtimeConfig.app.baseURL),
    ).reverse()).ogImage as NitroRouteRules['ogImage']
    if (routeRules === false)
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
