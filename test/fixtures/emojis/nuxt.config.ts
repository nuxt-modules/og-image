import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [NuxtOgImage],
  ogImage: {
    debug: true,
    emojiStrategy: 'local',
    defaults: {
      emojis: 'noto',
    },
  },
})
