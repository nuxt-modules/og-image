import { join } from 'node:path'
import NuxtOgImage from '../../../src/module'

const baseURL = process.env.OG_IMAGE_TEST_BASE_URL || '/'

export default defineNuxtConfig({
  app: { baseURL, cdnURL: 'https://assets.example.com/static/' },
  modules: [NuxtOgImage],
  site: { url: 'https://example.com' },
  ogImage: {
    browser: true,
    compatibility: { prerender: { browser: 'playwright' } },
    publish: process.env.OG_IMAGE_TEST_DISABLE_PUBLISH ? undefined : { storage: process.env.OG_IMAGE_TEST_MISSING_MOUNT ? 'missing' : 'og-public', baseURL: 'https://files.example.com/og' },
    security: { secret: false },
  },
  nitro: {
    storage: {
      'og-public': { driver: 'fs', base: join(import.meta.dirname, '.data/published') },
    },
    prerender: { routes: ['/', '/multiple', '/missing', ...(process.env.HAS_CHROME ? ['/screenshot'] : [])].map(route => `${baseURL.replace(/\/$/, '')}${route}`), failOnError: true },
  },
  compatibilityDate: '2026-10-01',
})
