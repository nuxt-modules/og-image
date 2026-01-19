import DevtoolsUIKit from '@nuxt/devtools-ui-kit'
import { resolve } from 'pathe'

export default defineNuxtConfig({
  ssr: false,

  modules: [
    DevtoolsUIKit,
    '@nuxt/fonts',
  ],

  css: ['~/assets/css/global.css'],

  fonts: {
    families: [
      { name: 'Hubot Sans', provider: 'local', weight: [200, 900], stretch: '75% 125%' },
    ],
  },

  devtools: {
    enabled: false,
  },

  nitro: {
    prerender: {
      routes: [
        '/',
        '/templates',
        '/debug',
        '/docs',
      ],
    },
    output: {
      publicDir: resolve(__dirname, '../dist/client'),
    },
  },

  app: {
    baseURL: '/__nuxt-og-image',
  },

  experimental: {
    componentIslands: true,
  },

  compatibilityDate: '2024-09-11',
})
