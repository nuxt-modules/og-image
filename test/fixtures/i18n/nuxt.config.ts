import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxtjs/i18n',
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  ogImage: {
    debug: true,
  },
  // @ts-expect-error untyped
  i18n: {
    defaultLocale: 'en',
    langDir: 'locales',
    locales: [
      {
        code: 'en',
        language: 'en-US',
        file: 'en.ts',
      },
      {
        code: 'es',
        language: 'es-ES',
        file: 'es.ts',
      },
      {
        code: 'fr',
        language: 'fr-FR',
        file: 'fr.ts',
      },
    ],
  },
  devtools: { enabled: false },
})
