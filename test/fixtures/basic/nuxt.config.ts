import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  ogImage: {
    debug: true,
  },
  debug: process.env.NODE_ENV === 'test',
})
