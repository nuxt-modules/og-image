import type { H3Event } from 'h3'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { createError, H3Error, setHeader } from 'h3'
import { logger } from '../../logger'
import { getBuildCachedImage, setBuildCachedImage } from '../og-image/cache/buildCache'
import { resolveContext } from '../og-image/context'
import { fetchPathHtmlAndExtractOptions } from '../og-image/devtools'
import { html } from '../og-image/templates/html'
import { useOgImageRuntimeConfig } from '../utils'
import { useOgImageBufferCache } from './cache'

export async function imageEventHandler(e: H3Event) {
  const ctx = await resolveContext(e).catch((err: any) => {
    logger.error(`resolveContext error for ${e.path}:`, err?.message || err)
    throw err
  })
  if (ctx instanceof H3Error)
    return ctx

  const { isDevToolsContextRequest, extension, renderer } = ctx
  const { debug, baseCacheKey } = useOgImageRuntimeConfig()
  // debug - allow in dev mode OR when debug is enabled in config
  if ((import.meta.dev || debug) && isDevToolsContextRequest) {
    setHeader(e, 'Content-Type', 'application/json')
    // Include renderer debug info (vnodes, svg, warnings) for satori renderer
    const rendererDebug = renderer.name === 'satori'
      ? await renderer.debug(ctx)
      : {}
    return {
      extract: await fetchPathHtmlAndExtractOptions(e, ctx.basePath, ctx.key),
      siteUrl: getSiteConfig(e).url,
      ...rendererDebug,
    }
  }
  switch (extension) {
    case 'html':
      setHeader(e, 'Content-Type', `text/html`)
      // if the user is loading the iframe we need to render a nicer template
      // also used for chromium screenshots
      return html(ctx)
    case 'svg':
      if (!debug && !import.meta.dev) {
        return createError({
          statusCode: 404,
        })
      }
      if (ctx.renderer.name !== 'satori') {
        return createError({
          statusCode: 400,
          statusMessage: `[Nuxt OG Image] Generating ${extension}'s with ${renderer.name} is not supported.`,
        })
      }
      // add svg headers
      setHeader(e, 'Content-Type', `image/svg+xml`)
      const debugResult = await ctx.renderer.debug(ctx)
      return debugResult.svg
    case 'png':
    case 'jpeg':
    case 'jpg':
      if (!renderer.supportedFormats.includes(extension)) {
        return createError({
          statusCode: 400,
          statusMessage: `[Nuxt OG Image] Generating ${extension}'s with ${renderer.name} is not supported.`,
        })
      }
      setHeader(e, 'Content-Type', `image/${extension === 'jpg' ? 'jpeg' : extension}`)
      break
    default:
      return createError({
        statusCode: 400,
        statusMessage: `[Nuxt OG Image] Invalid request for og.${extension}.`,
      })
  }
  // Check build cache first (CI persistence)
  const buildCachedImage = import.meta.prerender
    ? getBuildCachedImage(ctx.options, extension)
    : null
  if (buildCachedImage) {
    return buildCachedImage
  }

  const cacheApi = await useOgImageBufferCache(ctx, {
    cacheMaxAgeSeconds: ctx.options.cacheMaxAgeSeconds,
    baseCacheKey,
  })
  // we sent a 304 not modified
  if (typeof cacheApi === 'undefined')
    return
  if (cacheApi instanceof H3Error)
    return cacheApi

  let image: H3Error | BufferSource | Buffer | Uint8Array | false | void = cacheApi.cachedItem
  if (!image) {
    image = await renderer.createImage(ctx).catch((err: any) => {
      logger.error(`renderer.createImage error for ${e.path}:`, err?.message || err)
      throw err
    })
    if (image instanceof H3Error)
      return image
    if (!image) {
      return createError({
        statusCode: 500,
        statusMessage: `Failed to generate og.${extension}.`,
      })
    }
    await cacheApi.update(image)
    // Save to build cache for CI persistence
    if (import.meta.prerender && ctx.options.cacheMaxAgeSeconds) {
      setBuildCachedImage(ctx.options, extension, image as Buffer, ctx.options.cacheMaxAgeSeconds)
    }
  }
  return image
}
