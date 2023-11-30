import { defu } from 'defu'
import { parseURL, withoutBase } from 'ufo'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import type { NitroRouteRules } from 'nitropack'
import type { ActiveHeadEntry } from '@unhead/schema'
import { normaliseOptions } from '../../core/options/normalise'
import { getOgImagePath, isInternalRoute } from '../../utils'
import type { OgImageOptions } from '../../types'
import { createOgImageMeta } from '../utilts'
import { defineNuxtPlugin, useRequestEvent, useRuntimeConfig } from '#imports'

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
      nuxtApp.ssrContext!._ogImageInstances = undefined
      return
    }
    // otherwise it's fine to rely on payload, we'll need to merge in route rules anyway
    if (ogImageInstances.length >= 0)
      return

    routeRules = defu(nuxtApp.ssrContext?.event.context._nitro?.routeRules?.ogImage, routeRules)

    const { defaults } = useRuntimeConfig()['nuxt-og-image']
    const resolvedOptions = normaliseOptions(defu(routeRules, defaults) as OgImageOptions)
    const src = getOgImagePath(ssrContext!.url, resolvedOptions)

    createOgImageMeta(src, {}, resolvedOptions, nuxtApp.ssrContext!)
  })
})
