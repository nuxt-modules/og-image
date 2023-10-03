import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],
  nitro: {
    storage: {
      'og-image': {
        driver: 'cloudflare-kv-binding',
        binding: 'OGIMAGE',
      },
    },
    prerender: {
      ignore: [
        '/not-prerendered',
      ],
    },
  },

  ogImage: {
    playground: true,
    runtimeBrowser: false,
    runtimeCacheStorage: false,
    defaults: {
      // component: 'BannerTemplate',
      appName: 'My App',
    },
    debug: true,
  },

})
