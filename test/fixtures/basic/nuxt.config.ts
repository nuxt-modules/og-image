import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: [
    NuxtOgImage,
  ],
  site: {
    url: 'https://nuxtseo.com',
  },
  ogImage: {
    debug: true,
    runtimeBrowser: true,
  },
  nitro: {
    wasm: {
      esmImport: true,
    },
    rollupConfig: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  routeRules: {
    '/satori/route-rules/**': {
      ogImage: {
        title: 'Hello from route rules',
      },
    },
  },
  experimental: {
    inlineRouteRules: true,
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
