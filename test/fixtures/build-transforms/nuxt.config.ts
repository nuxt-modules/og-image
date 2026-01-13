import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
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
