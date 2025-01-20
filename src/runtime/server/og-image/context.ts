import type { H3Error, H3Event } from 'h3'
import type {
  OgImageOptions,
  OgImageRenderEventContext,
} from '../../types'
import type ChromiumRenderer from './chromium/renderer'
import type SatoriRenderer from './satori/renderer'
import { prerenderOptionsCache } from '#og-image-cache'
import { theme } from '#og-image-virtual/unocss-config.mjs'
import { createSitePathResolver } from '#site-config/server/composables/utils'
import { createGenerator } from '@unocss/core'
import presetWind from '@unocss/preset-wind'
import { defu } from 'defu'
import { parse } from 'devalue'
import { createError, getQuery } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { hash } from 'ohash'
import { parseURL, withoutLeadingSlash, withoutTrailingSlash, withQuery } from 'ufo'
import { normalizeKey } from 'unstorage'
import { separateProps, useOgImageRuntimeConfig } from '../../shared'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { normaliseOptions } from '../util/options'
import { useChromiumRenderer, useSatoriRenderer } from './instances'

export function resolvePathCacheKey(e: H3Event, path: string) {
  const siteConfig = e.context.siteConfig.get()
  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path)))
  return [
    (!basePath || basePath === '/') ? 'index' : basePath,
    hash([
      basePath,
      siteConfig.url,
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
  let queryParams = { ...getQuery(e) }
  queryParams = separateProps(defu(queryParams.s ? parse(queryParams.s) : {}, { ...queryParams, s: undefined }))
  // the key is the name of the file without the extension, i.e 2.png -> 2
  const ogImageKey = (path.split('/').pop() as string).replace(`.${extension}`, '')
  let basePath = withoutTrailingSlash(path
    .replace(`/__og-image__/image`, '')
    .replace(`/__og-image__/static`, '')
    .replace(`/${ogImageKey}.${extension}`, ''),
  )
  if (queryParams._query)
    basePath = withQuery(basePath, JSON.parse(queryParams._query))
  const isDevToolsContextRequest = extension === 'json'
  const cacheKey = resolvePathCacheKey(e, basePath)
  let options: OgImageOptions | null | undefined = queryParams.options as OgImageOptions
  if (!options) {
    let payloads = []
    if (import.meta.prerender) {
      const res = await prerenderOptionsCache!.getItem(cacheKey)
      payloads = res?.[0] || []
    }
    options = payloads?.find(([k]) => String(k) === ogImageKey)?.[1] || {}
  }
  // no matter how we get the options, apply the defaults and the normalisation
  delete queryParams.options
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath)
  if (typeof routeRules.ogImage === 'undefined' && !options) {
    return createError({
      statusCode: 400,
      statusMessage: 'The route is missing the Nuxt OG Image payload or route rules.',
    })
  }
  const ogImageRouteRules = separateProps(routeRules.ogImage)
  options = defu(queryParams, options, ogImageRouteRules, runtimeConfig.defaults) as OgImageOptions
  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: '[Nuxt OG Image] OG Image not found.',
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
      statusMessage: `[Nuxt OG Image] Renderer ${options.renderer} is missing.`,
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
    key: cacheKey,
    renderer,
    isDevToolsContextRequest,
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
