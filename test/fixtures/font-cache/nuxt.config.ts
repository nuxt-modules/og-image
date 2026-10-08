import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    NuxtOgImage,
    async (_, nuxt) => {
      const url = '/_fonts/cached.ttf'
      const path = fileURLToPath(new URL('../../../src/runtime/public/_og-fonts/inter-400-latin.ttf', import.meta.url))
      await nuxt.callHook('fonts:resolved', {
        fontFamily: 'Inter',
        fonts: [{ src: [{ url }], weight: '400', style: 'normal' }],
        files: [{ url, readFont: () => readFile(path) }],
      })
    },
  ],
  fonts: { providers: { google: false, bunny: false, fontshare: false, fontsource: false, adobe: false } },
  site: { url: 'https://example.com' },
  ogImage: { componentDirs: [] },
  nitro: { prerender: { routes: ['/api/font'] } },
  compatibilityDate: '2025-01-13',
})
