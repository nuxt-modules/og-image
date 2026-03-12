import tailwindcss from '@tailwindcss/vite'
import NuxtOgImage from '../../../src/module'

// Tests satori renderer on Netlify with local fonts from public/
export default defineNuxtConfig({
  extends: ['../.base'],

  modules: [
    NuxtOgImage,
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  css: ['~/assets/css/main.css'],

  ogImage: {
    debug: true,
    defaults: {
      renderer: 'satori',
    },
  },

  nitro: {
    preset: 'netlify',
    prerender: {
      failOnError: false,
      routes: [
        '/',
      ],
    },
  },

  site: {
    url: 'https://example.com',
  },

  devtools: { enabled: false },
  compatibilityDate: '2024-09-19',
})
