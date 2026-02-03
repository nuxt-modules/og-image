import Module from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],

  modules: [
    Module,
  ],

  fonts: {
    // Use a Google font that will be served as WOFF2
    families: [
      {
        name: 'Roboto',
        weights: [400, 700],
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
