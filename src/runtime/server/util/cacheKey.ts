import type { H3Event } from 'h3'
import { hash } from 'ohash'
import { getQuery } from 'h3'
import { useSiteConfig } from '#site-config/server/composables/useSiteConfig'
import { withoutTrailingSlash, withoutLeadingSlash } from 'ufo'
import { normalizeKey } from 'unstorage'
import { useOgImageRuntimeConfig } from '../../shared'

/**
 * Generate a cache key for the OG image based on the path and configuration
 */
export function generateCacheKey(e: H3Event, path: string): string {
  const config = useOgImageRuntimeConfig()
  const siteConfig = useSiteConfig(e, {
    resolveRefs: true,
  })

  const basePath = withoutTrailingSlash(withoutLeadingSlash(normalizeKey(path)))

  // Custom key handler takes precedence if defined
  if (typeof config.cacheKeyHandler === 'function') {
    return config.cacheKeyHandler(basePath, e)
  }

  // Determine whether to include query parameters in the cache key
  const queryParams = config.cacheIgnoreQuery ? {} : getQuery(e)

  return [
    (!basePath || basePath === '/') ? 'index' : basePath,
    hash([
      basePath,
      import.meta.prerender ? '' : siteConfig.url,
      // Only include query params in the hash if cacheIgnoreQuery is false
      config.cacheIgnoreQuery ? '' : hash(queryParams),
    ]),
  ].join(':')
}

/**
 * Generate the base cache key prefix
 */
export function getCacheBase(): string {
  const config = useOgImageRuntimeConfig()

  // Use custom key if provided
  if (config.key) {
    return config.key
  }

  // Otherwise use the default (which might include version)
  return config.baseCacheKey || '/'
}
