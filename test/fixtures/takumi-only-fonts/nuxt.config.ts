import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// Regression: https://github.com/nuxt-modules/og-image/issues/586
// Takumi-only fixture (no satori components) exercising a non-Latin family
// (Noto Sans Devanagari) via @nuxt/fonts. Prior to the v6.2.0 regression the
// build would download static TTFs for takumi too; v6.2.0 narrowed the gate to
// satori only, leaving takumi with latin-subset WOFF2s that can't render devanagari.
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
