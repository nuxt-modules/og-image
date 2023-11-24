import { H3Error, defineEventHandler, setHeader } from 'h3'
import { resolveOgImageContext } from '../../../nitro/utils/resolveOgImageContext'
import { fetchHTML } from '../../../nitro/utils'

export default defineEventHandler(async (e) => {
  const ctx = await resolveOgImageContext(e)
  if (ctx instanceof H3Error)
    return ctx

  if (!ctx.options.cacheTtl) {
    // add http headers so the file isn't cached
    setHeader(e, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(e, 'Pragma', 'no-cache')
    setHeader(e, 'Expires', '0')
  }

  switch (ctx.extension) {
    // debug
    case 'json':
      setHeader(e, 'Content-Type', 'application/json')
      return {
        ...ctx,
        siteConfig: useSiteConfig(e),
        vnodes: await ctx.provider.createVNode(ctx.options),
      }
    case 'svg':
      setHeader(e, 'Content-Type', 'image/svg+xml')
      return ctx.provider.createSvg(ctx.options)
    case 'html':
      setHeader(e, 'Content-Type', `text/${ctx.extension}`)
      return fetchHTML(ctx.options)
    case 'png':
      setHeader(e, 'Content-Type', `image/${ctx.extension}`)
      return ctx.provider.createPng(ctx.options)
    default:
      return createError({
        statusCode: 400,
        statusMessage: `Invalid request for og.${ctx.extension}.`,
      })
  }
})
