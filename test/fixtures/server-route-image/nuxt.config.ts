import NuxtOgImage from '../../../src/module'

// Templates load /route-image.png, which only a Nitro server route serves.
// No public file exists, so prerender must fetch it through Nitro.
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  site: { url: 'https://example.com' },
  ogImage: {
    security: { secret: false },
  },
  nitro: {
    prerender: {
      routes: ['/takumi', '/satori'],
      failOnError: true,
    },
  },
  compatibilityDate: '2025-01-13',
})
