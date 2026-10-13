import NuxtOgImage from 'nuxt-og-image'
import NuxtSiteConfig from 'nuxt-site-config'

export default defineNuxtConfig({
  workspaceDir: import.meta.dirname,
  vite: { resolve: { dedupe: ['nuxt', 'vue', 'vue-router'] } },
  modules: [NuxtSiteConfig, NuxtOgImage],
  ogImage: {
    enabled: process.env.NUXT_TEST_OG_DISABLED === '1' ? false : undefined,
    debug: true,
    security: {
      secret: false,
    },
  },
  site: {
    name: 'Nuxt 5 OG Image',
    url: 'https://og-image.example.com',
  },
  routeRules: {
    '/api/route-rules': {
      ogImage: { width: 640, height: 320, props: { title: 'Route rule title' } },
    },
    '/disabled': {
      ogImage: false,
    },
  },
  devtools: { enabled: false },
  compatibilityDate: '2026-06-10',
})
