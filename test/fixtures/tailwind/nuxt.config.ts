import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxtjs/tailwindcss',
  ],
  // @ts-expect-error untyped
  tailwindcss: {
    exposeConfig: true,
  },
  site: {
    url: 'https://nuxtseo.com',
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
