import { createError, useRuntimeConfig } from 'nuxt/server'
import { joinURL } from 'ufo'
import { defineEventHandler, getRequestURL } from '#nuxtseo/h3'
import { initializeOgImageSigning, isOgImageEndpointPath, reportSigningFailure } from '../signing-secret'

export default defineEventHandler(async (event) => {
  const baseURL = useRuntimeConfig().app.baseURL
  const pathname = getRequestURL(event).pathname
  // Nuxt renders errors through an internal request without Worker bindings.
  // Preserve the original status instead of failing secret resolution again.
  if (pathname === '/__nuxt_error' || pathname === joinURL(baseURL, '__nuxt_error'))
    return
  const failure = await initializeOgImageSigning(event).then(() => undefined, (error: unknown) => error)
  if (failure === undefined)
    return
  reportSigningFailure(failure)
  // Image endpoints fail closed. Strict prerendering fails the build.
  if (import.meta.prerender || isOgImageEndpointPath(pathname, baseURL))
    throw createError({ status: 500, message: '[nuxt-og-image] URL signing needs NUXT_APP_SECRET with at least 32 characters.', cause: failure })
  // Pages render with unsigned image URLs, which the image endpoint refuses.
})
