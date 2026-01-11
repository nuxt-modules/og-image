import NuxtOgImage from '../../../src/module'

// Tests takumi renderer with WASM bindings on Cloudflare Workers
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],

  site: {
    url: 'https://example.com',
  },

  ogImage: {
    debug: true,
    defaults: {
      renderer: 'takumi',
    },
  },

  nitro: {
    preset: 'cloudflare-module',
    prerender: {
      routes: [
        '/',
      ],
    },
  },

  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
