import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  modules: [
    NuxtOgImage,
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxt/fonts',
  ],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  nitro: {
    plugins: ['plugins/hooks.ts'],
    prerender: {
      routes: [
        '/multiple',
        '/satori/jpeg',
        '/chromium/component',
        '/chromium/delayed',
        '/chromium/screenshot',
        '/search?foo=bar',
        '/search?foo=2',
        '/satori/image',
        '/prebuilt',
        '/virtual-image',
        '/templates',
        '/templates/nuxt-seo',
        '/templates/nuxt',
        '/templates/with-emoji',
        '/templates/simple-blog',
        '/templates/frame',
        '/templates/pergel',
        '/templates/un-js',
        '/templates/brutalist',
        '/takumi',
        '/takumi/blog-post',
        '/takumi/docs',
        '/takumi/nuxt-seo',
        '/takumi/product-card',
      ],
      ignore: [
        '/not-prerendered',
      ],
    },
  },

  devtools: {
    enabled: true,
  },

  fonts: {
    families: [
      { global: true, name: 'Hubot Sans', stretch: '75% 125%' },
    ],
  },

  ogImage: {
    debug: true,
  },

  site: {
    url: 'https://nuxtseo.com',
    name: 'OG Image Playground',
  },

  experimental: {
    inlineRouteRules: true,
    componentIslands: true,
  },

  routeRules: {
    '/': {
      prerender: true,
    },
    '/satori/static': {
      ogImage: {
        icon: 'carbon:image-search',
        description: 'set via route rules!',
      },
    },
    '/satori/route-rules/**': {
      site: {
        name: 'nuxt-og-image-route-rules',
      },
      ogImage: {
        icon: 'carbon:image-search',
        title: 'set via route rules!',
      },
    },
  },
  compatibilityDate: '2024-07-03',
})
