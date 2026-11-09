import type { VueHeadClient } from '@unhead/vue'
import type { OgImageOptions } from '../../types'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { defu } from 'defu'
import { createNitroRouteRuleMatcher } from 'nuxtseo-shared/server'
import { parseURL } from 'ufo'
import { toValue } from 'vue'
import { defineNuxtPlugin, useRequestEvent } from '#app'
import { readEntry } from '#build/nuxt-og-image/compiled-meta-server.mjs'
import { metaShapes } from '#build/nuxt-og-image/compiled-meta.mjs'
import { withSiteUrl } from '#site-config/app'
import { rewriteImageMeta } from '../../app/compiledMeta'
import { createOgImageMeta, getOgImagePath, isOwnEntry, markOwnEntry } from '../../app/utils'
import { isInternalRoute } from '../../shared'

const RE_COMMA = /,/g

interface OgImageRouteRules {
  ogImage?: false | OgImageOptions & Record<string, any>
}

interface HeadEntryLike {
  _i: number
  input: unknown
}

type HeadPlugin = Exclude<Parameters<VueHeadClient['use']>[0], (...args: any[]) => any>

interface CompiledHead {
  entries: Map<number, HeadEntryLike>
  push: (input: unknown, options: { values: () => unknown[] }) => { _i: number }
  use: (plugin: HeadPlugin) => void
}

// The entry that rewrites renders no tag, so every request shares one set of compiled tags
const NO_TAGS: unknown[] = []

/**
 * Rewrites the image meta of every entry, as the canonical URLs hook does at the render.
 * Returns `false`, and rewrites nothing, when only the hook can decide an entry.
 */
export function rewriteImageEntries(head: { entries: Map<number, HeadEntryLike> }, siteUrl: (path: string) => string): boolean {
  const rewrites: [HeadEntryLike, unknown][] = []
  for (const entry of head.entries.values()) {
    // og-image makes the URLs of its own entries absolute
    if (isOwnEntry(head, entry))
      continue
    // Values settle: a compiled value function runs now, as the head render would run it
    const { input, seoMeta, compiled } = readEntry!(entry as any, head as any) as { input: Record<string, any>, seoMeta: boolean, compiled: boolean }
    if (input.meta === undefined)
      continue
    const result = rewriteImageMeta({ meta: input.meta }, siteUrl)
    // The meta of a loose useSeoMeta entry is packed: its image keys only the hook rewrites
    if (result._tag === 'Plugin' || (result._tag === 'Rewrite' && seoMeta && !compiled))
      return false
    if (result._tag === 'Rewrite')
      rewrites.push([entry, { ...input, meta: result.input.meta }])
  }
  for (const [entry, input] of rewrites)
    entry.input = input
  return true
}

export const ogImageCanonicalUrls = defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    ssrContext?.head.use(TemplateParamsPlugin)
    // `runWithContext` may wrap the return value, so the URL leaves through the closure
    const siteUrl = (path: string): string => {
      let url = path
      nuxtApp.runWithContext(() => {
        url = toValue(withSiteUrl(path, {
          withBase: true,
          canonical: !import.meta.dev,
        }))
      })
      return url
    }
    // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
    const canonicalUrlsPlugin: HeadPlugin = {
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
              if (!/^https?:\/\//.test(tag.props.content || ''))
                tag.props.content = siteUrl(tag.props.content || '')
            }
          }
        },
      },
    }
    // Under compiler mode a render hook sends the whole head to the full pipeline, so the image
    // meta of each entry is rewritten instead, at the head render: after every other
    // `app:rendered` listener has changed its entries. Content only the hook can decide keeps it.
    const head = ssrContext?.head as unknown as CompiledHead | undefined
    // `metaShapes` exists only under compiler mode, where every head takes compiled tags
    if (ssrContext && head && readEntry && metaShapes) {
      ssrContext._ogImageSiteUrl = siteUrl
      let rewriting = false
      const rewriter = head.push(NO_TAGS, {
        values: () => {
          // reading the entries reads this one too
          if (rewriting)
            return []
          rewriting = true
          if (!rewriteImageEntries(head, siteUrl))
            head.use(canonicalUrlsPlugin)
          rewriting = false
          return []
        },
      })
      markOwnEntry(head, rewriter)
      return
    }
    ssrContext?.head.use(canonicalUrlsPlugin)
  })
})

export const routeRuleOgImage = defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e?.path || '').pathname
    if (isInternalRoute(path))
      return

    const matchRouteRules = createNitroRouteRuleMatcher<OgImageRouteRules>(ssrContext?.runtimeConfig || {})
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
