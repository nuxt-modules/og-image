import NuxtOgImage from 'nuxt-og-image'

export default defineNuxtConfig({
  modules: [NuxtOgImage],
  ogImage: {
    debug: true,
    security: {
      secret: false,
    },
  },
  site: {
    name: 'Nuxt 5 OG Image',
    url: 'https://og-image.example.com',
  },
  devtools: { enabled: false },
  compatibilityDate: '2026-06-10',
})
