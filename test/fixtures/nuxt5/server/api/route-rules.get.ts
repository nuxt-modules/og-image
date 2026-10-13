import type { OgImageOptions } from 'nuxt-og-image'
import type { AppRouteRules } from 'nuxt/server'
import { defineEventHandler, getRouteRules } from 'nuxt/server'

const routeConfig = {
  ogImage: { width: 640, height: 320, props: { title: 'Route rule title' } },
} satisfies AppRouteRules

export default defineEventHandler((event) => {
  const ogImage: OgImageOptions | false | undefined = getRouteRules(event).ogImage
  return {
    config: routeConfig.ogImage,
    resolved: ogImage,
  }
})
