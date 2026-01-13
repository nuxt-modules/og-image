export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-og-image',
  ],

  css: ['~/assets/css/main.css'],

  ogImage: {
    defaults: {
      component: 'NuxtUiTest',
    },
    tailwindCss: '~/assets/css/main.css',
  },

  devtools: { enabled: false },
  compatibilityDate: '2025-01-13',
})
