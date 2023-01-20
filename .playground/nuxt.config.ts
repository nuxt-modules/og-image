import { resolve } from 'pathe'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  alias: {
    'nuxt-og-image': resolve(__dirname, '../src/module'),
  },
  modules: [
    '@nuxt/ui',
    'nuxt-og-image',
  ],
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
      ]
    }
  },

  ogImage: {
    host: 'https://example.com',
    fonts: ['Sofia+Sans:400', 'Sofia+Sans:700'],
    defaults: {
      component: 'BannerTemplate',
      appName: 'My App',
    }
  },

  experimental: {
    componentIslands: true,
  },

  app: {
    head: {
      style: [
        {
          innerHTML: 'body { font-family: \'Inter\', sans-serif; }',
        },
      ],
      link: [
        {
          // reset css to match svg output
          href: 'https://cdn.jsdelivr.net/npm/gardevoir',
          rel: 'stylesheet',
        },
        {
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
          rel: 'stylesheet',
        },
      ],
    }
  },

  routeRules: {
    '/static': {
      ogImage: {
        width: 1200,
        height: 1200
      }
    }
  }
})
