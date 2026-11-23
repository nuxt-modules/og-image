import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  // Prerendered images and videos move to this host. Runtime URLs stay on the site.
  app: { cdnURL: 'https://cdn.example.com' },
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
