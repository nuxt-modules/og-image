import type { ActiveHeadEntry } from '@unhead/vue'
import type { DefineOgImageInput } from '../../types'
import { appendHeader } from 'h3'
import { createError, useNuxtApp, useRequestEvent, useRoute, useState } from 'nuxt/app'
import { ref, toValue } from 'vue'
import { createNitroRouteRuleMatcher } from '../../server/util/kit'
import { getOgImagePath, useOgImageRuntimeConfig } from '../../shared'
import { createOgImageMeta, setHeadOgImagePrebuilt } from '../utils'

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

  const ogImageInstances = nuxtApp.ssrContext!._ogImageInstances || []

  // need to check route rules hasn't disabled this
  const routeRuleMatcher = createNitroRouteRuleMatcher()
  const routeRules = routeRuleMatcher(basePath).ogImage
  // has been disabled by route rules
  if (!_options || nuxtApp.ssrContext?.event.context._nitro?.routeRules?.ogImage === false || (typeof routeRules !== 'undefined' && routeRules === false)) {
    // remove the previous entries
    ogImageInstances.forEach((e: ActiveHeadEntry<any>) => {
      e.dispose()
    })
    nuxtApp.ssrContext!._ogImageInstances = undefined
    return
  }
  const { defaults } = useOgImageRuntimeConfig()
  const options = toValue(_options)
  for (const key in routeRules) {
    if (options[key] === undefined)
      options[key] = routeRules[key]
  }
  for (const key in defaults) {
    if (options[key] === undefined)
      options[key] = defaults[key]
  }
  if (route.query)
    options._query = route.query
  // allow overriding using a prebuild config
  if (options.url) {
    setHeadOgImagePrebuilt(options)
    return
  }
  const path = getOgImagePath(basePath, options)
  if (import.meta.prerender) {
    appendHeader(useRequestEvent(nuxtApp)!, 'x-nitro-prerender', path)
  }
  createOgImageMeta(path, options, nuxtApp.ssrContext!)
}
