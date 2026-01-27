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

  devtools: { enabled: false },
  compatibilityDate: '2026-01-27',
})
