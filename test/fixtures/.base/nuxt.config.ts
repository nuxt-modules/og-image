export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
  ],

  fonts: {
    families: [
      {
        name: 'Inter',
        global: true,
        weights: [400, 700],
      },
    ],
  },
})
