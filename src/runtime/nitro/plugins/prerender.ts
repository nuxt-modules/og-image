import { defineNitroPlugin } from '#imports'
import { prerenderOptionsCache } from '#og-image-cache'
import { parseURL } from 'ufo'
import { isInternalRoute } from '../../pure'
import { extractAndNormaliseOgImageOptions, resolvePathCacheKey } from '../og-image/context'
import { createNitroRouteRuleMatcher } from '../util/kit'

export default defineNitroPlugin(async (nitro) => {
  if (!import.meta.prerender)
    return

  const routeRuleMatcher = createNitroRouteRuleMatcher()
  nitro.hooks.hook('render:html', async (html, ctx) => {
    const { head, bodyAppend } = html
    const path = parseURL(ctx.event.path).pathname
    if (isInternalRoute(path))
      return

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
    // if we're prerendering then we don't need these options in the final HTML
    const index = html.bodyAppend.findIndex(script => script.includes('id="nuxt-og-image-options"'))
    if (index !== -1) {
      // we need to remove `<script id="nuxt-og-image-options" type="application/json">...anything...</script>`
      html.bodyAppend[index] = html.bodyAppend[index].replace(/<script id="nuxt-og-image-options" type="application\/json">[\s\S]*?<\/script>/, '')
      html.bodyAppend[index] = html.bodyAppend[index].replace(/<script id="nuxt-og-image-overrides" type="application\/json">[\s\S]*?<\/script>/, '')
    }
  })
})
