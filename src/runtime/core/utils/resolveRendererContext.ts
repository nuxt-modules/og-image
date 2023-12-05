import { parseURL, withoutBase, withoutTrailingSlash } from 'ufo'
import type { H3Error, H3Event } from 'h3'
import { createError, getQuery } from 'h3'
import { defu } from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import type { NitroRouteRules } from 'nitropack'
import type { H3EventOgImageRender, OgImageOptions } from '../../types'
import { fetchPathHtmlAndExtractOptions } from '../options/fetch'
import { prerenderOptionsCache } from '../cache/prerender'
import type SatoriRenderer from '../renderers/satori'
import type ChromiumRenderer from '../renderers/chromium'
import { useChromiumRenderer, useSatoriRenderer } from '../renderers/satori/instances'
import { separateProps, useOgImageRuntimeConfig } from '../../utils'
import { resolvePathCacheKey } from '../../nitro/utils'
import { useRuntimeConfig } from '#imports'

export async function resolveRendererContext(e: H3Event): Promise<H3Error | H3EventOgImageRender> {
  const runtimeConfig = useOgImageRuntimeConfig()
  const path = parseURL(e.path).pathname

  const extension = path.split('.').pop() as H3EventOgImageRender['extension']
  if (!extension) {
    return createError({
      statusCode: 400,
      statusMessage: `Missing OG Image type.`,
    })
  }
  if (!['png', 'jpeg', 'jpg', 'svg', 'html', 'json'].includes(extension)) {
    return createError({
      statusCode: 400,
      statusMessage: `Unknown OG Image type ${extension}.`,
    })
  }
  // remove all of the different cache types (static, dynamic, none)
  // need to use regex to match path /__og-image__/image/<cacheType>/
  // where cache type is optional and one of the above
  const basePath = withoutTrailingSlash(path
    .replace(`/__og-image__/image`, '')
    .replace(`/og.${extension}`, ''),
  )
  let queryParams = { ...getQuery(e) }
  queryParams.props = JSON.parse(queryParams.props || '{}')
  queryParams = separateProps(queryParams)
  const isDebugJsonPayload = extension === 'json' && runtimeConfig.debug
  const key = resolvePathCacheKey(e, basePath)
  let options: OgImageOptions | null | undefined = queryParams.options as OgImageOptions
  if (!options) {
    if (import.meta.prerender)
      options = await prerenderOptionsCache?.getItem(key)

    if (!options) {
      const payload = await fetchPathHtmlAndExtractOptions(e, basePath, key)
      if (payload instanceof Error)
        return payload
      options = payload
    }
  }
  // no matter how we get the options, apply the defaults and the normalisation
  delete queryParams.options
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: useRuntimeConfig().nitro?.routeRules }),
  )
  const routeRules: NitroRouteRules = defu({}, ..._routeRulesMatcher.matchAll(
    withoutBase(basePath.split('?')[0], useRuntimeConfig().app.baseURL),
  ).reverse())
  if (typeof routeRules.ogImage === 'undefined' && !options) {
    return createError({
      statusCode: 400,
      statusMessage: 'The route is missing the Nuxt OG Image payload or route rules.',
    })
  }
  const ogImageRouteRules = separateProps(routeRules.ogImage)
  options = defu(queryParams, ogImageRouteRules, options, runtimeConfig.defaults) as OgImageOptions
  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: 'OG Image not found.',
    })
  }
  // TODO merge in component data from component-names, we want the hash to use as a cache key
  let renderer: typeof SatoriRenderer | typeof ChromiumRenderer | undefined
  switch (options.renderer) {
    case 'satori':
      renderer = await useSatoriRenderer()
      break
    case 'chromium':
      renderer = await useChromiumRenderer()
      break
  }
  if (!renderer || renderer.__unenv__) {
    throw createError({
      statusCode: 400,
      statusMessage: `Renderer ${options.renderer} is missing.`,
    })
  }
  return {
    e,
    key,
    renderer,
    isDebugJsonPayload,
    extension,
    basePath,
    options,
  }
}
