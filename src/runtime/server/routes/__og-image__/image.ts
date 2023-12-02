import { H3Error, createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { resolveRendererContext } from '../../../core/utils/resolveRendererContext'
import { fetchIsland } from '../../../core/html/fetchIsland'
import { devIframeTemplate } from '../../../core/html/devIframeTemplate'
import { applyInlineCss } from '../../../core/html/applyInlineCss'
import { useOgImageBufferCache } from '../../../cache'
import { useRuntimeConfig, useSiteConfig } from '#imports'

// /__og-image__/image/<path>/og.<extension
export default defineEventHandler(async (e): Promise<any> => {
  const ctx = await resolveRendererContext(e)
  if (ctx instanceof H3Error)
    return ctx

  const { isDebugJsonPayload, extension, options, renderer } = ctx
  const { debug, baseCacheKey } = useRuntimeConfig()['nuxt-og-image']
  const compatibility: string[] = []
  // debug
  if (isDebugJsonPayload) {
    const queryExtension = getQuery(e).extension || ctx.options.extension
    // figure out compatibility based on what we're using
    if (['jpeg', 'jpg'].includes(queryExtension) && options.renderer === 'satori')
      compatibility.push('Converting PNGs to JPEGs requires Sharp which only runs on Node based systems.')
    if (options.renderer === 'chromium')
      compatibility.push('Using Chromium to generate images is only supported in Node based environments. It\'s recommended to only use this if you\'re prerendering')
    if (await applyInlineCss(ctx, await fetchIsland(ctx)))
      compatibility.push('Inlining CSS is only supported in Node based environments.')
    setHeader(e, 'Content-Type', 'application/json')
    return {
      compatibility,
      ...ctx,
      siteConfig: useSiteConfig(e),
      ...(options.renderer === 'satori' ? await renderer.debug(ctx) : undefined),
    }
  }
  switch (extension) {
    case 'html':
      setHeader(e, 'Content-Type', `text/html`)
      // if the user is loading the iframe we need to render a nicer template
      // also used for chromium screenshots
      return devIframeTemplate(ctx)
    case 'svg':
      if (!debug && !import.meta.dev) {
        return createError({
          statusCode: 404,
        })
      }
      if (ctx.renderer.name !== 'satori') {
        return createError({
          statusCode: 400,
          statusMessage: `Generating ${extension}\'s with ${renderer.name} is not supported.`,
        })
      }
      // add svg headers
      setHeader(e, 'Content-Type', `image/svg+xml`)
      return (await ctx.renderer.debug(ctx)).svg
    case 'png':
    case 'jpeg':
    case 'jpg':
      if (!renderer.supportedFormats.includes(extension)) {
        return createError({
          statusCode: 400,
          statusMessage: `Generating ${extension}\'s with ${renderer.name} is not supported.`,
        })
      }
      setHeader(e, 'Content-Type', `image/${extension === 'jpg' ? 'jpeg' : extension}`)
      break
    default:
      return createError({
        statusCode: 400,
        statusMessage: `Invalid request for og.${extension}.`,
      })
  }
  const cacheApi = await useOgImageBufferCache(ctx, {
    cacheMaxAgeSeconds: ctx.options.cacheMaxAgeSeconds,
    baseCacheKey,
  })
  // we sent a 304 not modified
  if (typeof cacheApi === 'undefined')
    return

  let image: H3Error | BufferSource | false | void = cacheApi.cachedItem
  if (!image) {
    image = await renderer.createImage(ctx)
    if (image instanceof H3Error)
      return image
    if (!image) {
      return createError({
        statusCode: 500,
        statusMessage: `Failed to generate og.${extension}.`,
      })
    }
    await cacheApi.update(image)
  }
  return image
})
