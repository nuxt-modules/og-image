import { defineEventHandler, setHeader } from 'h3'
import { componentNames } from '#og-image-virtual/component-names.mjs'
import compatibility from '#og-image/compatibility'
import { fontRequirements } from '#og-image/font-requirements'
import resolvedFonts from '#og-image/fonts'
import availableFonts from '#og-image/fonts-available'
import { getNitroOrigin } from '#site-config/server/composables'

import { getSiteConfig } from '#site-config/server/composables/getSiteConfig'
import { useOgImageRuntimeConfig } from '../utils'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useOgImageRuntimeConfig(e)
  return {
    siteConfigUrl: getSiteConfig(e as any).url,
    origin: getNitroOrigin(e),
    componentNames,
    runtimeConfig,
    compatibility,
    resolvedFonts,
    availableFonts,
    fontRequirements,
  }
})
