// @ts-expect-error untyped
import { componentNames } from '#og-image-virtual/component-names.mjs'
// @ts-expect-error virtual module
import compatibility from '#og-image/compatibility'
import { useSiteConfig } from '#site-config/app/composables/useSiteConfig'

import { defineEventHandler, setHeader } from 'h3'
import { useOgImageRuntimeConfig } from '../../shared'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useOgImageRuntimeConfig()
  return {
    siteConfigUrl: useSiteConfig(e).url,
    componentNames,
    runtimeConfig,
    compatibility,
  }
})
