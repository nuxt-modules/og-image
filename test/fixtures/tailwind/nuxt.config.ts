import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxtjs/tailwindcss',
  ],
  css: ['~/assets/css/main.css'],
  ogImage: {
    debug: true,
  },
  site: {
    url: 'https://nuxtseo.com',
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
