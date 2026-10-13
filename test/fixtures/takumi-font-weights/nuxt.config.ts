import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// A Google font at two weights that only OG images use, so og-image resolves it
// itself. The runtime renders with Takumi's WASM build, which rejects WOFF.
export default defineNuxtConfig({
  runtimeConfig: {
    appSecret: 'fixture-app-secret-with-at-least-32-characters',
  },
  modules: [
    '@nuxt/fonts',
    NuxtOgImage,
  ],

  fonts: {
    families: [
      { name: 'Poppins', weights: [400, 700] },
    ],
  },

  ogImage: {
    // Bundled community templates would add Satori to the detected renderers.
    componentDirs: ['OgImage'],
    compatibility: {
      runtime: { takumi: 'wasm' },
    },
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2025-01-13',
})
