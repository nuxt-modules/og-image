import NuxtOgImage from '../../../src/module'

// Tests takumi renderer with WASM bindings on Cloudflare Workers
export default defineNuxtConfig({
  extends: ['../.base'],
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
  compatibilityDate: '2026-01-01',
})
