import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const layerDir = resolve(dirname(fileURLToPath(import.meta.resolve('nuxtseo-shared'))), 'layer-devtools')

export default defineNuxtConfig({
  extends: [layerDir],

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
