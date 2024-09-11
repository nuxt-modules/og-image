import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
    '@nuxt/content',
  ],

  site: {
    url: 'https://nuxtseo.com',
  },

  ogImage: {
    debug: true,
  },

  devtools: { enabled: true },
  debug: process.env.NODE_ENV === 'test',
  compatibilityDate: '2024-09-11',
})
