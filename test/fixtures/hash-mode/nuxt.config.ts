import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [NuxtOgImage],
  site: { url: 'https://nuxtseo.com' },
  ogImage: { browser: true, security: { secret: false } },
  routeRules: {
    '/card/rule': { ogImage: { props: { title: 'From route rule' } } },
  },
  nitro: {
    prerender: {
      // URL assertions do not require a browser binary.
      // Allow image rendering to fail on runners without one.
      failOnError: false,
      routes: ['/shot/alpha', '/shot/bravo', '/card/one', '/card/two', '/card/rule'],
    },
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
