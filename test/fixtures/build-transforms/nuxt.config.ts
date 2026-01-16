import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
  ],
  ogImage: {
    defaults: {
      emojis: 'noto',
    },
  },
  site: {
    url: 'https://example.com',
  },
})
