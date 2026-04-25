import type { Hookable } from 'hookable'
import { parse } from 'devalue'
import { appendResponseHeader } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'
import { parseURL } from 'ufo'
import { prerenderOptionsCache } from '#og-image-cache'
import { createSitePathResolver } from '#site-config/server/composables/utils'
import { isInternalRoute } from '../../shared'
import { resolvePathCacheKey } from '../og-image/context'
import { createNitroRouteRuleMatcher } from '../util/kit'

const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/
const RE_SCRIPT_OPTIONS = /<script id="nuxt-og-image-options" type="application\/json">[\s\S]*?<\/script>/
const RE_SCRIPT_OVERRIDES = /<script id="nuxt-og-image-overrides" type="application\/json">[\s\S]*?<\/script>/

function getPayloadFromHtml(html: string): string | null {
  const match = String(html).match(PAYLOAD_REGEX)
  return match ? String(match[1]) : null
}

export default defineNitroPlugin(async (nitro: { hooks: Hookable<any> }) => {
  if (!import.meta.prerender)
    return

  const routeRuleMatcher = createNitroRouteRuleMatcher()
  nitro.hooks.hook('render:html', async (html: { head: string[], bodyAppend: string[] }, ctx: { event: any }) => {
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

    // Also store by hash for hash-mode URLs (when path was too long)
    for (const [_ogKey, opt] of payloads) {
      if (opt._hash) {
        await prerenderOptionsCache!.setItem(`hash:${opt._hash}`, opt)
      }
    }

    // Emit x-nitro-prerender headers from the finalized prerender paths.
    // These paths are stored on the event context by defineOgImage, keyed by OG key
    // so that only the final path per key is emitted (preventing stale hash URLs
    // from being enqueued when defineOgImage is called multiple times with the same key).
    const prerenderPaths: Map<string, string> | undefined = ctx.event.context._ogImagePrerenderPaths
    if (prerenderPaths) {
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
