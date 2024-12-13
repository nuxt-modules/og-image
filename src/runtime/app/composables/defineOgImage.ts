import type { ActiveHeadEntry } from '@unhead/schema'
import type { DefineOgImageInput, OgImageOptions } from '../../types'
import { defu } from 'defu'
import { appendHeader } from 'h3'
import { createError, useNuxtApp, useRequestEvent, useRoute, useState } from 'nuxt/app'
import { ref } from 'vue'
import { createNitroRouteRuleMatcher } from '../../server/util/kit'
import { getOgImagePath, separateProps, useOgImageRuntimeConfig } from '../../shared'
import { createOgImageMeta, normaliseOptions } from '../utils'

// In non-dev client-side environments this is treeshaken
export function defineOgImage(_options: DefineOgImageInput = {}) {
  const route = useRoute()
  const basePath = route.path || '/' // (pages may be disabled)
  // we keep track of how this function is used, correct usage is that it should have been called
  // server-side before client side, if we're only calling it client-side then it means it's being used incorrectly
  const state = import.meta.dev ? useState(`og-image:ssr-exists:${basePath}`, () => false) : ref(false)
  // clone to avoid any issues
  if (import.meta.dev && !import.meta.server) {
    // should be tree shaken
    if (!state.value) {
      throw createError({ message: 'You are using a defineOgImage() function in a client-only context. You must call this function within your root component setup, see https://github.com/nuxt-modules/og-image/pull/293.' })
    }
    return
  }
  state.value = true

  const nuxtApp = useNuxtApp()
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
  const options = normaliseOptions(defu({
    ..._options,
  }, {
    component: defaults.component,
  }))
  if (route.query)
    options._query = route.query
  const resolvedOptions = normaliseOptions(defu(separateProps(_options), separateProps(routeRules), defaults) as OgImageOptions)
  // allow overriding using a prebuild config
  if (resolvedOptions.url) {
    createOgImageMeta(null, options, resolvedOptions, nuxtApp.ssrContext!)
  }
  else {
    const path = getOgImagePath(basePath, resolvedOptions)
    if (import.meta.prerender)
      appendHeader(useRequestEvent(), 'x-nitro-prerender', path)
    createOgImageMeta(path, options, resolvedOptions, nuxtApp.ssrContext!)
  }
}
