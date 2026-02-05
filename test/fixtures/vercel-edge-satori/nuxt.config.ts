import NuxtOgImage from '../../../src/module'

// Tests satori renderer on Vercel Edge Functions runtime
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
    preset: 'vercel-edge',
    prerender: {
      failOnError: false,
      routes: [
        '/',
      ],
    },
  },

  // Use satori-legacy (0.15.x) for cloudflare tests - 0.16+ blocked by Workers
  alias: { satori: 'satori-legacy' },

  devtools: { enabled: false },
  compatibilityDate: '2026-01-27',
})
