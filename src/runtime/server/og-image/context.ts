import type { H3Error, H3Event } from 'h3'
import type {
  OgImageOptionsInternal,
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
import { logger } from '../../logger'
import { decodeOgImageParams, extractEncodedSegment, sanitizeProps, separateProps, verifyOgImageSignature } from '../../shared'
import { autoEjectCommunityTemplate } from '../util/auto-eject'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { normaliseOptions } from '../util/options'
import { useOgImageRuntimeConfig } from '../utils'
import { getBrowserRenderer, getSatoriRenderer, getTakumiRenderer } from './instances'

const RE_HASH_MODE = /^o_([a-z0-9]+)$/i
const RE_SIGNATURE_SUFFIX = /,s_([^,]+)$/

export function resolvePathCacheKey(e: H3Event, path: string, resolvedOptions?: Record<string, any>) {
  const siteConfig = getSiteConfig(e, {
    resolveRefs: true,
  })
  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path)))
  const hashParts: any[] = [
    basePath,
    import.meta.prerender ? '' : siteConfig.url,
  ]
  // Hash resolved options (not raw query string) so unknown/extra query params
  // cannot produce unique cache keys and bypass the cache.
  if (resolvedOptions)
    hashParts.push(hash(resolvedOptions))
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
  if (!extension || !path.includes('.') || extension.includes('/') || !['png', 'jpeg', 'jpg', 'webp', 'svg', 'html', 'json'].includes(extension)) {
    extension = 'png'
  }

  // Parse encoded params from URL path (Cloudinary-style)
  // URL format: /_og/d/w_1200,title_Hello.png
  // Hash mode: /_og/d/o_<hash>.png (for long URLs)
  const encodedSegment = extractEncodedSegment(path, extension)

  // Extract and verify URL signature when signing is enabled
  const secret = runtimeConfig.security?.secret
  let paramsSegment = encodedSegment
  if (secret && !import.meta.dev && !import.meta.prerender) {
    // Extract signature (last ,s_<value> in the segment)
    const sigMatch = encodedSegment.match(RE_SIGNATURE_SUFFIX)
    if (!sigMatch) {
      return createError({
        statusCode: 403,
        statusMessage: '[Nuxt OG Image] Missing URL signature. Configure security.secret to sign URLs.',
      })
    }
    const signature = sigMatch[1]!
    paramsSegment = encodedSegment.slice(0, sigMatch.index!)
    if (!verifyOgImageSignature(paramsSegment, signature, secret!)) {
      return createError({
        statusCode: 403,
        statusMessage: '[Nuxt OG Image] Invalid URL signature.',
      })
    }
  }
  else if (RE_SIGNATURE_SUFFIX.test(encodedSegment)) {
    // Strip signature even when not verifying (dev/prerender) so it doesn't pollute decoded params
    paramsSegment = encodedSegment.replace(RE_SIGNATURE_SUFFIX, '')
  }

  // Check for hash mode (o_<hash>)
  const hashMatch = paramsSegment.match(RE_HASH_MODE)
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
    urlOptions = decodeOgImageParams(paramsSegment)
  }

  // Reject oversized query strings (skipped when signing is active since query params are ignored)
  if (!secret) {
    const maxQueryParamSize = runtimeConfig.security?.maxQueryParamSize
    if (maxQueryParamSize && !import.meta.prerender) {
      const queryString = parseURL(e.path).search || ''
      if (queryString.length > maxQueryParamSize) {
        return createError({
          statusCode: 400,
          statusMessage: `[Nuxt OG Image] Query string exceeds maximum allowed length of ${maxQueryParamSize} characters.`,
        })
      }
    }
  }

  // When URL signing is active, ignore all query param overrides to prevent injection
  let queryParams: Record<string, any> = {}
  if (!secret || import.meta.dev || import.meta.prerender) {
    const query = getQuery(e)
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
  }

  // basePath is used for route rules matching - can be provided via _path param
  const basePath = withoutTrailingSlash(urlOptions._path || '/')
  const componentHash = urlOptions._componentHash || ''
  delete urlOptions._path
  delete urlOptions._hash // Remove internal hash field
  delete urlOptions._componentHash // Not needed for rendering

  const basePathWithQuery = queryParams._query && typeof queryParams._query === 'object'
    ? withQuery(basePath, queryParams._query)
    : basePath
  const isDebugJsonPayload = extension === 'json' && (import.meta.dev || runtimeConfig.debug)

  // Options come from: URL encoded params > query params > route rules > defaults
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath)
  const ogImageRouteRules = separateProps(routeRules.ogImage as RouteRulesOgImage)
  const options = defu(queryParams, urlOptions, ogImageRouteRules, runtimeConfig.defaults) as OgImageOptionsInternal

  // Clamp dimensions to prevent DoS via oversized image generation
  const maxDim = runtimeConfig.security?.maxDimension || 2048
  if (options.width != null) {
    const w = Number(options.width)
    options.width = Number.isFinite(w) ? Math.min(Math.max(1, w), maxDim) : undefined
  }
  if (options.height != null) {
    const h = Number(options.height)
    options.height = Number.isFinite(h) ? Math.min(Math.max(1, h), maxDim) : undefined
  }

  // Strip HTML event handlers and dangerous attributes from props (GHSA-mg36-wvcr-m75h)
  if (options.props && typeof options.props === 'object')
    options.props = sanitizeProps(options.props as Record<string, any>)

  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: '[Nuxt OG Image] OG Image not found.',
    })
  }

  // Normalise options and get renderer from component metadata
  const normalised = normaliseOptions(options)

  // Whitelist props: only allow props declared in the component's defineProps.
  // Components without defineProps accept no props. Prevents cache key inflation
  // from arbitrary query params (DoS vector).
  // colorMode and timestamp are always allowed: colorMode is used by the renderer
  // (styleDirectives, html template) and timestamp is a devtools cache-buster.
  if (normalised.component && normalised.options.props && typeof normalised.options.props === 'object') {
    const builtinProps = new Set(['colorMode', 'timestamp'])
    const allowedProps = normalised.component.propNames || []
    const allowedSet = new Set(allowedProps)
    const raw = normalised.options.props as Record<string, any>
    const filtered: Record<string, any> = {}
    for (const key of Object.keys(raw)) {
      if (allowedSet.has(key) || builtinProps.has(key))
        filtered[key] = raw[key]
      else if (import.meta.dev)
        logger.warn(`[Nuxt OG Image] Prop "${key}" is not declared by component "${normalised.component.pascalName}". Declared props: ${allowedProps.join(', ')}`)
    }
    normalised.options.props = filtered
  }

  // Auto-eject community templates in dev mode (skip devtools requests)
  if (normalised.component?.category === 'community')
    autoEjectCommunityTemplate(normalised.component, runtimeConfig, { requestPath: e.path })

  const rendererType = normalised.renderer
  // In hash mode, basePath is always '/' (since _path isn't in the prerender cache payload),
  // so use the options hash directly as cache key to avoid all hash-mode images sharing one cache entry.
  // Component hash is appended so template changes invalidate the runtime cache.
  const baseCacheKey = normalised.options.cacheKey
    || (hashMatch ? `hash:${hashMatch[1]}` : resolvePathCacheKey(e, basePathWithQuery, normalised.options))
  const key = componentHash ? `${baseCacheKey}:${componentHash}` : baseCacheKey

  let renderer: ((typeof SatoriRenderer | typeof BrowserRenderer | typeof TakumiRenderer) & { __mock__?: true }) | undefined
  switch (rendererType) {
    case 'satori':
      renderer = await getSatoriRenderer()
      break
    case 'browser':
      renderer = await getBrowserRenderer()
      break
    case 'takumi':
      renderer = await getTakumiRenderer()
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
