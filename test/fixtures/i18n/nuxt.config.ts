import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
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
  i18n: {
    baseUrl: 'https://nuxtseo.com',
    detectBrowserLanguage: false,
    defaultLocale: 'en',
    langDir: 'locales',
    strategy: 'prefix',
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        file: 'en',
      },
      {
        code: 'es',
        iso: 'es-ES',
        file: 'en',
      },
      {
        code: 'fr',
        iso: 'fr-FR',
        file: 'fr',
      },
    ],
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
