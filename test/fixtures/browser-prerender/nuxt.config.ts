import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  site: { url: 'https://nuxtseo.com' },
  ogImage: { security: { secret: false } },
  nitro: {
    prerender: { routes: ['/'] },
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
