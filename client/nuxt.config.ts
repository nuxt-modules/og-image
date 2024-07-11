import { resolve } from 'pathe'
import DevtoolsUIKit from '@nuxt/devtools-ui-kit'

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
})
