import type { NitroRouteRules } from 'nitropack'
import type { NuxtSSRContext } from '#app/nuxt'
import type { OgImageOptions } from '../../types'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { defu } from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { parseURL, withoutBase } from 'ufo'
import { toValue } from 'vue'
import { useRequestEvent } from '#app'
import { withSiteUrl } from '#site-config/app/composables'
import { createOgImageMeta, getOgImagePath } from '../../app/utils'
import { isInternalRoute } from '../../shared'

const RE_COMMA = /,/g

export function ogImageCanonicalUrls(nuxtApp: NuxtSSRContext['nuxt']) {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    ssrContext?.head.use(TemplateParamsPlugin)
    // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
    ssrContext?.head.use({
      key: 'nuxt-og-image:overrides-and-canonical-urls',
      hooks: {
        'tags:afterResolve': (ctx) => {
          // find title and description as a first pass
          let title = ''
          let description = ''
          for (const tag of ctx.tags) {
            if (tag.tag === 'title' && tag.textContent) {
              title = tag.textContent
            }
            else if (tag.tag === 'meta' && tag.props.name === 'description') {
              description = tag.props.content || ''
            }
            if (title && description)
              break
          }

          for (const tag of ctx.tags) {
            if (tag.tag === 'meta' && (tag.props.property === 'og:image' || ['twitter:image:src', 'twitter:image'].includes(tag.props.name || ''))) {
              if (!tag.props.content) {
                tag.props = {} // equivalent to removing
                continue
              }
              // looking for:
              // make sure the query is sanitized
              tag.props.content = tag.props.content
                .replaceAll('%title', title)
                .replaceAll('%description', description)
                .replaceAll(' ', '+')
              // property og:image
              // property twitter:image:src
              if (!tag.props.content?.startsWith('https')) {
                nuxtApp.runWithContext(() => {
                  tag.props.content = toValue(withSiteUrl(tag.props.content || '', {
                    withBase: true,
                    canonical: !import.meta.dev,
                  }))
                })
              }
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

    // if we've opted out of route rules, we need to remove all entries
    if (routeRules === false) {
      nuxtApp.ssrContext!._ogImageInstance?.dispose()
      nuxtApp.ssrContext!._ogImageDevtoolsInstance?.dispose()
      nuxtApp.ssrContext!._ogImageInstance = undefined
      nuxtApp.ssrContext!._ogImagePayloads = []
      if (import.meta.prerender)
        e?.context._ogImagePrerenderPaths?.clear()
      return
    }
    routeRules = defu((nuxtApp.ssrContext?.event as any)?.context._nitro?.routeRules?.ogImage, routeRules)
    const { path: src, hash } = getOgImagePath(ssrContext!.url, routeRules as OgImageOptions)
    // Include hash in options if hash mode was used (for prerender cache lookup)
    if (hash) {
      (routeRules as OgImageOptions)._hash = hash
    }
    createOgImageMeta(src, routeRules as OgImageOptions, nuxtApp.ssrContext!)
    // Update prerender paths so the render:html hook emits the correct URL
    if (import.meta.prerender && e) {
      const ogKey = (routeRules as OgImageOptions).key || 'og'
      const prerenderPath = (src.split('?')[0] || src).replace(RE_COMMA, '%2C')
      const prerenderPaths: Map<string, string> = e.context._ogImagePrerenderPaths || (e.context._ogImagePrerenderPaths = new Map())
      prerenderPaths.set(ogKey, prerenderPath)
    }
  })
}
