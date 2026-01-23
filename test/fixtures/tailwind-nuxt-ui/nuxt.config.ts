import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    '@nuxt/ui',
    NuxtOgImage,
  ],

  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      {
        name: 'Inter',
        global: true,
        weights: [400, 700],
      },
    ],
  },

  ogImage: {
    defaults: {
      component: 'NuxtUiTest',
    },
    tailwindCss: '~/assets/css/main.css',
  },

  devtools: { enabled: false },
  compatibilityDate: '2025-01-13',
})
