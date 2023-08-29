import { resolve } from 'node:path'

export default defineNuxtConfig({
  modules: [
    '@nuxt/devtools-ui-kit',
    'nuxt-icon',
  ],
  ssr: false,
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
  },
})
