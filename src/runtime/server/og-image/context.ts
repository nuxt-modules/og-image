import type { H3Error, H3Event } from 'h3'
import type { FetchOptions, FetchResponse } from 'ofetch'
import type {
  OgImageOptions,
  OgImageRenderEventContext,
  SocialPreviewMetaData,
} from '../../types'
import type ChromiumRenderer from './chromium/renderer'
import type SatoriRenderer from './satori/renderer'
import { useNitroApp } from '#imports'
import { htmlPayloadCache, prerenderOptionsCache } from '#og-image-cache'
import { theme } from '#og-image-virtual/unocss-config.mjs'
import { createGenerator } from '@unocss/core'
import presetWind from '@unocss/preset-wind'
import { defu } from 'defu'
import { parse } from 'devalue'
import { createError, getQuery } from 'h3'
import { hash } from 'ohash'
import { parseURL, withoutLeadingSlash, withoutTrailingSlash, withQuery } from 'ufo'
import { normalizeKey } from 'unstorage'
import { separateProps, useOgImageRuntimeConfig } from '../../shared'
import { decodeObjectHtmlEntities } from '../util/encoding'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { logger } from '../util/logger'
import { normaliseOptions } from '../util/options'
import { useChromiumRenderer, useSatoriRenderer } from './instances'

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
    .replace(`/__og-image__/static`, '')
    .replace(`/og.${extension}`, ''),
  )
  if (queryParams._query)
    basePath = withQuery(basePath, JSON.parse(queryParams._query))
  const isDebugJsonPayload = extension === 'json' && runtimeConfig.debug
  const key = resolvePathCacheKey(e, basePath)
  let options: OgImageOptions | null | undefined = queryParams.options as OgImageOptions
  if (!options) {
    if (import.meta.prerender) {
      options = await prerenderOptionsCache!.getItem(key)
    }
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
    key,
    renderer,
    isDebugJsonPayload,
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

const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/

function getPayloadFromHtml(html: string | unknown): string | null {
  const match = String(html).match(PAYLOAD_REGEX)
  return match ? match[1] : null
}

export function extractAndNormaliseOgImageOptions(html: string): OgImageOptions | false {
  const _payload = getPayloadFromHtml(html)
  if (!_payload)
    return false
  let options: OgImageOptions | false = false
  try {
    const payload = parse(_payload)
    // remove empty values, allow route rules to override, these comes from template param values like title
    Object.entries(payload).forEach(([key, value]) => {
      if (!value)
        delete payload[key]
    })
    options = payload
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

function handleNon200Response(res: FetchResponse<string>, path: string) {
  let errorDescription
  // if its a redirect let's get the redirect path
  if (res.status >= 300 && res.status < 400) {
    errorDescription = `${res.status} redirected to ${res.headers.get('location') || 'unknown'}`
  }
  else if (res.status >= 400) {
    // try get the error message from the response
    errorDescription = `${res.status} error: ${res.statusText}`
  }
  if (errorDescription) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to parse \`${path}\` for og-image extraction. ${errorDescription}`,
    })
  }
}

// TODO caching
async function fetchPathHtmlAndExtractOptions(e: H3Event, path: string, key: string): Promise<H3Error | OgImageOptions> {
  const cachedHtmlPayload = await htmlPayloadCache.getItem(key)
  if (!import.meta.dev && cachedHtmlPayload && cachedHtmlPayload.expiresAt < Date.now())
    return cachedHtmlPayload.value

  // extract the payload from the original path
  let _payload: string | null = null
  let html: string
  const fetchOptions: FetchOptions = {
    // follow redirects
    redirect: 'follow',
    ignoreResponseError: true,
    headers: {
      accept: 'text/html',
    },
  } as const
  const htmlRes = await e.fetch(path, fetchOptions)
  const err = handleNon200Response(htmlRes, path)
  if (err) {
    logger.warn(err)
  }
  html = await htmlRes.text()
  _payload = getPayloadFromHtml(html)
  // fallback to globalThis.fetch
  if (!_payload) {
    const fallbackHtmlRes = await globalThis.$fetch.raw(path, fetchOptions)
    const err = handleNon200Response(fallbackHtmlRes, path)
    if (err) {
      return err
    }
    const fallbackHtml = await fallbackHtmlRes.text()
    _payload = getPayloadFromHtml(fallbackHtml)
    if (_payload) {
      html = fallbackHtml
    }
  }

  if (!html) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] Failed to read the path ${path} for og-image extraction, returning no HTML.`,
    })
  }

  if (!_payload) {
    return createError({
      statusCode: 500,
      statusMessage: `[Nuxt OG Image] HTML response from ${path} is missing the #nuxt-og-image-options script tag. Check you have used defined an og image for this page.`,
    })
  }

  // need to hackily reset the event params, so we can access the route rules of the base URL
  const payload = extractAndNormaliseOgImageOptions(html)
  if (!import.meta.dev && payload) {
    await htmlPayloadCache.setItem(key, {
      // 60 minutes for prerender, 10 seconds for runtime
      expiresAt: Date.now() + (1000 * (import.meta.prerender ? 60 * 60 : 10)),
      value: payload,
    })
  }
  return payload
}
