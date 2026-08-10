import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// Takumi-only fixture exercising Nuxt Fonts WOFF2 subsets directly.
// Intentionally NOT extending ../.base — that fixture ships OgImageCommunity satori+takumi
// templates which would leak satori into detectedRenderers and trigger the satori-gated
// convertWoff2ToTtf path, hiding the regression we want to exercise here.
export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    NuxtOgImage,
  ],

  fonts: {
    families: [
      { name: 'Poppins', weights: [400, 700], global: true },
      { name: 'Noto Sans Devanagari', weights: [400, 700], global: true },
    ],
  },

  ogImage: {
    debug: true,
    // Exclude the bundled OgImageCommunity templates so only takumi components are present —
    // otherwise community satori templates trick the module into thinking satori is in use.
    componentDirs: ['OgImage'],
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2025-01-13',
})
