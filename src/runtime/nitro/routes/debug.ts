import { defineEventHandler, setHeader } from 'h3'
import { useRuntimeConfig, useSiteConfig } from '#imports'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useRuntimeConfig()['nuxt-og-image']
  const siteConfig = await useSiteConfig(e)
  return {
    siteConfigUrl: {
      value: siteConfig.url,
      source: siteConfig._context.url || 'unknown',
    },
    runtimeConfig,
  }
})
