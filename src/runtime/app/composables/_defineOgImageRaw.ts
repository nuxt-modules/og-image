import type { VueHeadClient } from '@unhead/vue'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../../types'
import { injectHead } from '@unhead/vue'
import { createError, useError, useNuxtApp, useRequestEvent, useRoute, useState } from 'nuxt/app'
import { toValue } from 'vue'
import { createOgImageMeta, getOgImagePath, setHeadOgImagePrebuilt, useOgImageRuntimeConfig } from '../utils'

const RE_COMMA = /,/g

/**
 * Internal raw implementation for defining OG images.
 * Used by defineOgImage and defineOgImageScreenshot.
 */
export function defineOgImageRaw(_options: DefineOgImageInput | DefineOgImageInput[] = {}): string[] {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const basePath = route.path || '/' // (pages may be disabled)'
  if (import.meta.dev && import.meta.server) {
    // track that defineOgImage was called server-side for this path
    useState<boolean>(`og-image:ssr-exists:${basePath}`, () => false).value = true
  }
  if (!import.meta.server) {
    // validate during hydration that the server also called defineOgImage for this path
    // catches .client.vue components or other client-only contexts where og images won't be generated
    if (import.meta.dev && nuxtApp.isHydrating) {
      const state = useState<boolean>(`og-image:ssr-exists:${basePath}`, () => false)
      // skip validation in error context - error pages have special lifecycle that confuses state tracking
      if (!state.value && !useError().value) {
        throw createError({ message: 'You are using a defineOgImage() function in a client-only context. You must call this function within your root component setup, see https://github.com/nuxt-modules/og-image/pull/293.' })
      }
    }
    return []
  }

  const paths: string[] = []

  // Handle array of options
  if (Array.isArray(_options)) {
    for (const opt of _options) {
      const path = useProcessOgImageOptions(opt, nuxtApp, route, basePath)
      if (path)
        paths.push(path)
    }
    return paths
  }

  const path = useProcessOgImageOptions(_options, nuxtApp, route, basePath)
  if (path)
    paths.push(path)
  return paths
}

function useProcessOgImageOptions(
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
    if (import.meta.prerender) {
      const event = useRequestEvent(nuxtApp)
      if (event?.context._ogImagePrerenderPaths)
        event.context._ogImagePrerenderPaths.clear()
    }
    return
  }

  // TypeScript now knows options is not false
  const validOptions = options as OgImageOptions | OgImagePrebuilt

  // resolve reactive options
  if (validOptions.width)
    validOptions.width = toValue(validOptions.width)
  if (validOptions.height)
    validOptions.height = toValue(validOptions.height)
  if (validOptions.alt)
    validOptions.alt = toValue(validOptions.alt)
  if (validOptions.url)
    validOptions.url = toValue(validOptions.url)
  // resolve reactive props
  if (validOptions.props) {
    validOptions.props = { ...validOptions.props }
    for (const key in validOptions.props) {
      validOptions.props[key] = toValue(validOptions.props[key])
    }
  }

  for (const key in defaults) {
    // @ts-expect-error untyped
    if (validOptions[key] === undefined)
      // @ts-expect-error untyped
      validOptions[key] = defaults[key]
  }

  // Capture the head instance during component setup so that createOgImageMeta
  // can lazily resolve title/description from useSeoMeta / useHead after all
  // component setups have completed (ordering-independent).
  let head: VueHeadClient | undefined
  if (import.meta.server) {
    try {
      head = injectHead()
    }
    catch (e) {
      if (import.meta.dev)
        console.warn('[nuxt-og-image] Failed to inject head for OG image metadata generation.', e)
    }
  }

  if (route.query)
    validOptions._query = route.query
  // allow overriding using a prebuild config
  if (validOptions.url) {
    setHeadOgImagePrebuilt(validOptions)
    return toValue(validOptions.url)
  }
  const { path, hash } = getOgImagePath(basePath, validOptions)
  // Include hash in options if hash mode was used (for prerender cache lookup)
  if (hash) {
    validOptions._hash = hash
  }
  createOgImageMeta(path, validOptions, nuxtApp.ssrContext!, basePath, head)
  if (import.meta.prerender) {
    // Store prerender paths on the event context, keyed by OG key so that
    // when defineOgImage is called multiple times with the same key (e.g. layout
    // then page), only the final path survives. The render:html hook reads these
    // and sets the x-nitro-prerender header with only the paths that match the
    // finalized payloads, preventing stale hash URLs from being enqueued.
    const ogKey = validOptions.key || 'og'
    const prerenderPath = (path.split('?')[0] || path).replace(RE_COMMA, '%2C')
    const event = useRequestEvent(nuxtApp)!
    const prerenderPaths: Map<string, string> = event.context._ogImagePrerenderPaths || (event.context._ogImagePrerenderPaths = new Map())
    prerenderPaths.set(ogKey, prerenderPath)
  }
  return path
}
