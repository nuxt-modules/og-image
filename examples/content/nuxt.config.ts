import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['nuxt-og-image', '@nuxt/fonts', '@nuxt/content'],

  css: ['~/assets/css/main.css'],

  imports: {
    autoImport: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: {
    families: [
      { name: 'DM Sans', global: true },
    ],
  },

  site: {
    url: 'https://example.com',
    name: 'My Blog',
  },

  compatibilityDate: '2025-01-01',
})
