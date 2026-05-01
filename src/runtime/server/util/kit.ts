import type { H3Event } from 'h3'
import type { NitroRouteRules } from 'nitropack'
import type { NuxtIslandResponse } from 'nuxt/app'
import { defu } from 'defu'
import { useRuntimeConfig } from 'nitropack/runtime'
import { hash } from 'ohash'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { withoutBase, withoutTrailingSlash } from 'ufo'

export { withoutQuery } from 'nuxtseo-shared/utils'

export function fetchIsland(e: H3Event, component: string, props: Record<string, any>, timeout?: number): Promise<NuxtIslandResponse> {
  const hashId = hash([component, props]).replaceAll('_', '-')
  // signal aborts the underlying fetch; `timeout` is the @nuxt/fetch-level
  // guard (some adapters honor one but not the other).
  const signal = timeout ? AbortSignal.timeout(timeout) : undefined
  return e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(props),
    },
    timeout,
    signal,
  })
}

export function createNitroRouteRuleMatcher(): ((path: string) => NitroRouteRules) {
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
      withoutBase(withoutTrailingSlash(path.split('?')[0]), app.baseURL),
    ).reverse()) as NitroRouteRules
  }
}
