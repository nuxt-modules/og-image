import { resolve } from 'pathe'

export default defineNuxtConfig({
  ssr: false,

  modules: [
    '@nuxt/fonts',
    '@nuxt/ui',
  ],

  ogImage: false,

  css: ['~/assets/css/global.css'],

  fonts: {
    families: [
      { name: 'Hubot Sans' },
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
