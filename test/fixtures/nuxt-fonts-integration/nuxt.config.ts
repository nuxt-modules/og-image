import Module from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],

  modules: [
    Module,
  ],

  fonts: {
    families: [
      {
        name: 'Roboto',
        weights: [400, 500],
        styles: ['normal'],
        global: true,
      },
    ],
  },

  ogImage: {
    debug: true,
    defaults: {
      component: 'NuxtSeo',
    },
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2024-11-01',
})
