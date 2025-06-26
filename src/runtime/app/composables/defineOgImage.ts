import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'
import { appendHeader } from 'h3'
import { createError, useNuxtApp, useRequestEvent, useRoute, useState } from 'nuxt/app'
import { ref, toValue } from 'vue'
// import { createNitroRouteRuleMatcher } from '../../server/util/kit'
import { createOgImageMeta, getOgImagePath, setHeadOgImagePrebuilt, useOgImageRuntimeConfig } from '../utils'

// In non-dev client-side environments this is treeshaken
export function defineOgImage(_options: DefineOgImageInput = {}) {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const basePath = route.path || '/' // (pages may be disabled)'
  // if we're loading the same path as the SSR response
  if (nuxtApp.payload.path === basePath) {
    // we keep track of how this function is used, correct usage is that it should have been called
    // server-side before client side, if we're only calling it client-side then it means it's being used incorrectly
    const state = import.meta.dev ? useState<boolean>(`og-image:ssr-exists:${basePath}`, () => false) : ref(false)
    // clone to avoid any issues
    if (import.meta.dev && !import.meta.server) {
      // should be tree shaken
      if (!state.value) {
        throw createError({ message: 'You are using a defineOgImage() function in a client-only context. You must call this function within your root component setup, see https://github.com/nuxt-modules/og-image/pull/293.' })
      }
      return
    }
    state.value = true
  }
  if (!import.meta.server) {
    return
  }

  const { defaults } = useOgImageRuntimeConfig()
  const options = toValue(_options)

  // If options is false, don't generate an OG image
  if (options === false) {
    return
  }

  // TypeScript now knows options is not false
  const validOptions = options as OgImageOptions | OgImagePrebuilt

  for (const key in defaults) {
    // @ts-expect-error untyped
    if (validOptions[key] === undefined)
      // @ts-expect-error untyped
      validOptions[key] = defaults[key]
  }
  if (route.query)
    validOptions._query = route.query
  // allow overriding using a prebuild config
  if (validOptions.url) {
    setHeadOgImagePrebuilt(validOptions)
    return
  }
  const path = getOgImagePath(basePath, validOptions)
  if (import.meta.prerender) {
    appendHeader(useRequestEvent(nuxtApp)!, 'x-nitro-prerender', path)
  }
  createOgImageMeta(path, validOptions, nuxtApp.ssrContext!)
}
