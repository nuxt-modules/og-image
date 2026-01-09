import type { H3Error, H3Event } from 'h3'
import type {
  OgImageOptions,
  OgImageRenderEventContext,
  RouteRulesOgImage,
} from '../../types'
import type ChromiumRenderer from './chromium/renderer'
import type SatoriRenderer from './satori/renderer'
import { prerenderOptionsCache } from '#og-image-cache'
import { theme } from '#og-image-virtual/unocss-config.mjs'
import { useSiteConfig } from '#site-config/server/composables/useSiteConfig'
import { createSitePathResolver } from '#site-config/server/composables/utils'
import { createGenerator } from '@unocss/core'
import presetWind from '@unocss/preset-wind3'
import { defu } from 'defu'
import { createError, getQuery } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { hash } from 'ohash'
import { parseURL, withoutLeadingSlash, withoutTrailingSlash, withQuery } from 'ufo'
import { normalizeKey } from 'unstorage'
import { decodeOgImageParams, separateProps } from '../../shared'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { normaliseOptions } from '../util/options'
import { useOgImageRuntimeConfig } from '../utils'
import { useChromiumRenderer, useSatoriRenderer } from './instances'

export function resolvePathCacheKey(e: H3Event, path: string) {
  const siteConfig = useSiteConfig(e, {
    resolveRefs: true,
  })
  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path)))
  return [
    (!basePath || basePath === '/') ? 'index' : basePath,
    hash([
      basePath,
      import.meta.prerender ? '' : siteConfig.url,
      hash(getQuery(e)),
    ]),
  ].join(':')
}

export async function resolveContext(e: H3Event): Promise<H3Error | OgImageRenderEventContext> {
  const runtimeConfig = useOgImageRuntimeConfig()
  // we need to resolve the url ourselves as Nitro may be stripping the base
  const resolvePathWithBase = createSitePathResolver(e, {
    absolute: false,
    withBase: true,
  })
  const path = resolvePathWithBase(parseURL(e.path).pathname)

  const extension = path.split('.').pop() as OgImageRenderEventContext['extension']
  if (!extension) {
    return createError({
      statusCode: 400,
      statusMessage: `[Nuxt OG Image] Missing OG Image type.`,
    })
  }
  if (!['png', 'jpeg', 'jpg', 'svg', 'html', 'json'].includes(extension)) {
    return createError({
      statusCode: 400,
      statusMessage: `[Nuxt OG Image] Unknown OG Image type ${extension}.`,
    })
  }

  // Parse encoded params from URL path (Cloudinary-style)
  // URL format: /_og/d/w_1200,title_Hello.png
  const encodedSegment = (path.split('/').pop() as string).replace(`.${extension}`, '')
  const urlOptions = decodeOgImageParams(encodedSegment)

  // Also support query params for backwards compat and dynamic overrides
  const query = getQuery(e)
  let queryParams: Record<string, any> = {}
  for (const k in query) {
    const v = String(query[k])
    if (!v)
      continue
    if (v.startsWith('{')) {
      try {
        queryParams[k] = JSON.parse(v)
      }
      catch {
        // ignore parse errors
      }
    }
    else {
      queryParams[k] = v
    }
  }
  queryParams = separateProps(queryParams)

  const ogImageKey = urlOptions.key || 'og'
  // basePath is used for route rules matching - can be provided via _path param
  const basePath = withoutTrailingSlash(urlOptions._path || '/')
  delete urlOptions._path

  const basePathWithQuery = queryParams._query && typeof queryParams._query === 'object'
    ? withQuery(basePath, queryParams._query)
    : basePath
  const isDebugJsonPayload = extension === 'json' && runtimeConfig.debug
  const key = resolvePathCacheKey(e, basePathWithQuery)

  // Options come from: URL encoded params > query params > route rules > defaults
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath)
  const ogImageRouteRules = separateProps(routeRules.ogImage as RouteRulesOgImage)
  let options: OgImageOptions = defu(queryParams, urlOptions, ogImageRouteRules, runtimeConfig.defaults) as OgImageOptions
  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: '[Nuxt OG Image] OG Image not found.',
    })
  }

  // TODO merge in component data from component-names, we want the hash to use as a cache key
  let renderer: ((typeof SatoriRenderer | typeof ChromiumRenderer) & { __mock__?: true }) | undefined
  switch (options.renderer) {
    case 'satori':
      renderer = await useSatoriRenderer()
      break
    case 'chromium':
      renderer = await useChromiumRenderer()
      break
  }
  if (!renderer || renderer.__mock__) {
    throw createError({
      statusCode: 400,
      statusMessage: `[Nuxt OG Image] Renderer ${options.renderer} is not enabled.`,
    })
  }
  const unocss = await createGenerator({ theme }, {
    presets: [
      presetWind(),
    ],
  })
  const ctx: OgImageRenderEventContext = {
    unocss,
    e,
    key,
    renderer,
    isDevToolsContextRequest: isDebugJsonPayload,
    runtimeConfig,
    publicStoragePath: runtimeConfig.publicStoragePath,
    extension,
    basePath,
    options: normaliseOptions(options),
    _nitro: useNitroApp(),
  }
  // call the nitro hook
  await ctx._nitro.hooks.callHook('nuxt-og-image:context', ctx)
  return ctx
}
