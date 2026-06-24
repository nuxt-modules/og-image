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
    // Signing is on by default; this test rewrites the static og:image URL to an
    // unsigned /_og/d/ request. Disable signing here (covered elsewhere).
    security: {
      secret: false,
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
