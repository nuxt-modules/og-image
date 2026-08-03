import type { NuxtIslandResponse } from 'nuxt/app'
import type { H3Event } from '#nuxtseo/h3'
import type { OgImageOptions } from '../../types'
import { createNitroRouteRuleMatcher as createRouteRuleMatcher } from 'nuxtseo-shared/server'
import { useRuntimeConfig } from '#nuxtseo/nitro'
import { getIslandHash } from '#og-image/island-hash'

interface OgImageRouteRules {
  ogImage?: false | OgImageOptions & Record<string, any>
}

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

export function createNitroRouteRuleMatcher(): ((path: string) => OgImageRouteRules) {
  return createRouteRuleMatcher<OgImageRouteRules>(useRuntimeConfig())
}
