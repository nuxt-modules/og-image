import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],

  site: {
    url: 'https://example.com',
  },

  ogImage: {
    debug: true,
    defaults: {
      renderer: 'takumi',
    },
    // force wasm bindings for edge
    compatibility: {
      runtime: {
        takumi: 'wasm',
        resvg: 'wasm',
        satori: false,
        chromium: false,
        sharp: false,
      },
    },
  },

  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      routes: [
        '/',
      ],
    },
  },

  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
