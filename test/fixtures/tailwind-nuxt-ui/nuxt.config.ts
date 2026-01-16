export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-og-image',
  ],

  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      {
        name: 'Inter',
        global: true,
        weights: [400, 700],
      },
    ],
  },

  ogImage: {
    defaults: {
      component: 'NuxtUiTest',
    },
    tailwindCss: '~/assets/css/main.css',
  },

  devtools: { enabled: false },
  compatibilityDate: '2025-01-13',
})
