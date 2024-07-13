import { defu } from 'defu'
import { parseURL, withoutBase } from 'ufo'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import type { NitroRouteRules } from 'nitropack'
import type { ActiveHeadEntry } from '@unhead/schema'
import { getOgImagePath, isInternalRoute, useOgImageRuntimeConfig } from '../../shared'
import type { OgImageOptions } from '../../types'
import { createOgImageMeta, normaliseOptions } from '../utils'
import { defineNuxtPlugin, useRequestEvent } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e.path).pathname
    if (isInternalRoute(path))
      return

    const _routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: ssrContext?.runtimeConfig?.nitro?.routeRules }),
    )
    let routeRules = defu({}, ..._routeRulesMatcher.matchAll(
      withoutBase(path.split('?')[0], ssrContext?.runtimeConfig?.app.baseURL),
    ).reverse()).ogImage as NitroRouteRules['ogImage']
    if (typeof routeRules === 'undefined')
      return

    // if they have a payload, then we can just skip
    const ogImageInstances = nuxtApp.ssrContext!._ogImageInstances || []
    // if we've opted out of route rules, we need to remove this entry
    if (routeRules === false) {
      ogImageInstances?.forEach((e: ActiveHeadEntry<any>) => {
        e.dispose()
      })
      nuxtApp.ssrContext!._ogImagePayload = undefined
      nuxtApp.ssrContext!._ogImageInstances = undefined
      return
    }

    routeRules = normaliseOptions(defu(nuxtApp.ssrContext?.event.context._nitro?.routeRules?.ogImage, routeRules))

    const { defaults } = useOgImageRuntimeConfig()
    const resolvedOptions = normaliseOptions(defu(routeRules, defaults) as OgImageOptions)
    const src = getOgImagePath(ssrContext!.url, resolvedOptions)
    createOgImageMeta(src, routeRules, resolvedOptions, nuxtApp.ssrContext!)
  })
})
