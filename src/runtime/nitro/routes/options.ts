import { createError, defineEventHandler, getQuery } from 'h3'
import { withoutBase } from 'ufo'
import { defu } from 'defu'
import type { RuntimeOgImageOptions } from '../../../types'
import { extractOgImageOptions } from '../utils'
import { getRouteRules } from '#internal/nitro'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  const query = getQuery(e)
  const path = withoutBase(query.path as string || '/', useRuntimeConfig().app.baseURL)

  // extract the payload from the original path
  let html: string
  try {
    html = await globalThis.$fetch(path)
  }
  catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read the path ${path} for og-image extraction. ${err.message}.`,
    })
  }
  const extractedPayload = extractOgImageOptions(html!)
  // not supported
  if (!extractedPayload) {
    throw createError({
      statusCode: 500,
      statusMessage: `The path ${path} is missing the og-image payload.`,
    })
  }

  // need to hackily reset the event params so we can access the route rules of the base URL
  e.node.req.url = path
  const oldRouteRules = e.context._nitro.routeRules
  e.context._nitro.routeRules = undefined
  const routeRules = getRouteRules(e)?.ogImage
  e.context._nitro.routeRules = oldRouteRules
  e.node.req.url = e.path

  // has been disabled via route rules
  if (routeRules === false)
    return false
  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  return defu(
    extractedPayload, routeRules,
    // runtime options
    { path },
    defaults,
  ) as RuntimeOgImageOptions
})
