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
        '/satori/',
        '/satori/image',
        '/satori/png',
        '/satori/custom-font',
      ],
    },
  },
  devtools: { enabled: false },
  debug: process.env.NODE_ENV === 'test',
})
