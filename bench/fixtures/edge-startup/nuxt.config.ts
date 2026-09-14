import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],
  site: {
    url: 'https://example.com',
  },
  ogImage: {
    security: {
      secret: false,
    },
  },
  nitro: {
    preset: 'netlify-edge',
  },
  devtools: {
    enabled: false,
  },
  compatibilityDate: '2026-08-11',
})
