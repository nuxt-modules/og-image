import { defineEventHandler } from 'nuxt/server'
import { getOgImageUrl } from '#og-image/server'
import { getOgImageUrl as getNestedOgImageUrl } from '#og-image/server/nitro'

export default defineEventHandler(event => ({
  url: getOgImageUrl(event, '/'),
  nestedUrl: getNestedOgImageUrl(event, '/'),
  currentUrl: getOgImageUrl(event),
}))
