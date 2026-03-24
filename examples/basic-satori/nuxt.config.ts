import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['nuxt-og-image', '@nuxt/fonts'],

  css: ['~/assets/css/main.css'],

  imports: {
    autoImport: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: {
    families: [
      { name: 'Inter', global: true },
    ],
  },

  site: {
    url: 'https://example.com',
    name: 'My Website',
  },

  compatibilityDate: '2025-01-01',
})
