import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],

  site: {
    url: 'https://example.com',
  },

  ogImage: {
    debug: true,
  },

  compatibilityDate: '2024-07-13',
})
