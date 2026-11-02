import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  runtimeConfig: {
    appSecret: 'fixture-app-secret-with-at-least-32-characters',
  },
  modules: [
    NuxtOgImage,
  ],
  ogImage: {
    componentDirs: ['OgImage'],
  },
  nitro: {
    prerender: {
      routes: ['/invite/GR8F'],
    },
  },
  site: {
    url: 'https://example.com',
  },
  compatibilityDate: '2025-01-13',
})
