import type { NuxtSSRContext } from '#app/nuxt'
import type { ActiveHeadEntry } from '@unhead/vue'
import type { NitroRouteRules } from 'nitropack'
import type { OgImageOptions } from '../../types'
import { useRequestEvent } from '#app'
import { withSiteUrl } from '#site-config/app/composables'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { defu } from 'defu'
import { parse, stringify } from 'devalue'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { parseURL, withoutBase } from 'ufo'
import { toValue } from 'vue'
import { createOgImageMeta } from '../../app/utils'
import { isInternalRoute, separateProps } from '../../shared'
import { getOgImagePath } from '../utils'

export function ogImageCanonicalUrls(nuxtApp: NuxtSSRContext['nuxt']) {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    // @ts-expect-error untyped
    ssrContext?.head.use(TemplateParamsPlugin)
    // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
    ssrContext?.head.use({
      key: 'nuxt-og-image:overrides-and-canonical-urls',
      hooks: {
        'tags:resolve': async (ctx) => {
          // check if script id 'nuxt-og-image-options' exists
          const hasPrimaryPayload = ctx.tags.some(tag => tag.tag === 'script' && tag.props.id === 'nuxt-og-image-options')
          // see if id "nuxt-og-image-overrides" exists
          let overrides: OgImageOptions | undefined
          for (const tag of ctx.tags) {
            if (tag.tag === 'script' && tag.props.id === 'nuxt-og-image-overrides') {
              if (hasPrimaryPayload) {
                overrides = separateProps(parse(tag.innerHTML || '{}'))
                delete ctx.tags[ctx.tags.indexOf(tag)]
              }
              else {
                // make this the primary payload
                tag.props.id = 'nuxt-og-image-options'
                tag.innerHTML = stringify(separateProps(parse(tag.innerHTML || '{}')))
                tag._d = 'script:id:nuxt-og-image-options'
              }
              break
            }
          }
          ctx.tags = ctx.tags.filter(Boolean)

          for (const tag of ctx.tags) {
            if (tag.tag === 'meta' && (tag.props.property === 'og:image' || ['twitter:image:src', 'twitter:image'].includes(tag.props.name || ''))) {
              if (!tag.props.content) {
                tag.props = {} // equivalent to removing
                continue
              }
              // looking for:
              // property og:image
              // property twitter:image:src
              if (!tag.props.content?.startsWith('https')) {
                await nuxtApp.runWithContext(() => {
                  tag.props.content = toValue(withSiteUrl(tag.props.content || '', {
                    withBase: true,
                  }))
                })
              }
            }
            // need to insert the overrides into the payload
            else if (overrides && tag.tag === 'script' && tag.props.id === 'nuxt-og-image-options') {
              tag.innerHTML = stringify(defu(overrides, parse(tag.innerHTML || '{}')))
            }
          }
        },
      },
    })
  })
}

export function routeRuleOgImage(nuxtApp: NuxtSSRContext['nuxt']) {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    const _routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: ssrContext?.runtimeConfig?.nitro?.routeRules }),
    )
    const matchedRules = _routeRulesMatcher.matchAll(
      withoutBase(path.split('?')?.[0] || '', ssrContext?.runtimeConfig?.app.baseURL || ''),
    ).reverse()
    const combinedRules = defu({}, ...matchedRules) as any
    let routeRules = combinedRules?.ogImage as NitroRouteRules['ogImage']
    if (typeof routeRules === 'undefined')
      return

    // if they have a payload, then we can just skip
    const ogImageInstances = nuxtApp.ssrContext!._ogImageInstances || []
    // if we've opted out of route rules, we need to remove this entry
    if (routeRules === false) {
      (ogImageInstances as ActiveHeadEntry<any>[])?.forEach((e: ActiveHeadEntry<any>) => {
        e.dispose()
      })
      nuxtApp.ssrContext!._ogImagePayload = undefined
      nuxtApp.ssrContext!._ogImageInstances = undefined
      return
    }
    routeRules = defu((nuxtApp.ssrContext?.event as any)?.context._nitro?.routeRules?.ogImage, routeRules)
    const src = getOgImagePath(ssrContext!.url, routeRules as any)
    createOgImageMeta(src, routeRules as any, nuxtApp.ssrContext!)
  })
}
