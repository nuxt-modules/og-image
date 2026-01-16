import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  ogImage: {
    debug: true,
    emojiStrategy: 'local',
    defaults: {
      emojis: 'noto',
    },
  },
})
