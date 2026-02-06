import { startSubprocess } from '@nuxt/devtools-kit'
import { defineNuxtModule } from '@nuxt/kit'
import { defineNuxtConfig } from 'nuxt/config'
import { resolve } from 'pathe'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/content',
    NuxtOgImage, /**
                  * Start a sub Nuxt Server for developing the client
                  *
                  * The terminal output can be found in the Terminals tab of the devtools.
                  */
    defineNuxtModule({
      setup(_, nuxt) {
        if (!nuxt.options.dev)
          return
        const subprocess = startSubprocess(
          {
            command: 'npx',
            args: ['nuxi', 'dev', '--port', '3030'],
            cwd: resolve(__dirname, '../client'),
          },
          {
            id: 'nuxt-og-image:client',
            name: 'Nuxt OG Image Client Dev',
          },
        )
        subprocess.getProcess().stdout?.on('data', (data) => {
          console.log(` - devtools: ${data.toString()}`)
        })
        subprocess.getProcess().stderr?.on('data', (data) => {
          console.error(` - devtools: ${data.toString()}`)
        })

        process.on('exit', () => {
          subprocess.terminate()
        })
      },
    }),
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

  debug: false,

  devtools: {
    enabled: true,
  },

  fonts: {
    families: [
      { global: true, name: 'Hubot Sans', stretch: '75% 125%' },
    ],
  },

  ogImage: {
    // fonts: [
    //   {
    //     name: 'optieinstein',
    //     weight: 800,
    //     // path must point to a public font file
    //     path: '/OPTIEinstein-Black.otf',
    //   },
    // ],
    // compatibility: {
    //   runtime: {
    //     resvg: 'wasm',
    //   },
    // },
    // defaults: {
    //   extension: 'jpeg',
    // },
    // compatibility: {
    //   dev: {
    //     chromium: false,
    //   },
    // },
    // runtimeCacheStorage: {
    //   driver: 'redis',
    //   options: {
    //     host: 'localhost',
    //     port: 6379,
    //   },
    // },
    // Enable for CI persistent caching:
    // buildCache: true,
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
