import { parseURL, withoutLeadingSlash } from 'ufo'
import { getRouteRules } from 'nitropack/dist/runtime/route-rules'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { extractAndNormaliseOgImageOptions } from '../../core/options/extract'
import { prerenderCache, prerenderChromiumContext } from '../../core/cache/prerender'
import type { OgImageOptions } from '../../types'
import { isInternalRoute } from '../../utils'

export default defineNitroPlugin(async (nitro) => {
  if (!import.meta.prerender)
    return

  nitro.hooks.hook('render:html', async ({ head, bodyAppend }, e) => {
    const path = parseURL(e.event.path).pathname
    if (isInternalRoute(path))
      return
    const routeRules = (getRouteRules(e)?.ogImage || {}) as false | OgImageOptions
    if (routeRules === false)
      return
    // when prerendering we want to cache the options for a quicker response when we render the image
    const options = extractAndNormaliseOgImageOptions([
      head.join('\n'),
      bodyAppend.join('\n'),
    ].join('\n'))
    if (!options)
      return
    const key = [
      withoutLeadingSlash((path === '/' || !path) ? 'index' : path).replaceAll('/', '-'),
    ].join(':')
    await prerenderCache!.setItem(key, options)
  })
  nitro.hooks.hook('close', () => {
    // clean up the browser
    if (prerenderChromiumContext.browser) {
      prerenderChromiumContext.browser.close()
      prerenderChromiumContext.browser = undefined
    }
  })
})
