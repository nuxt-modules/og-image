// @ts-expect-error virtual module
import compatibility from '#nuxt-og-image/compatibility'
// @ts-expect-error untyped
import { componentNames } from '#nuxt-og-image/component-names.mjs'

import { defineEventHandler, setHeader } from 'h3'

import { useOgImageRuntimeConfig } from '../../shared'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useOgImageRuntimeConfig()

  return {
    componentNames,
    runtimeConfig,
    compatibility,
  }
})
