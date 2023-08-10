import { defineEventHandler, setHeader } from 'h3'
import { prefixStorage } from 'unstorage'
import { useRuntimeConfig, useSiteConfig, useStorage } from '#imports'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useRuntimeConfig()['nuxt-og-image']
  const siteConfig = await useSiteConfig(e)

  const baseCacheKey = runtimeCacheStorage === 'default' ? `/cache/${module}@${version}` : `/${module}@${version}`
  const cache = prefixStorage(useStorage(), `${baseCacheKey}/`)
  return {
    siteConfigUrl: {
      value: siteConfig.url,
      source: siteConfig._context.url || 'unknown',
    },
    runtimeConfig,
    cachedKeys: await cache.keys(),
  }
})
