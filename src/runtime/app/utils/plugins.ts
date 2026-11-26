import type { OgImageOptions } from '../../types'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { defu } from 'defu'
import { createNitroRouteRuleMatcher } from 'nuxtseo-shared/server'
import { parseURL } from 'ufo'
import { toValue } from 'vue'
import { defineNuxtPlugin, useRequestEvent } from '#app'
import { withSiteUrl } from '#site-config/app'
import { createOgImageMeta, getOgImagePath } from '../../app/utils'
import { isErrorResponseEvent, isInternalRoute } from '../../shared'
import { createCachedRouteRuleMatcher } from '../../shared/routeRules'

const RE_COMMA = /,/g

interface OgImageRouteRules {
  ogImage?: false | OgImageOptions & Record<string, any>
}

const getCachedRouteRuleMatcher = createCachedRouteRuleMatcher(
  runtimeConfig => createNitroRouteRuleMatcher<OgImageRouteRules>(runtimeConfig),
)

function isErrorPage(
  nuxtApp: { payload?: { error?: unknown } },
  ssrContext?: { error?: boolean, payload?: { error?: unknown } },
  event?: Parameters<typeof isErrorResponseEvent>[0],
): boolean {
  return Boolean(ssrContext?.error || ssrContext?.payload?.error || nuxtApp.payload?.error) || isErrorResponseEvent(event)
}

export const ogImageCanonicalUrls = defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = ssrContext?.event || useRequestEvent()
    if (isErrorPage(nuxtApp, ssrContext, e)) {
      if (e?.context)
        e.context._ogImageErrorPage = true
      return
    }
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
            if (tag.tag === 'meta' && (tag.props.property === 'og:image' || tag.props.name === 'twitter:image')) {
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
              if (!/^https?:\/\//.test(tag.props.content || '')) {
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
})

export const routeRuleOgImage = defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = ssrContext?.event || useRequestEvent()
    if (isErrorPage(nuxtApp, ssrContext, e)) {
      if (e?.context)
        e.context._ogImageErrorPage = true
      return
    }
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    const matchRouteRules = getCachedRouteRuleMatcher(ssrContext?.runtimeConfig)
    let routeRules = matchRouteRules(path).ogImage
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
    routeRules = defu(nuxtApp.ssrContext?.event?.context._nitro?.routeRules?.ogImage, routeRules)
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
})
