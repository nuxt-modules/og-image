import { defineNuxtConfig } from 'nuxt/config'
import NuxtOgImage from '../../../src/module'

// Dev fixture with no app templates, so a page asking for a community template
// resolves to the module's copy. The test deletes components/ after each run.
export default defineNuxtConfig({
  modules: [NuxtOgImage],
  site: { url: 'https://example.com' },
  devtools: { enabled: false },
  compatibilityDate: '2025-01-13',
})
