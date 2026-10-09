import { join } from 'node:path'
import NuxtOgImage from '../../../src/module'

export default defineNuxtConfig({
  modules: [NuxtOgImage],
  site: { url: 'https://example.com' },
  ogImage: {
    browser: true,
    publish: { storage: process.env.OG_IMAGE_TEST_MISSING_MOUNT ? 'missing' : 'og-public', baseURL: 'https://files.example.com/og' },
    security: { secret: false },
  },
  nitro: {
    storage: {
      'og-public': { driver: 'fs', base: join(import.meta.dirname, '.data/published') },
    },
    prerender: { routes: ['/', '/multiple', '/missing', ...(process.env.HAS_CHROME ? ['/screenshot'] : [])], failOnError: true },
  },
  compatibilityDate: '2026-10-01',
})
