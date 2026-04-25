import type { H3Event } from 'h3'
import { createError, getRequestHost, H3Error, setHeader } from 'h3'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { logger } from '../../logger'
import { getBuildCachedImage, setBuildCachedImage } from '../og-image/cache/buildCache'
import { resolveContext } from '../og-image/context'
import { fetchPathHtmlAndExtractOptions } from '../og-image/devtools'
import { html } from '../og-image/templates/html'
import { useOgImageRuntimeConfig } from '../utils'
import { useOgImageBufferCache } from './cache'

export async function imageEventHandler(e: H3Event) {
  const reqStart = performance.now()
  const ctx = await resolveContext(e).catch((err: any) => {
    logger.error(`resolveContext error for ${e.path}:`, err?.message || err)
    throw err
  })
  if (ctx instanceof H3Error)
    return ctx
  const timings = ctx.timings
  try {
    return await renderOgImage(e, ctx)
  }
  finally {
    timings.record('total', performance.now() - reqStart)
    const header = timings.header()
    if (header)
      setHeader(e, 'Server-Timing', header)
  }
}

async function renderOgImage(e: H3Event, ctx: Exclude<Awaited<ReturnType<typeof resolveContext>>, H3Error>) {
  const timings = ctx.timings

  const { isDevToolsContextRequest, extension, renderer } = ctx
  const { debug, baseCacheKey, security } = useOgImageRuntimeConfig()

  // Origin restriction: block runtime requests from unknown hosts.
  // Loopback requests (localhost, 127.0.0.1, ::1) are allowed only when URL
  // signing is active, so production builds running locally for e2e/CI don't
  // need to disable the check entirely. Without a secret we cannot trust the
  // Host / X-Forwarded-Host headers (user-controlled), so the allowlist must
  // be enforced. With a secret, HMAC verification is what actually protects
  // these requests; the host check is just an extra layer.
  if (!import.meta.prerender && !import.meta.dev && security?.restrictRuntimeImagesToOrigin) {
    const requestHost = getRequestHost(e, { xForwardedHost: true })
    // Parse the hostname via URL so bracketed IPv6 hosts like `[::1]:3000`
    // are handled correctly (split(':') would yield `[` as the first segment).
    let requestHostname: string | undefined
    if (requestHost) {
      try {
        requestHostname = new URL(`http://${requestHost}`).hostname
      }
      catch {
        requestHostname = undefined
      }
    }
    const isLoopback = !!security.secret && (
      requestHostname === 'localhost'
      || requestHostname === '127.0.0.1'
      || requestHostname === '::1'
    )
    if (!isLoopback) {
      const siteHost = new URL(getSiteConfig(e).url).host
      const allowedHosts = [siteHost, ...security.restrictRuntimeImagesToOrigin.map((o) => {
        try {
          return new URL(o).host
        }
        catch {
          return o
        }
      })]
      if (!requestHost || !allowedHosts.includes(requestHost)) {
        return createError({
          statusCode: 403,
          statusMessage: '[Nuxt OG Image] Host not allowed.',
        })
      }
    }
  }
  // debug - allow in dev mode OR when debug is enabled in config
  if ((import.meta.dev || debug) && isDevToolsContextRequest) {
    setHeader(e, 'Content-Type', 'application/json')
    // Run extraction and renderer debug in parallel
    // renderer.debug may fail if the resolved component is a default fallback
    // that doesn't match the page's actual defineOgImage component
    const [extract, rendererDebug] = await Promise.all([
      fetchPathHtmlAndExtractOptions(e, ctx.basePath, ctx.key),
      renderer.debug
        ? renderer.debug(ctx).catch((err: any) => {
            logger.debug(`renderer.debug failed for ${ctx.options.component}: ${err?.message || err}`)
            return {}
          })
        : {},
    ])
    return {
      extract,
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
    case 'svg': {
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
    }
    case 'png':
    case 'jpeg':
    case 'jpg':
    case 'webp':
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
    timings.record('cache-hit', 0)
    return buildCachedImage
  }

  const endCacheLookup = timings.start('cache-lookup')
  const cacheApi = await useOgImageBufferCache(ctx, {
    cacheMaxAgeSeconds: ctx.options.cacheMaxAgeSeconds,
    baseCacheKey,
    secret: security?.secret,
  }).finally(endCacheLookup)
  // we sent a 304 not modified
  if (typeof cacheApi === 'undefined') {
    return
  }
  if (cacheApi instanceof H3Error) {
    return cacheApi
  }

  let image: H3Error | BufferSource | Buffer | Uint8Array | false | void = cacheApi.cachedItem
  if (image) {
    timings.record('cache-hit', 0)
  }
  if (!image) {
    const timeout = security?.renderTimeout ?? 15_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const endRender = timings.start('render-total')
    image = await Promise.race([
      renderer.createImage(ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`OG image render timed out after ${timeout}ms`)), timeout)
      }),
    ]).catch((err: any) => {
      if (err?.message?.includes('timed out')) {
        logger.error(`renderer.createImage timeout for ${e.path}`)
        return createError({ statusCode: 408, statusMessage: `[Nuxt OG Image] Request timed out while waiting for OG image render.` })
      }
      logger.error(`renderer.createImage error for ${e.path}:`, err?.stack || err?.message || err)
      throw err
    }).finally(() => {
      clearTimeout(timer)
      endRender()
    })
    if (image instanceof H3Error) {
      return image
    }
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
