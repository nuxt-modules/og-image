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
    // fixes shiki bug
    define: {
      'process.env.VSCODE_TEXTMATE_DEBUG': 'false',
    },
    build: {
      target: 'esnext',
    },
  },
})
