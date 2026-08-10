import Module from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],

  modules: [
    '@nuxt/fonts',
    Module,
  ],

  fonts: {
    families: [
      {
        name: 'Noto Sans SC',
        src: '/fonts/noto-sans-sc-100-400-normal.woff2',
        weight: 400,
        style: 'normal',
        global: true,
      },
    ],
  },

  ogImage: {
    debug: true,
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2024-11-01',
})
