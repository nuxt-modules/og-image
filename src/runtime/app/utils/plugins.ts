import type { VueHeadClient } from '@unhead/vue'
import type { OgImageOptions } from '../../types'
import { TemplateParamsPlugin } from '@unhead/vue/plugins'
import { defu } from 'defu'
import { createNitroRouteRuleMatcher } from 'nuxtseo-shared/server'
import { parseURL } from 'ufo'
import { toValue } from 'vue'
import { defineNuxtPlugin, useRequestEvent } from '#app'
import { readEntry, withTagTransform } from '#build/nuxt-og-image/compiled-meta-server.mjs'
import { metaShapes } from '#build/nuxt-og-image/compiled-meta.mjs'
import { withSiteUrl } from '#site-config/app'
import { createOgImageMeta, getOgImagePath } from '../../app/utils'
import { isInternalRoute } from '../../shared'

const RE_COMMA = /,/g

interface OgImageRouteRules {
  ogImage?: false | OgImageOptions & Record<string, any>
}

type HeadPlugin = Exclude<Parameters<VueHeadClient['use']>[0], (...args: any[]) => any>
type HeadTag = Parameters<NonNullable<NonNullable<HeadPlugin['hooks']>['tags:afterResolve']>>[0]['tags'][number]

interface ReadableHead {
  entries: Map<number, unknown>
}

type ReadEntry = (entry: any, head: any) => { input: Record<string, any> }

/** The Unhead APIs a tag transform needs, from `#build/nuxt-og-image/compiled-meta-server.mjs`. */
export interface TransformApi {
  readEntry: ReadEntry
  withTagTransform: (head: any, plugin: HeadPlugin) => HeadPlugin
}

const CANONICAL_URLS_PLUGIN_KEY = 'nuxt-og-image:overrides-and-canonical-urls'
const HTTP_RE = /^https?:\/\//
// The start of a dynamic value token: the server memo runs a transform with one in place of each dynamic value
const DYNAMIC_VALUE_OPEN = String.fromCharCode(0xE000)

const isImageMeta = (props: Record<string, any>) => props.property === 'og:image' || props.name === 'twitter:image'

/** The hook that makes og:image URLs absolute, and fills `%title` and `%description`. */
export function createCanonicalUrlsPlugin(siteUrl: (path: string) => string): HeadPlugin {
  return {
    key: CANONICAL_URLS_PLUGIN_KEY,
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
}

/** Whether the hook would leave an image URL as it is. */
function isFinalImageUrl(content: unknown): boolean {
  return typeof content === 'string' && !!content && !content.includes('%') && !content.includes(' ') && HTTP_RE.test(content)
}

/**
 * The cache key of the canonical URLs transform: the site URL while every image URL of the head
 * is final, and `null` otherwise. The memo holds a token for a dynamic value, so the transform
 * leaves a token as it is, and the memo holds its output only while that is right.
 */
export function canonicalUrlsCacheKey(head: ReadableHead, read: ReadEntry, siteKey: string): string | null {
  for (const entry of head.entries.values()) {
    const meta = read(entry, head).input.meta
    for (const props of Array.isArray(meta) ? meta : meta ? [meta] : []) {
      if (props && typeof props === 'object' && isImageMeta(props) && !isFinalImageUrl(props.content))
        return null
    }
  }
  return siteKey
}

/**
 * The canonical URLs hook as a tag transform, for compiler mode: the same output, with the
 * server memo and no full runtime. It returns new tags and leaves a memo token as it is.
 */
export function createCanonicalUrlsTransform(head: ReadableHead, api: TransformApi, siteUrl: (path: string) => string): HeadPlugin {
  const siteKey = siteUrl('/')
  return api.withTagTransform(head, {
    key: CANONICAL_URLS_PLUGIN_KEY,
    transform: (tags: HeadTag[]) => {
      let title = ''
      let description = ''
      for (const tag of tags) {
        if (tag.tag === 'title' && tag.textContent)
          title = tag.textContent
        else if (tag.tag === 'meta' && tag.props.name === 'description')
          description = tag.props.content || ''
        if (title && description)
          break
      }
      return tags.map((tag) => {
        if (tag.tag !== 'meta' || !isImageMeta(tag.props))
          return tag
        const content = tag.props.content
        if (!content)
          return { ...tag, props: {} }
        if (content.includes(DYNAMIC_VALUE_OPEN))
          return tag
        const next = content.replaceAll('%title', title).replaceAll('%description', description).replaceAll(' ', '+')
        return { ...tag, props: { ...tag.props, content: HTTP_RE.test(next) ? next : siteUrl(next) } }
      })
    },
    cacheKey: () => canonicalUrlsCacheKey(head, api.readEntry, siteKey),
  } as HeadPlugin)
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
    // Under compiler mode the hook becomes a tag transform, which keeps the server memo.
    // `metaShapes` exists only under compiler mode, where every head takes compiled tags.
    const head = ssrContext?.head as unknown as ReadableHead | undefined
    if (ssrContext && head && readEntry && withTagTransform && metaShapes) {
      ssrContext._ogImageSiteUrl = siteUrl
      ssrContext.head.use(createCanonicalUrlsTransform(head, { readEntry, withTagTransform }, siteUrl))
      return
    }
    // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
    ssrContext?.head.use(createCanonicalUrlsPlugin(siteUrl))
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
