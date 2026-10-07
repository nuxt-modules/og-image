import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  site: { url: 'https://nuxtseo.com' },
  ogImage: { browser: process.env.TEST_BROWSER_OPT_IN !== 'false', security: { secret: false } },
  nitro: {
    logLevel: 3,
    prerender: { routes: ['/'] },
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
