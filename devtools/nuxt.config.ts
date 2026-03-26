import { resolve } from 'pathe'

export default defineNuxtConfig({
  extends: ['nuxtseo-layer-devtools'],

  ogImage: false,

  imports: {
    autoImport: true,
  },

  nitro: {
    prerender: {
      routes: ['/', '/templates', '/debug', '/docs'],
    },
    output: {
      publicDir: resolve(__dirname, '../dist/devtools'),
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vueuse/core',
      ],
    },
  },

  app: {
    baseURL: '/__nuxt-og-image',
  },
})
