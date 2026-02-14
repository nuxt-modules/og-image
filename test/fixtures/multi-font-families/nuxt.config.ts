import tailwindcss from '@tailwindcss/vite'
import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// Tests: multiple font families with per-component font detection.
// Each OG image component uses a different font-family class,
// and the module should only load the fonts actually used by each component.
export default defineNuxtConfig({
  extends: ['../.base'],

  modules: [
    '@nuxt/fonts',
    NuxtOgImage,
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: {
    families: [
      { name: 'Lobster', weights: [400], global: true },
      { name: 'JetBrains Mono', weights: [400, 700], global: true },
      { name: 'Playfair Display', weights: [400, 700], global: true },
      // Variable font — declares weight range, og-image should download 400 + 700 static alternatives
      { name: 'Nunito Sans', global: true },
      // Local font via @nuxt/fonts — provider: 'none' skips provider resolution, uses src directly
      { name: 'LocalSerif', src: '/fonts/LocalSerif-Regular.ttf', provider: 'none', global: true },
    ],
  },

  css: ['~/assets/css/main.css'],

  ogImage: {
    debug: true,
  },

  site: {
    url: 'https://example.com',
  },

  compatibilityDate: '2025-01-13',
})
