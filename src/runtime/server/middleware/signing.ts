import { useRuntimeConfig } from 'nuxt/server'
import { joinURL } from 'ufo'
import { defineEventHandler, getRequestURL } from '#nuxtseo/h3'
import { initializeOgImageSigning } from '../signing-secret'

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname
  // Nuxt renders errors through an internal request without Worker bindings.
  // Preserve the original status instead of failing secret resolution again.
  if (pathname === '/__nuxt_error' || pathname === joinURL(useRuntimeConfig().app.baseURL, '__nuxt_error'))
    return
  return initializeOgImageSigning(event)
})
