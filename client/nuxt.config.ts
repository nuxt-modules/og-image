import DevtoolsUIKit from '@nuxt/devtools-ui-kit'
import { resolve } from 'pathe'

export default defineNuxtConfig({
  ssr: false,

  modules: [
    DevtoolsUIKit,
  ],

  devtools: {
    enabled: false,
  },

  nitro: {
    prerender: {
      routes: [
        '/',
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
