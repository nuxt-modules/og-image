import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'
import { appendHeader } from 'h3'
import { createError, useError, useNuxtApp, useRequestEvent, useRoute, useState } from 'nuxt/app'
import { ref, toValue } from 'vue'
import { createOgImageMeta, getOgImagePath, setHeadOgImagePrebuilt, useOgImageRuntimeConfig } from '../utils'

/**
 * Internal raw implementation for defining OG images.
 * Used by defineOgImage and defineOgImageScreenshot.
 */
export function _defineOgImageRaw(_options: DefineOgImageInput | DefineOgImageInput[] = {}): string[] {
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
      // skip validation in error context - error pages have special lifecycle that confuses state tracking
      if (!state.value && !useError().value) {
        throw createError({ message: 'You are using a defineOgImage() function in a client-only context. You must call this function within your root component setup, see https://github.com/nuxt-modules/og-image/pull/293.' })
      }
      return []
    }
    state.value = true
  }
  if (!import.meta.server) {
    return []
  }

  const paths: string[] = []

  // Handle array of options
  if (Array.isArray(_options)) {
    for (const opt of _options) {
      const path = processOgImageOptions(opt, nuxtApp, route, basePath)
      if (path)
        paths.push(path)
    }
    return paths
  }

  const path = processOgImageOptions(_options, nuxtApp, route, basePath)
  if (path)
    paths.push(path)
  return paths
}

function processOgImageOptions(
  _options: DefineOgImageInput,
  nuxtApp: ReturnType<typeof useNuxtApp>,
  route: ReturnType<typeof useRoute>,
  basePath: string,
): string | undefined {
  const { defaults } = useOgImageRuntimeConfig()
  const options = toValue(_options)

  // If options is false, skip this image (used when passing arrays with conditional items)
  if (options === false) {
    return
  }

  // If route rules disabled og:image, clear all images
  if (nuxtApp.ssrContext?.event.context._nitro?.routeRules?.ogImage === false) {
    nuxtApp.ssrContext!._ogImageInstance?.dispose()
    nuxtApp.ssrContext!._ogImageDevtoolsInstance?.dispose()
    nuxtApp.ssrContext!._ogImageInstance = undefined
    nuxtApp.ssrContext!._ogImagePayloads = []
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
    return toValue(validOptions.url)
  }
  const { path, hash } = getOgImagePath(basePath, validOptions)
  if (import.meta.prerender) {
    // Encode commas to prevent HTTP header splitting (commas separate header values)
    const prerenderPath = (path.split('?')[0] || path).replace(/,/g, '%2C')
    appendHeader(useRequestEvent(nuxtApp)!, 'x-nitro-prerender', prerenderPath)
  }
  // Include hash in options if hash mode was used (for prerender cache lookup)
  if (hash) {
    validOptions._hash = hash
  }
  createOgImageMeta(path, validOptions, nuxtApp.ssrContext!)
  return path
}
