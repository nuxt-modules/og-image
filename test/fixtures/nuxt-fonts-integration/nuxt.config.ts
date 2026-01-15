import Module from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    Module,
  ],

  fonts: {
    families: [
      {
        name: 'Inter',
        weights: [400, 700],
        styles: ['normal'],
      },
      {
        name: 'Roboto',
        weights: [400, 500],
        styles: ['normal'],
      },
    ],
  },

  ogImage: {
    defaults: {
      component: 'NuxtSeo',
    },
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2024-11-01',
})
