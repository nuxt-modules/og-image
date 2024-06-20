import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  srcDir: 'app/',
  ogImage: {
    debug: true,
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
