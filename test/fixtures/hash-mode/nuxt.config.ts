import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  site: { url: 'https://nuxtseo.com' },
  ogImage: { security: { secret: false } },
  routeRules: {
    '/card/rule': { ogImage: { props: { title: 'From route rule' } } },
  },
  nitro: {
    prerender: {
      // Builds stub playwright-core, so the screenshots fail to render.
      // The test only checks which URL each page gets.
      failOnError: false,
      routes: ['/shot/alpha', '/shot/bravo', '/card/one', '/card/two', '/card/rule'],
    },
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
