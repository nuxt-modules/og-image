import type { H3Event } from 'h3'
import type { NitroRouteRules } from 'nitropack'
import type { NuxtIslandResponse } from 'nuxt/app'
import { defu } from 'defu'
import { useRuntimeConfig } from 'nitropack/runtime'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { withoutBase, withoutTrailingSlash } from 'ufo'
import { getIslandHash } from '#og-image/island-hash'

export function fetchIsland(e: H3Event, component: string, props: Record<string, any>, timeout?: number): Promise<NuxtIslandResponse> {
  // The server rejects hash mismatches with `400 Invalid island request hash`, so the
  // hash comes from the installed Nuxt's own implementation (see the
  // `#og-image/island-hash` virtual in module.ts) and stays in step with algorithm changes.
  const hashId = getIslandHash({ name: component, props })
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
