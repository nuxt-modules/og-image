import NuxtOgImage from '../../../src/module'

// Tests satori renderer with WASM bindings on Cloudflare Workers
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    '@nuxt/fonts',
    NuxtOgImage,
  ],

  site: {
    url: 'https://example.com',
  },

  fonts: {
    families: [
      { name: 'Hubot Sans', stretch: '75% 125%', global: true },
      { name: 'Nunito Sans' },
    ],
  },

  ogImage: {
    debug: true,
    defaults: {
      renderer: 'satori',
    },
  },

  nitro: {
    preset: 'cloudflare-module',
    prerender: {
      failOnError: false,
      routes: [
        '/',
      ],
    },
  },

  // Use satori-legacy (0.15.x) for cloudflare tests - 0.16+ blocked by Workers
  alias: { satori: 'satori-legacy' },

  devtools: { enabled: false },
  compatibilityDate: '2024-09-19',
})
