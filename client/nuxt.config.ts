import { resolve } from 'path'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-icon',
  ],
  ssr: false,
  experimental: {
    reactivityTransform: true,
  },
  nitro: {
    output: {
      publicDir: resolve(__dirname, '../dist/client'),
    },
  },
  app: {
    baseURL: '/__nuxt_og_image__/client',
  },
  vite: {
    build: {
      target: 'esnext',
    },
  },
})
