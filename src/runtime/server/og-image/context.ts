import type { H3Error, H3Event } from 'h3'
import type {
  OgImageOptions,
  OgImageRenderEventContext,
  RouteRulesOgImage,
} from '../../types'
import type BrowserRenderer from './browser/renderer'
import type SatoriRenderer from './satori/renderer'
import type TakumiRenderer from './takumi/renderer'
import { prerenderOptionsCache } from '#og-image-cache'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { createSitePathResolver } from '#site-config/server/composables/utils'
import { defu } from 'defu'
import { createError, getQuery } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { hash } from 'ohash'
import { parseURL, withoutLeadingSlash, withoutTrailingSlash, withQuery } from 'ufo'
import { normalizeKey } from 'unstorage'
import { decodeOgImageParams, separateProps } from '../../shared'
import { autoEjectCommunityTemplate } from '../util/auto-eject'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { normaliseOptions } from '../util/options'
import { useOgImageRuntimeConfig } from '../utils'
import { useBrowserRenderer, useSatoriRenderer, useTakumiRenderer } from './instances'

export function resolvePathCacheKey(e: H3Event, path: string, includeQuery = false) {
  const siteConfig = getSiteConfig(e, {
    resolveRefs: true,
  })
  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path)))
  const hashParts = [
    basePath,
    import.meta.prerender ? '' : siteConfig.url,
  ]
  if (includeQuery)
    hashParts.push(hash(getQuery(e)))
  return [
    (!basePath || basePath === '/') ? 'index' : basePath,
    hash(hashParts),
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

  let extension = path.split('.').pop() as OgImageRenderEventContext['extension']
  if (!extension || !path.includes('.') || extension.includes('/') || !['png', 'jpeg', 'jpg', 'svg', 'html', 'json'].includes(extension)) {
    extension = 'png'
  }

  // Parse encoded params from URL path (Cloudinary-style)
  // URL format: /_og/d/w_1200,title_Hello.png
  // Hash mode: /_og/d/o_<hash>.png (for long URLs)
  const encodedSegment = (path.split('/').pop() as string).replace(`.${extension}`, '')

  // Check for hash mode (o_<hash>)
  const hashMatch = encodedSegment.match(/^o_([a-z0-9]+)$/i)
  let urlOptions: Record<string, any> = {}

  if (hashMatch) {
    // Hash mode - look up options from prerender cache
    const optionsHash = hashMatch[1]
    if (import.meta.prerender && prerenderOptionsCache) {
      const cached = await prerenderOptionsCache.getItem(`hash:${optionsHash}`)
      if (cached && typeof cached === 'object') {
        urlOptions = cached as Record<string, any>
      }
      else {
        return createError({
          statusCode: 404,
          statusMessage: `[Nuxt OG Image] Options not found for hash: ${optionsHash}. This can happen if the page hasn't been prerendered yet.`,
        })
      }
    }
    else {
      // At runtime without prerender, hash mode requires the page to have been prerendered
      return createError({
        statusCode: 400,
        statusMessage: `[Nuxt OG Image] Hash-based URLs (o_${optionsHash}) are only supported during prerendering. Use encoded params or query params for runtime.`,
      })
    }
  }
  else {
    urlOptions = decodeOgImageParams(encodedSegment)
  }

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

  // basePath is used for route rules matching - can be provided via _path param
  const basePath = withoutTrailingSlash(urlOptions._path || '/')
  delete urlOptions._path
  delete urlOptions._hash // Remove internal hash field

  const basePathWithQuery = queryParams._query && typeof queryParams._query === 'object'
    ? withQuery(basePath, queryParams._query)
    : basePath
  const isDebugJsonPayload = extension === 'json' && (import.meta.dev || runtimeConfig.debug)

  // Options come from: URL encoded params > query params > route rules > defaults
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath)
  const ogImageRouteRules = separateProps(routeRules.ogImage as RouteRulesOgImage)
  const options: OgImageOptions = defu(queryParams, urlOptions, ogImageRouteRules, runtimeConfig.defaults) as OgImageOptions

  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: '[Nuxt OG Image] OG Image not found.',
    })
  }

  // Normalise options and get renderer from component metadata
  const normalised = normaliseOptions(options)

  // Auto-eject community templates in dev mode (skip devtools requests)
  if (normalised.component?.category === 'community')
    autoEjectCommunityTemplate(normalised.component, runtimeConfig, { requestPath: e.path })

  const rendererType = normalised.renderer
  const key = normalised.options.cacheKey || resolvePathCacheKey(e, basePathWithQuery, runtimeConfig.cacheQueryParams)

  let renderer: ((typeof SatoriRenderer | typeof BrowserRenderer | typeof TakumiRenderer) & { __mock__?: true }) | undefined
  switch (rendererType) {
    case 'satori':
      renderer = await useSatoriRenderer()
      break
    case 'browser':
      renderer = await useBrowserRenderer()
      break
    case 'takumi':
      renderer = await useTakumiRenderer()
      break
  }
  if (!renderer || renderer.__mock__) {
    throw createError({
      statusCode: 400,
      statusMessage: `[Nuxt OG Image] Renderer "${rendererType}" is not available. Component "${normalised.component?.pascalName}" requires the ${rendererType} renderer but it's not bundled for this preset.`,
    })
  }
  const ctx: OgImageRenderEventContext = {
    e,
    key,
    renderer,
    isDevToolsContextRequest: isDebugJsonPayload,
    runtimeConfig,
    publicStoragePath: runtimeConfig.publicStoragePath,
    extension,
    basePath,
    options: normalised.options,
    _nitro: useNitroApp(),
  }
  // call the nitro hook
  await ctx._nitro.hooks.callHook('nuxt-og-image:context', ctx)
  return ctx
}
