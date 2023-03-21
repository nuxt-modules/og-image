import { resolve } from 'pathe'
import { defineNuxtConfig } from 'nuxt/config'
import { extendUnocssOptions } from '@nuxt/devtools-ui-kit-edge/unocss'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    resolve(__dirname, '../src/module'),
    // '@nuxt/devtools-edge',
    function(options, nuxt) {
      nuxt.hook('components:extend', (components) => {
        const index = components.findIndex(c => c.name === 'NuxtWelcome')
        components[index].mode = 'client'
      })
    }
  ],
  unocss: extendUnocssOptions({}),
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/browser/component',
        '/browser/custom',
        '/satori/static',
        '/satori/image',
      ],
      ignore: [
        '/not-prerendered/'
      ]
    }
  },

  ogImage: {
    host: 'https://nuxt-og-image-playground.vercel.app',
    playground: true,
    defaults: {
      // component: 'BannerTemplate',
      appName: 'My App',
    }
  },

  hooks: {
    'og-image:prerenderScreenshots'(queue) {
      queue.push({
        route: '/not-prerendered/',
      })
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
