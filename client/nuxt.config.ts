import { resolve } from 'pathe'

export default defineNuxtConfig({
  extends: ['nuxtseo-shared/layer-devtools'],

  ogImage: false,

  nitro: {
    prerender: {
      routes: ['/', '/templates', '/debug', '/docs'],
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
})
