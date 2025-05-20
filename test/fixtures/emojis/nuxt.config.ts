import NuxtOgImage from '../../../src/module'
export default defineNuxtConfig({
  modules: [NuxtOgImage],
  ogImage: {
    debug: true,
    defaults: {
      emojis: 'noto',
    },
  },
})
