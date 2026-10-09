import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import { join } from 'pathe'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  runtimeConfig: {
    appSecret: 'fixture-app-secret-with-at-least-32-characters',
  },
  modules: [
    NuxtOgImage,
    async (_, nuxt) => {
      const cacheDir = join(nuxt.options.buildDir, 'cache', 'fonts')
      await mkdir(cacheDir, { recursive: true })
      await copyFile(
        fileURLToPath(new URL('../../../src/runtime/public/_og-fonts/inter-400-latin.ttf', import.meta.url)),
        join(cacheDir, 'cached.ttf'),
      )
    },
  ],
  site: { url: 'https://example.com' },
  ogImage: { componentDirs: [] },
  nitro: { prerender: { routes: ['/api/font'] } },
  compatibilityDate: '2025-01-13',
})
