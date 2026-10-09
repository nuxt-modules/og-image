import { parseURL, withoutBase } from 'ufo'
import { defineNitroPlugin } from '#nuxtseo/nitro'
import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { logger } from '../../logger'
import { isInternalRoute } from '../../shared'
import { getPublishKey } from '../og-image/cache/publish'
import { getPublishedImageCache, getPublishedImageCacheKey } from '../og-image/cache/published'
import { useOgImageRuntimeConfig } from '../utils'

const IMAGE_META = /<meta\b[^>]+\b(?:property|name)="(?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)"[^>]*>/g
const CONTENT = /\bcontent="([^"]+)"/

export default defineNitroPlugin((nitro) => {
  if (import.meta.dev || import.meta.prerender)
    return
  nitro.hooks.hook('render:html', (html, { event }) => {
    if (isInternalRoute(parseURL(event.path).pathname))
      return
    const config = useOgImageRuntimeConfig(event)
    const publish = config.publish
    if (!publish)
      return
    const siteURL = new URL(getSiteConfig(event).url)
    const replacements = new Map<string, string>()
    const urls = new Set(html.head.flatMap(entry => [...entry.matchAll(IMAGE_META)].map(match => match[0].match(CONTENT)?.[1]).filter((url): url is string => !!url)))
    const cache = getPublishedImageCache(nitro)
    for (const source of urls) {
      try {
        const url = new URL(source.replace(/&amp;/g, '&'), siteURL)
        const path = withoutBase(url.pathname, config.app.baseURL)
        if (url.origin !== siteURL.origin || !path.startsWith('/_og/d/'))
          continue
        const extension = path.split('.').pop()
        if (extension !== 'png' && extension !== 'jpeg' && extension !== 'jpg' && extension !== 'webp')
          continue
        const key = getPublishedImageCacheKey(publish, getPublishKey(url.href, config.defaults, publish.cacheVersion), extension)
        const result = cache.get(key, Date.now())
        if (result)
          replacements.set(source, result.url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      }
      catch (err) {
        // User-supplied meta URLs can be malformed. Keep their existing app URL.
        logger.debug('[Nuxt OG Image] Published URL lookup failed. Keeping the app image URL.', err)
      }
    }
    html.head = html.head.map(entry => entry.replace(IMAGE_META, tag => tag.replace(CONTENT, (content, source) => replacements.has(source) ? `content="${replacements.get(source)}"` : content)))
  })
})
