import NuxtOgImage from '../../../src/module'

const mode = process.env.TEST_RUNTIME_CACHE_MODE || 'default'

export default defineNuxtConfig({
  modules: [NuxtOgImage],
  site: { url: 'https://example.com' },
  ogImage: {
    defaults: { component: 'Cache.satori', emojis: false },
    runtimeCacheStorage: mode === 'disabled'
      ? false
      : mode === 'named'
        ? 'custom'
        : mode === 'bounded'
          ? { driver: 'lru-cache', max: 0, maxSize: 1024 * 1024 }
          : true,
    security: { secret: false },
  },
  nitro: {
    storage: mode === 'nested'
      ? { 'cache': { driver: 'memory' }, 'cache:nuxt-og-image': { driver: 'lru-cache', max: 0, maxSize: 1024 * 1024 } }
      : mode === 'configured'
        ? { cache: { driver: 'memory' } }
        : {},
  },
  devtools: { enabled: false },
  compatibilityDate: '2026-10-08',
})
