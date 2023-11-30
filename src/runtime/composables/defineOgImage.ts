import type { ActiveHeadEntry } from '@unhead/schema'
import { defu } from 'defu'
import { appendHeader } from 'h3'
import type { AllowedComponentProps, Component, ComponentCustomProps, VNodeProps } from '@vue/runtime-core'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { withoutBase } from 'ufo'
import type { NitroRouteRules } from 'nitropack'
import type { DefineOgImageInput, OgImageOptions, OgImageScreenshotOptions } from '../types'
import { getOgImagePath } from '../utilts'
import { normaliseOptions } from '../core/options/normalise'
import { createOgImageMeta } from '../nuxt/utilts'
import type { OgImageComponents } from '#nuxt-og-image/components'
import { useNuxtApp, useRequestEvent, useRouter, useRuntimeConfig } from '#imports'

export function defineOgImageScreenshot(options: OgImageScreenshotOptions = {}) {
  const router = useRouter()
  const route = router.currentRoute.value?.path || ''
  return defineOgImage({
    alt: `Web page screenshot${route ? ` of ${route}` : ''}.`,
    renderer: 'chromium',
    extension: 'jpeg',
    component: 'PageScreenshot', // this is an alias
    cache: true,
    ...options,
  })
}

export function defineOgImageCached(options: OgImageOptions = {}) {
  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  // if we're not caching by default and are missing cache config, add it
  if (!defaults.cacheTtl && !options.cacheTtl)
    options.cacheTtl = 60 * 60 * 24 * 1000 * 7 // 7 days - 1 week
  return defineOgImage({
    cache: true,
    ...options,
  })
}

export function defineOgImageWithoutCache(options: OgImageOptions = {}) {
  return defineOgImage({
    ...options,
    cache: false,
    cacheTtl: 0,
  })
}

type ExtractComponentProps<T extends Component> = T extends new (...args: any) => any
  ? Omit<InstanceType<T>['$props'], keyof ComponentCustomProps | keyof VNodeProps | keyof AllowedComponentProps>
  : never

export function defineOgImageComponent<T extends keyof OgImageComponents>(component: T, props: ExtractComponentProps<OgImageComponents[T]>, options: OgImageOptions = {}) {
  defineOgImage({
    component,
    ...props,
    ...options,
  })
}

export function defineOgImage(_options: DefineOgImageInput = {}) {
  // string is supported as an easy way to override the generated og image data
  // clone to avoid any issues
  if (!import.meta.server)
    return

  const nuxtApp = useNuxtApp()
  const ogImageInstances = nuxtApp.ssrContext!._ogImageInstances || []
  const basePath = useRouter().currentRoute.value?.path

  // need to check route rules hasn't disabled this
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: useRuntimeConfig().nitro?.routeRules }),
  )
  const routeRules = defu({}, ..._routeRulesMatcher.matchAll(
    withoutBase(basePath.split('?')[0], useRuntimeConfig().app.baseURL),
  ).reverse()).ogImage as NitroRouteRules['ogImage']
  // has been disabled by route rules
  if (!_options || nuxtApp.ssrContext?.event.context._nitro?.routeRules?.ogImage === false || (typeof routeRules !== 'undefined' && routeRules === false)) {
    // remove the previous entries
    ogImageInstances.forEach((e: ActiveHeadEntry<any>) => {
      e.dispose()
    })
    nuxtApp.ssrContext!._ogImageInstances = undefined
    return
  }
  const options = normaliseOptions({
    ..._options,
  })

  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  const resolvedOptions = normaliseOptions(defu(options, routeRules, defaults) as OgImageOptions)
  // allow overriding using a prebuild config
  if (_options.url) {
    createOgImageMeta(null, options, resolvedOptions, nuxtApp.ssrContext)
  }
  else {
    const path = getOgImagePath(basePath, resolvedOptions)
    if (import.meta.prerender)
      appendHeader(useRequestEvent(), 'x-nitro-prerender', path)
    createOgImageMeta(path, options, resolvedOptions, nuxtApp.ssrContext)
  }
}
