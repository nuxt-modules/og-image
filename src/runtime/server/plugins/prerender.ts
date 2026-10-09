import type { Hookable } from 'hookable'
import { parse } from 'devalue'
import { parseURL, withoutBase, withQuery } from 'ufo'
import { appendResponseHeader } from '#nuxtseo/h3'
import { defineNitroPlugin, useRuntimeConfig, useStorage } from '#nuxtseo/nitro'
import { prerenderOptionsCache } from '#og-image-cache'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { createSitePathResolver } from '#site-config/server/composables/utils'
import { logger } from '../../logger'
import { isInternalRoute } from '../../shared'
import { getPublishKey, publishImage } from '../og-image/cache/publish'
import { resolvePathCacheKey } from '../og-image/context'
import { createNitroRouteRuleMatcher } from '../util/kit'
import { useOgImageRuntimeConfig } from '../utils'

const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/
const RE_SCRIPT_OPTIONS = /<script id="nuxt-og-image-options" type="application\/json">[\s\S]*?<\/script>/
const RE_SCRIPT_OVERRIDES = /<script id="nuxt-og-image-overrides" type="application\/json">[\s\S]*?<\/script>/

function getPayloadFromHtml(html: string): string | null {
  const match = String(html).match(PAYLOAD_REGEX)
  return match ? String(match[1]) : null
}

// @ts-expect-error hookable v6
export default defineNitroPlugin(async (nitro: { hooks: Hookable<any>, localFetch: typeof fetch }) => {
  if (!import.meta.prerender)
    return

  const routeRuleMatcher = createNitroRouteRuleMatcher()
  // Browser screenshots fetch their source page while publishing its image.
  const publishingPages = new Set<string>()
  let publishWarningShown = false
  nitro.hooks.hook('render:html', async (html: { head: string[], bodyAppend: string[], body?: string[], bodyPrepend?: string[], htmlAttrs?: string[], bodyAttrs?: string[] }, ctx: { event: any }) => {
    const { head, bodyAppend } = html
    const path = parseURL(ctx.event.path).pathname
    if (isInternalRoute(path))
      return

    const routeRules = routeRuleMatcher(path)
    if (routeRules.ogImage === false)
      return
    // when prerendering we want to cache the options for a quicker response when we render the image
    const _payload = getPayloadFromHtml([head.join('\n'), bodyAppend.join('\n')].join('\n'))
    if (!_payload)
      return
    const parsed = parse(_payload) as { key?: string, _hash?: string }[]
    const payloads: [string, any][] = parsed.map(opt => [opt.key || 'og', opt])
    const resolvePathWithBase = createSitePathResolver(ctx.event, {
      absolute: false,
      withBase: true,
    })
    const key = resolvePathCacheKey(ctx.event, resolvePathWithBase(path))
    await prerenderOptionsCache!.setItem(key, payloads)

    // Also store by hash for hash-mode URLs. The hash omits the page path so
    // pages with identical options share one image; store the path so route
    // rules and page lookups resolve against a real page, not `/`.
    const pagePath = withoutBase(path, useRuntimeConfig().app.baseURL)
    for (const [_ogKey, opt] of payloads) {
      if (opt._hash) {
        await prerenderOptionsCache!.setItem(`hash:${opt._hash}`, { ...opt, _path: pagePath })
      }
    }

    // Emit x-nitro-prerender headers from the finalized prerender paths.
    // These paths are stored on the event context by defineOgImage, keyed by OG key
    // so that only the final path per key is emitted (preventing stale hash URLs
    // from being enqueued when defineOgImage is called multiple times with the same key).
    const prerenderPaths: Map<string, string> | undefined = ctx.event.context._ogImagePrerenderPaths
    if (prerenderPaths) {
      const config = useOgImageRuntimeConfig(ctx.event)
      const publish = config.publish
      if (publish && !publishingPages.has(path)) {
        publishingPages.add(path)
        try {
          for (const [ogKey, prerenderPath] of prerenderPaths) {
            const extension = prerenderPath.split('.').pop()
            if (!prerenderPath.includes('/_og/s/') || (extension !== 'png' && extension !== 'jpeg' && extension !== 'jpg' && extension !== 'webp'))
              continue
            const opt = payloads.find(([key]) => key === ogKey)?.[1]
            if (!opt)
              continue
            const result = await publishImage({
              storage: useStorage(),
              mount: publish.storage,
              baseURL: publish.baseURL,
              key: getPublishKey(new URL(prerenderPath, getSiteConfig(ctx.event).url).href, config.defaults, publish.cacheVersion),
              extension,
              maxAgeSeconds: Number(opt.cacheMaxAgeSeconds ?? config.defaults.cacheMaxAgeSeconds),
              timeoutMs: config.security.renderTimeout,
              now: Date.now,
              render: async () => {
                if (opt.component === 'PageScreenshot') {
                  // The source page is still rendering. A recursive fetch cannot return its HTML yet.
                  opt._prerenderHtml = `<!DOCTYPE html><html ${(html.htmlAttrs || []).join(' ')}><head>${html.head.join('')}</head><body ${(html.bodyAttrs || []).join(' ')}>${[...(html.bodyPrepend || []), ...(html.body || []), ...html.bodyAppend].join('')}</body></html>`
                  await prerenderOptionsCache!.setItem(key, payloads)
                  if (opt._hash)
                    await prerenderOptionsCache!.setItem(`hash:${opt._hash}`, { ...opt, _path: pagePath })
                }
                const response = await nitro.localFetch(opt._query ? withQuery(prerenderPath, { _query: opt._query }) : prerenderPath)
                if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
                  throw new Error(`Image render failed: ${response.status}. ${(await response.text()).slice(0, 1000)}`)
                return new Uint8Array(await response.arrayBuffer())
              },
            })
            if (result._tag === 'Published') {
              // Replace only the finalized image URL, preserving all other metadata.
              html.head = html.head.map(entry => entry.replace(/(<meta\b[^>]+\bcontent=")([^"]*)("[^>]*>)/g, (tag, start, url, end) => {
                if (!/\b(?:property|name)="(?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)"/.test(tag))
                  return tag
                const urlPath = parseURL(url.replace(/&amp;/g, '&')).pathname
                return urlPath?.replace(/,/g, '%2C') === prerenderPath ? `${start}${result.url}${end}` : tag
              }))
              prerenderPaths.delete(ogKey)
            }
            else if (!publishWarningShown) {
              publishWarningShown = true
              logger.warn('[Nuxt OG Image] Publish storage is unavailable. Using local image URLs.', result.reason)
            }
          }
        }
        finally {
          publishingPages.delete(path)
        }
      }
      for (const prerenderPath of prerenderPaths.values()) {
        appendResponseHeader(ctx.event, 'x-nitro-prerender', prerenderPath)
      }
    }

    // if we're prerendering then we don't need these options in the final HTML
    const index = html.bodyAppend.findIndex((script: string) => script.includes('id="nuxt-og-image-options"'))
    if (index !== -1) {
      // we need to remove `<script id="nuxt-og-image-options" type="application/json">...anything...</script>`
      html.bodyAppend[index] = String(html.bodyAppend[index]).replace(RE_SCRIPT_OPTIONS, '')
      html.bodyAppend[index] = html.bodyAppend[index].replace(RE_SCRIPT_OVERRIDES, '')
    }
  })
})
