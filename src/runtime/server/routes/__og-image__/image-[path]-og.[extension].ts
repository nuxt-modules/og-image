import { H3Error, createError, defineEventHandler, setHeader } from 'h3'
import { resolveRendererContext } from '../../../core/utils/resolveRendererContext'
import { fetchHTML } from '../../../core/html/fetch'

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

  switch (extension) {
    case 'html':
      setHeader(e, 'Content-Type', `text/html`)
      return fetchHTML(e, options)
    // debug
    case 'json':
      setHeader(e, 'Content-Type', 'application/json')
      return {
        ...ctx,
        siteConfig: useSiteConfig(e),
        vnodes: options.renderer === 'satori' ? await renderer.createImage(e, { ...options, extension: 'json' }) : undefined,
      }
    case 'svg':
    case 'png':
    case 'jpeg':
    case 'jpg':
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
