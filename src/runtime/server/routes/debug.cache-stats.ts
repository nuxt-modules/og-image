import { useStorage } from '#imports'
import { defineEventHandler } from 'h3'
import { withTrailingSlash } from 'ufo'
import { prefixStorage } from 'unstorage'
import { useOgImageRuntimeConfig } from '../../shared'
import { getCacheBase } from '../util/cacheKey'

/**
 * Debug endpoint that shows cache statistics and information
 * Only available when debug mode is enabled
 */
export default defineEventHandler(async (event) => {
  const config = useOgImageRuntimeConfig()

  // Only allow this endpoint in debug mode
  if (!config.debug) {
    return {
      error: 'Cache stats are only available in debug mode. Set debug: true in your Nuxt OG Image config.',
    }
  }

  try {
    const cacheBase = getCacheBase()
    const cache = prefixStorage(useStorage(), withTrailingSlash(cacheBase))

    // Get all keys to analyze cache usage
    const keys = await cache.getKeys()

    // Get cache configuration
    const cacheConfig = {
      base: cacheBase,
      ignoreQuery: config.cacheIgnoreQuery || false,
      customKeyHandler: !!config.cacheKeyHandler,
      enabled: config.runtimeCacheStorage !== false,
    }

    // Get some basic stats
    const stats = {
      totalEntries: keys.length,
      keysByPrefix: {} as Record<string, number>,
    }

    // Categorize keys by prefix for more detailed analysis
    keys.forEach((key) => {
      const prefix = key.split(':')[0] || 'unknown'
      stats.keysByPrefix[prefix] = (stats.keysByPrefix[prefix] || 0) + 1
    })

    return {
      config: cacheConfig,
      stats,
      // Include a limited number of cache keys for debugging
      recentKeys: keys.slice(0, 10),
    }
  }
  catch (error) {
    return {
      error: `Failed to get cache stats: ${error.message}`,
    }
  }
})
