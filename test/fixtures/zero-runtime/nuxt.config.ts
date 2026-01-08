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
    zeroRuntime: true,
    sharpOptions: true,
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
      routes: [
        '/',
        '/png',
        '/font',
      ],
    },
  },

  devtools: { enabled: false },
  compatibilityDate: '2024-07-13',
})
