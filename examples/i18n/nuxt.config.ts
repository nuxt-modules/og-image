import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['nuxt-og-image', '@nuxt/fonts', '@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  imports: {
    autoImport: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: {
    families: [
      { name: 'Nunito', global: true },
      { name: 'Noto Sans JP', global: true },
      { name: 'Noto Sans KR', global: true },
    ],
  },

  site: {
    url: 'https://example.com',
    name: 'My Website',
  },

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'ja', name: '日本語', file: 'ja.json' },
      { code: 'ko', name: '한국어', file: 'ko.json' },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
  },

  compatibilityDate: '2025-01-01',
})
