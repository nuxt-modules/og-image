import { resolve } from 'node:path'
import { startSubprocess } from '@nuxt/devtools-kit'
import { defineNuxtModule } from '@nuxt/kit'
import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../src/module'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/content',
    NuxtOgImage,
    /**
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
  ],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  nitro: {
    preset: 'cloudflare_pages',
    plugins: ['plugins/hooks.ts'],
    prerender: {
      routes: [
        '/satori/jpeg',
        '/chromium/component',
        '/chromium/delayed',
        '/chromium/screenshot',
        '/search?foo=bar',
        '/search?foo=2',
        '/satori/image',
        '/prebuilt',
        '/virtual-image',
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

  ogImage: {
    fonts: [
      {
        name: 'optieinstein',
        weight: 800,
        // path must point to a public font file
        path: '/OPTIEinstein-Black.otf',
      },
    ],
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
