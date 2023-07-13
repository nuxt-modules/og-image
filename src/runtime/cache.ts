import { prefixStorage } from 'unstorage'
import type { H3Event } from 'h3'
import { getQuery, setHeader } from 'h3'
import { useRuntimeConfig, useStorage } from '#imports'

export async function useNitroCache<T>(e: H3Event, module: string, options: { key: string; cacheTtl: number; cache: boolean; headers: boolean; skipRestore?: boolean }) {
  const { runtimeCacheStorage, version } = useRuntimeConfig()[module] as any as { version: string; runtimeCacheStorage: any }

  const enabled = !process.dev && runtimeCacheStorage && options.cacheTtl && options.cacheTtl > 0 && options.cache
  const baseCacheKey = runtimeCacheStorage === 'default' ? `/cache/${module}@${version}` : `/${module}@${version}`
  const cache = prefixStorage(useStorage(), `${baseCacheKey}/`)
  const key = options.key

  let xCacheHeader = 'MISS'
  let xCacheExpires = 0
  const purge = typeof getQuery(e).purge !== 'undefined'
  // cache will invalidate if the options change
  let cachedItem: T | false = false
  if (!options.skipRestore && enabled && await cache.hasItem(key).catch(() => false)) {
    const { value, expiresAt } = await cache.getItem(key).catch(() => ({ value: null, expiresAt: Date.now() })) as any
    if (expiresAt > Date.now()) {
      if (purge) {
        xCacheHeader = 'PURGE'
        await cache.removeItem(key).catch(() => {})
      }
      else {
        xCacheHeader = 'HIT'
        xCacheExpires = expiresAt
        cachedItem = value as T
      }
    }
    else {
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
