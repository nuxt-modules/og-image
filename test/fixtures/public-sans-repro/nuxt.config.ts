import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxt/fonts',
    '@nuxt/ui',
  ],
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Public Sans', weights: [400, 500, 600, 700, 800, 900], global: true },
    ],
  },
  ogImage: {
    debug: true,
  },
  nitro: {
    prerender: {
      routes: ['/'],
    },
  },
  site: {
    url: 'https://example.com',
  },
  compatibilityDate: '2024-11-01',
})
