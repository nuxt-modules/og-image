import { H3Error, createError, defineEventHandler, setHeader } from 'h3'
import { resolveRendererContext } from '../../../core/utils/resolveRendererContext'
import { fetchIsland } from '../../../core/html/fetchIsland'
import { devIframeTemplate } from '../../../core/html/devIframeTemplate'
import { applyInlineCss } from '../../../core/html/applyInlineCss'
import { useRuntimeConfig, useSiteConfig } from '#imports'

export default defineEventHandler(async (e): Promise<any> => {
  const ctx = await resolveRendererContext(e)
  if (ctx instanceof H3Error)
    return ctx

  const { extension, options, renderer } = ctx
  if (!options.cacheTtl || import.meta.dev) {
    // add http headers so the file isn't cached
    setHeader(e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(e, 'Pragma', 'no-cache')
    setHeader(e, 'Expires', '0')
  }
  const { debug } = useRuntimeConfig()['nuxt-og-image']
  const compatibility: string[] = []
  if (debug) {
    // debug
    if (extension === 'json') {
      // figure out compatibility based on what we're using
      if (['jpeg', 'jpg'].includes(options.extension) && options.renderer === 'satori')
        compatibility.push('Converting PNGs to JPEGs requires Sharp which only runs on Node based systems.')
      if (options.renderer === 'chromium')
        compatibility.push('Using Chromium to generate images is only supported in Node based environments. It\'s recommended to only use this if you\'re prerendering')
      if (await applyInlineCss(await fetchIsland(e, options)))
        compatibility.push('Inlining CSS is only supported in Node based environments.')
      setHeader(e, 'Content-Type', 'application/json')
      return {
        compatibility,
        ...ctx,
        siteConfig: useSiteConfig(e),
        ...(options.renderer === 'satori' ? await renderer.debug(e, options) : undefined),
      }
    }
  }
  switch (extension) {
    case 'html':
      setHeader(e, 'Content-Type', `text/html`)
      // if the user is loading the iframe we need to render a nicer template
      // also used for chromium screenshots
      return devIframeTemplate(e, await fetchIsland(e, options), options)
    case 'svg':
    case 'png':
    case 'jpeg':
    case 'jpg':
      if (extension === 'svg' && !debug) {
        return createError({
          statusCode: 404,
        })
      }
      if (!renderer.supportedFormats.includes(options.extension)) {
        return createError({
          statusCode: 400,
          statusMessage: `Generating ${options.extension}\'s with ${renderer.name} is not supported.`,
        })
      }
      setHeader(e, 'Content-Type', `image/${options.extension === 'svg' ? 'svg+xml' : options.extension}`)
      break
    default:
      return createError({
        statusCode: 400,
        statusMessage: `Invalid request for og.${options.extension}.`,
      })
  }
  return renderer.createImage(e, options)
})
