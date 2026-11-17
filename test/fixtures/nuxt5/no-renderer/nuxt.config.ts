import NuxtOgImage from 'nuxt-og-image'
import NuxtSiteConfig from 'nuxt-site-config'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [NuxtSiteConfig, NuxtOgImage],
  site: { url: 'https://og-image.example.com' },
  ogImage: {
    runtimeCacheStorage: process.env.NUXT_TEST_CACHE_OBJECT === '1' ? { driver: 'memory' } : true,
    security: { secret: false },
  },
  devtools: { enabled: false },
  compatibilityDate: '2026-06-10',
})
