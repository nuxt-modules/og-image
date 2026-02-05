import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base', './base-layer'],
  modules: [
    NuxtOgImage,
  ],

  site: {
    url: 'https://example.com',
  },

  ogImage: {
    debug: true,
  },

  nitro: {
    prerender: {
      failOnError: false,
      routes: [
        '/',
        '/layer-template',
        '/app-template',
      ],
    },
  },

  compatibilityDate: '2024-07-13',
})
