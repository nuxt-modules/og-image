import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [NuxtOgImage, '@unocss/nuxt', '@nuxt/fonts'],
  compatibilityDate: '2025-06-09',
  runtimeConfig: {
    appSecret: 'fixture-app-secret-with-at-least-32-characters',
  },
  site: {
    url: 'https://example.com',
  },
  unocss: {
    disableNuxtInlineStyle: false,
  },
  fonts: {
    local: { dirs: [fileURLToPath(new URL('./fonts', import.meta.url))] },
    families: [{ name: 'Barlow', weights: [400], preload: true, provider: 'local' }],
  },
  ogImage: {
    componentDirs: ['OgImage'],
  },
})
