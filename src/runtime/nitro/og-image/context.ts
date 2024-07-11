import { parseURL, withQuery, withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import type { H3Error, H3Event } from 'h3'
import { createError, getQuery } from 'h3'
import { defu } from 'defu'
import { normalizeKey } from 'unstorage'
import { hash } from 'ohash'
import type { OgImageOptions, OgImageRenderEventContext, SocialPreviewMetaData } from '../../types'
import { separateProps, useOgImageRuntimeConfig } from '../../shared'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { decodeObjectHtmlEntities } from '../util/encoding'
import { htmlPayloadCache, prerenderOptionsCache } from './cache'
import { useChromiumRenderer, useSatoriRenderer } from './instances'
import type SatoriRenderer from './satori/renderer'
import type ChromiumRenderer from './chromium/renderer'
import { useNitroApp } from '#internal/nitro/app'

export function resolvePathCacheKey(e: H3Event, path?: string) {
  const siteConfig = e.context.siteConfig.get()
  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path || e.path)))
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
  const path = parseURL(e.path).pathname

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
  queryParams.props = JSON.parse(queryParams.props || '{}')
  queryParams = separateProps(queryParams)
  let basePath = withoutTrailingSlash(path
    .replace(`/__og-image__/image`, '')
    .replace(`/og.${extension}`, ''),
  )
  if (queryParams._query)
    basePath = withQuery(basePath, JSON.parse(queryParams._query))
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
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath)
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
  const ctx: OgImageRenderEventContext = {
    e,
    key,
    renderer,
    isDebugJsonPayload,
    publicStoragePath: runtimeConfig.publicStoragePath,
    extension,
    basePath,
    options,
    _nitro: useNitroApp(),
  }
  // call the nitro hook
  await ctx._nitro.hooks.callHook('nuxt-og-image:context', ctx)
  return ctx
}

export function extractAndNormaliseOgImageOptions(html: string): OgImageOptions | false {
  // extract the options from our script tag
  const htmlPayload = html.match(/<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/)?.[1]
  if (!htmlPayload)
    return false

  let options: OgImageOptions | false = false
  try {
    const payload = JSON.parse(htmlPayload)
    // remove empty values, allow route rules to override, these comes from template param values like title
    Object.entries(payload).forEach(([key, value]) => {
      if (!value)
        delete payload[key]
    })
    options = payload // defu(payload, routeRules)
  }
  catch (e) {
    // options = routeRules
    if (import.meta.dev)
      console.warn('Failed to parse #nuxt-og-image-options', e, options)
  }
  if (!options)
    return false

  if (typeof options.props?.description === 'undefined') {
    // load in the description
    const description = html.match(/<meta[^>]+name="description"[^>]*>/)?.[0]
    if (description) {
      const [, content] = description.match(/content="([^"]+)"/) || []
      if (content && !options.props.description)
        options.props.description = content
    }
  }

  const payload = decodeObjectHtmlEntities(options) as OgImageOptions & { socialPreview?: SocialPreviewMetaData }

  // only needed for nuxt dev tools
  if (import.meta.dev) {
    // we need to extract the social media tag data for description and title, allow property to be before and after
    const socialPreview: SocialPreviewMetaData = {}

    // support both property and name
    const socialMetaTags = html.match(/<meta[^>]+(property|name)="(twitter|og):([^"]+)"[^>]*>/g)
    // <meta property="og:title" content="Home & //<&quot;With Encoding&quot;>\\"
    if (socialMetaTags) {
      socialMetaTags.forEach((tag) => {
        const [, , type, key] = tag.match(/(property|name)="(twitter|og):([^"]+)"/) as any as [undefined, undefined, 'twitter' | 'og', string]
        const value = tag.match(/content="([^"]+)"/)?.[1]
        if (!value)
          return
        if (!socialPreview[type])
          socialPreview[type] = {}
        socialPreview[type]![key] = value
      })
    }
    payload.socialPreview = socialPreview
  }
  return payload
}

// TODO caching
async function fetchPathHtmlAndExtractOptions(e: H3Event, path: string, key: string): Promise<H3Error | OgImageOptions> {
  const cachedHtmlPayload = await htmlPayloadCache.getItem(key)
  if (!import.meta.dev && cachedHtmlPayload && cachedHtmlPayload.expiresAt < Date.now())
    return cachedHtmlPayload.value

  // extract the payload from the original path
  let html: unknown
  try {
    html = await e.$fetch(path)
  }
  catch (err) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to read the path ${path} for og-image extraction. ${err.message}.`,
    })
  }

  if (typeof html !== 'string') {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Got invalid response from ${path} for og-image extraction.`,
    })
  }

  // need to hackily reset the event params, so we can access the route rules of the base URL
  const payload = extractAndNormaliseOgImageOptions(html!)
  if (payload) {
    await htmlPayloadCache.setItem(key, {
      // 60 minutes for prerender, 10 seconds for runtime
      expiresAt: Date.now() + (1000 * (import.meta.prerender ? 60 * 60 : 10)),
      value: payload,
    })
  }
  return payload
}
