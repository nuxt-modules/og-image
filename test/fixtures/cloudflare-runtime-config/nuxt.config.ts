import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],

  ogImage: {
    defaults: {
      renderer: 'satori',
    },
  },

  nitro: {
    preset: 'cloudflare-module',
  },

  devtools: { enabled: false },
  compatibilityDate: '2024-09-19',
})
