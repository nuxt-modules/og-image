import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
    '@nuxtjs/tailwindcss',
  ],
  tailwindcss: {
    exposeConfig: true,
  },
  site: {
    url: 'https://nuxtseo.com',
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
