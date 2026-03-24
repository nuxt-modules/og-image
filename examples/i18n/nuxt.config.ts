export default defineNuxtConfig({
  modules: ['nuxt-og-image', '@nuxtjs/i18n'],

  site: {
    url: 'https://example.com',
    name: 'My Website',
  },

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'i18n/locales',
  },

  compatibilityDate: '2025-01-01',
})
