import type { NitroRouteConfig, NitroRouteRules } from 'nitro/types'
import { getRouteRules } from 'nitro/app'
import { defineEventHandler } from 'nuxt/server'

const routeConfig = {
  ogImage: { width: 640, height: 320, props: { title: 'Route rule title' } },
} satisfies NitroRouteConfig

export default defineEventHandler((event) => {
  const routeRules = {
    ogImage: getRouteRules(event.req.method, event.url.pathname).routeRules.ogImage,
  } satisfies NitroRouteRules
  return {
    config: routeConfig.ogImage,
    resolved: routeRules.ogImage,
  }
})
