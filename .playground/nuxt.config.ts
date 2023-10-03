import { defineNuxtConfig } from 'nuxt/config'
import { extendUnocssOptions } from '@nuxt/devtools-ui-kit/unocss'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@nuxthq/ui',
    'nuxt-icon',
    NuxtOgImage,
    // '@nuxt/devtools-edge',
    function (options, nuxt) {
      nuxt.hook('components:extend', (components) => {
        const index = components.findIndex(c => c.name === 'NuxtWelcome')
        components[index].mode = 'client'
      })
    },
  ],
  components: [
    {
      path: '~/components',
      pathPrefix: false, // <-- this
    },
  ],
  unocss: extendUnocssOptions({}),
  nitro: {
    prerender: {
      routes: [
        '/browser/component',
        '/browser/delayed',
        '/browser/screenshot',
        '/search?foo=bar',
        '/search?foo=2',
      ],
      ignore: [
        '/not-prerendered',
      ],
    },
  },

  debug: false,

  // hooks: {
  //   'og-image:prerenderScreenshots'(queue) {
  //     queue.push({
  //       route: '/not-prerendered',
  //     })
  //   }
  // },

  devtools: true,

  ogImage: {
    fonts: [
      'Inter:400',
      'Inter:700',
      {
        name: 'optieinstein',
        weight: 800,
        path: '/OPTIEinstein-Black.otf',
      },
    ],
    playground: true,
    runtimeBrowser: true,
    runtimeCacheStorage: false,
    defaults: {
      // component: 'BannerTemplate',
      appName: 'My App',
    },
    debug: true,
  },

  site: {
    name: 'OG Image Playground',
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
    },
  },

  routeRules: {
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
})
