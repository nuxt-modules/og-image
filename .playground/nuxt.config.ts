import { defineNuxtConfig } from 'nuxt/config'
import { extendUnocssOptions } from '@nuxt/devtools-ui-kit/unocss'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    NuxtOgImage,
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
      ignore: [
        '/not-prerendered'
      ]
    }
  },

  // hooks: {
  //   'og-image:prerenderScreenshots'(queue) {
  //     queue.push({
  //       route: '/not-prerendered',
  //     })
  //   }
  // },


  ogImage: {
    fonts: [
      'Inter:400',
      'Inter:700',
      {
        name: 'optieinstein',
        weight: 800,
        path: '/OPTIEinstein-Black.otf',
      }
    ],
    playground: true,
    runtimeCacheStorage: false,
    defaults: {
      // component: 'BannerTemplate',
      appName: 'My App',
    },
    debug: true,
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
