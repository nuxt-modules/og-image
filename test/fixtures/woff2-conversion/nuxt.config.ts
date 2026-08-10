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
        name: 'Lobster',
        weights: [400],
        styles: ['normal'],
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
