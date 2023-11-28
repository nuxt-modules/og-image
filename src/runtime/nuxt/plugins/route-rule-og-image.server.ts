import { defu } from 'defu'
import { parseURL, withoutBase } from 'ufo'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import type { NitroRouteRules } from 'nitropack'
import { normaliseOptions } from '../../core/options/normalise'
import { getOgImagePath, isInternalRoute } from '../../utilts'
import { useRequestEvent, useRuntimeConfig } from '#imports'

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
    const routeRules = defu({}, ..._routeRulesMatcher.matchAll(
      withoutBase(path.split('?')[0], ssrContext?.runtimeConfig?.app.baseURL),
    ).reverse()).ogImage as NitroRouteRules['ogImage']
    if (typeof routeRules === 'undefined')
      return

    // if they have a payload, then we can just skip
    const payloadIndex = ssrContext!.head.headEntries().findIndex((entry) => {
      return entry.input?.script?.[0]?.id === 'nuxt-og-image-options'
    })
    // if we've opted out of route rules, we need to remove this entry
    if (payloadIndex >= 0 && routeRules === false) {
      ssrContext!.head.headEntries().splice(payloadIndex, 1)
      return
    }
    // otherwise it's fine to rely on payload, we'll need to merge in route rules anyway
    if (payloadIndex >= 0)
      return

    const options = normaliseOptions(routeRules)
    const { defaults } = useRuntimeConfig()['nuxt-og-image']
    const optionsWithDefault = normaliseOptions(defu(options, defaults))
    const src = getOgImagePath(ssrContext!.url, optionsWithDefault.extension)

    ssrContext?.head.push({
      script: [
        {
          id: 'nuxt-og-image-options',
          type: 'application/json',
          processTemplateParams: true,
          innerHTML: () => {
            const payload = {
              title: '%s',
            }
            // don't apply defaults
            // options is an object which has keys that may be kebab case, we need to convert the keys to camel case
            Object.entries(options).forEach(([key, val]) => {
              // with a simple kebab case conversion
              // @ts-expect-error untyped
              payload[key.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val
            })
            return payload
          },
          // we want this to be last in our head
          tagPosition: 'bodyClose',
        },
      ],
      meta: [
        { property: 'og:image', content: src },
        { property: 'og:image:width', content: optionsWithDefault.width },
        { property: 'og:image:height', content: optionsWithDefault.height },
        { property: 'og:image:type', content: `image/${optionsWithDefault.extension}` },
        { property: 'og:image:alt', content: optionsWithDefault.alt },
        // twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image:src', content: src },
        { name: 'twitter:image:width', content: optionsWithDefault.width },
        { name: 'twitter:image:height', content: optionsWithDefault.height },
        { name: 'twitter:image:alt', content: optionsWithDefault.alt },
      ],
    }, {
      mode: 'server',
      tagPriority: 35,
    })
  })
})
