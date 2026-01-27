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
    failOnError: false,
    preset: 'cloudflare-module',
    prerender: {
      routes: [
        '/',
      ],
    },
  },

  // Use satori-legacy (0.15.x) for cloudflare tests - 0.16+ blocked by Workers
  alias: { satori: 'satori-legacy' },

  devtools: { enabled: false },
  compatibilityDate: '2026-01-01',
})
