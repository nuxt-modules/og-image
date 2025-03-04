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
        language: 'en-US',
        file: 'en',
      },
      {
        code: 'es',
        language: 'es-ES',
        file: 'en',
      },
      {
        code: 'fr',
        language: 'fr-FR',
        file: 'fr',
      },
    ],
  },
  devtools: { enabled: false },
})
