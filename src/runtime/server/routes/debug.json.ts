import { defineEventHandler } from 'nuxt/server'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import compatibility from '#og-image/compatibility'
import { fontRequirements } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import availableFonts from '#og-image/fonts-available'

import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { getOgImageOrigin } from '../util/origin'
import { useOgImageRuntimeConfig } from '../utils'

export default defineEventHandler(async (e) => {
  // set json header
  e.res.headers.set('Content-Type', 'application/json')
  const runtimeConfig = useOgImageRuntimeConfig(e)
  return {
    siteConfigUrl: getSiteConfig(e).url,
    origin: getOgImageOrigin(e),
    componentNames,
    runtimeConfig,
    compatibility,
    resolvedFonts,
    availableFonts,
    fontRequirements,
  }
})
