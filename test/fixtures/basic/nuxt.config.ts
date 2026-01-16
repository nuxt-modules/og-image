import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
  ],

  site: {
    url: 'https://nuxtseo.com',
  },

  ogImage: {
    debug: true,
  },

  routeRules: {
    '/satori/route-rules/**': {
      ogImage: {
        props: {
          title: 'Hello from route rules',
        },
      },
    },
  },

  experimental: {
    inlineRouteRules: true,
  },

  nitro: {
    compressPublicAssets: true,
    prerender: {
      failOnError: false,
      routes: [
        '/',
        '/satori/',
        '/satori/image',
        '/satori/png',
        '/satori/custom-font',
        '/satori/multi-image',
      ],
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2024-07-13',
})
