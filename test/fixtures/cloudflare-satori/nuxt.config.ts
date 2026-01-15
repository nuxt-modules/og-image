import NuxtOgImage from '../../../src/module'

// Tests satori renderer with WASM bindings on Cloudflare Workers
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
      renderer: 'satori',
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
