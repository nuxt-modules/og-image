import type { ModuleOptions as OgImageOptions } from 'nuxt-og-image'
import type { ModuleOptions as SiteConfigOptions } from 'nuxt-site-config'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    ['nuxt-site-config', { url: 'https://og-image.example.com' } satisfies Partial<SiteConfigOptions>],
    ['nuxt-og-image', {
      runtimeCacheStorage: process.env.NUXT_TEST_CACHE_OBJECT === '1' ? { driver: 'memory' } : true,
      security: { secret: false },
    } satisfies Partial<OgImageOptions>],
  ],
  devtools: { enabled: false },
  compatibilityDate: '2026-06-10',
})
