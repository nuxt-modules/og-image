import { prefixStorage } from 'unstorage'
import type { H3Event } from 'h3'
import { getQuery, setHeader } from 'h3'
import { useRuntimeConfig, useStorage } from '#imports'

export async function useNitroCache<T>(e: H3Event, options: {
  key: string
  cacheTtl: number
  cache: boolean
  headers: boolean
  skipRestore?: boolean
}): Promise<{ cachedItem: false | T, enabled: boolean, update: (item: T) => Promise<void> }> {
  const module = 'nuxt-og-image'
  const { runtimeCacheStorage, version } = useRuntimeConfig()[module] as any as { version: string, runtimeCacheStorage: any }

  const enabled = options.cache && runtimeCacheStorage && options.cacheTtl && options.cacheTtl > 0
  const baseCacheKey = runtimeCacheStorage === 'default' ? `/cache/${module}@${version}` : `/${module}@${version}`
  const cache = prefixStorage(useStorage(), `${baseCacheKey}/`)
  const key = options.key

  let xCacheHeader = 'DISABLED'
  let xCacheExpires = 0
  const newExpires = Date.now() + (options.cacheTtl || 0)
  const purge = typeof getQuery(e).purge !== 'undefined'
  // cache will invalidate if the options change
  let cachedItem: T | false = false
  if (!options.skipRestore && enabled && await cache.hasItem(key).catch(() => false)) {
    const { value, expiresAt } = await cache.getItem(key).catch(() => ({ value: null, expiresAt: Date.now() })) as any
    if (purge) {
      xCacheHeader = 'PURGE'
      xCacheExpires = newExpires
      await cache.removeItem(key).catch(() => {})
    }
    else if (expiresAt > Date.now()) {
      xCacheHeader = 'HIT'
      xCacheExpires = newExpires
      cachedItem = value as T
    }
    else {
      // miss
      xCacheHeader = 'MISS'
      xCacheExpires = expiresAt
      await cache.removeItem(key).catch(() => {})
    }
  }
  if (options.headers) {
    // append the headers
    setHeader(e, `x-${module}-cache`, xCacheHeader)
    setHeader(e, `x-${module}-expires`, xCacheExpires.toString())
  }

  return {
    enabled,
    cachedItem,
    async update(item: T) {
      enabled && await cache.setItem(key, { value: item, expiresAt: Date.now() + (options.cacheTtl || 0) })
    },
  }
}
