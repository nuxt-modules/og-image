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

  devtools: { enabled: false },
  compatibilityDate: '2024-09-19',
})
