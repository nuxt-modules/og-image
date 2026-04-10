import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../.base'],
  modules: [
    NuxtOgImage,
    '@nuxtjs/i18n',
  ],
  hooks: {
    // Workaround: unimport's regex-based declaration scan (unimport@6) fails on
    // `for (const [a, b] of ...)` patterns and starts swallowing code, so it
    // misses the `var getCookieLocale` declaration emitted inside the Vite SSR
    // chunks produced for @nuxtjs/i18n and injects a duplicate import, breaking
    // the Nitro bundle. Exclude the Vite-built server chunks from unimport —
    // they are already bundled and do not need auto-import injection.
    'nitro:init': (nitro) => {
      nitro.options.imports ||= { exclude: [] }
      nitro.options.imports.exclude ||= []
      nitro.options.imports.exclude.push(/[/\\]dist[/\\]server[/\\]_nuxt[/\\]/)
    },
  },
  site: {
    url: 'https://nuxtseo.com',
  },
  ogImage: {
    debug: true,
  },
  // @ts-expect-error untyped
  i18n: {
    defaultLocale: 'en',
    langDir: 'locales',
    locales: [
      {
        code: 'en',
        language: 'en-US',
        file: 'en.ts',
      },
      {
        code: 'es',
        language: 'es-ES',
        file: 'es.ts',
      },
      {
        code: 'fr',
        language: 'fr-FR',
        file: 'fr.ts',
      },
    ],
  },
  devtools: { enabled: false },
})
