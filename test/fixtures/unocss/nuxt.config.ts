import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
    '@unocss/nuxt',
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  devtools: { enabled: false },
})
