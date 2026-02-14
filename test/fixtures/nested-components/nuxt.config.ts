import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxtjs/tailwindcss',
  ],
  css: ['~/assets/css/main.css'],
  ogImage: {
    debug: true,
  },
  site: {
    url: 'https://example.com',
  },
  devtools: { enabled: false },
})
