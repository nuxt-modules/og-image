import type { H3Event } from 'h3'
import type { NitroRouteRules } from 'nitropack'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import { useRuntimeConfig } from '#imports'
import { defu } from 'defu'
import { hash } from 'ohash'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { withoutBase, withoutTrailingSlash } from 'ufo'

export function fetchIsland(e: H3Event, component: string, props: Record<string, any>): Promise<NuxtIslandResponse> {
  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([component, props]).replaceAll('_', '-')
  return e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(props),
    },
  })
}

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function createNitroRouteRuleMatcher() : ((path: string) => NitroRouteRules) {
  const { nitro, app } = useRuntimeConfig()
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({
      routes: Object.fromEntries(
        Object.entries(nitro?.routeRules || {})
          .map(([path, rules]) => [withoutTrailingSlash(path), rules]),
      ),
    }),
  )
  return (path: string) => {
    return defu({}, ..._routeRulesMatcher.matchAll(
      // radix3 does not support trailing slashes
      withoutBase(withoutTrailingSlash(withoutQuery(path)), app.baseURL),
    ).reverse()) as NitroRouteRules
  }
}
