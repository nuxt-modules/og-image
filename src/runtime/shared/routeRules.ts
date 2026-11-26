import type { OgImageOptions } from '../types'

export interface OgImageRouteRules {
  ogImage?: false | (OgImageOptions & Record<string, any>)
}

export type OgImageRouteRuleMatcher = (path: string) => OgImageRouteRules

export interface RouteRuleRuntimeConfig {
  app?: { baseURL?: string }
  nitro?: { routeRules?: Record<string, any> }
}

const EMPTY_MATCHER: OgImageRouteRuleMatcher = () => ({})
const MAX_SIGNATURE_CACHE_ENTRIES = 16

/**
 * Cache compiled `radix3` route-rule matchers across SSR requests.
 *
 * - Nitro 3 and Nitro 2 event-less `useRuntimeConfig()` reuse the same `routeRules`
 *   object reference across requests, so the `WeakMap` hits in O(1).
 * - Nitro 2 `useRuntimeConfig(event)` clones `runtimeConfig` via `klona` on every
 *   request, so we filter down to only `ogImage` rules and cache by their serialized
 *   signature in a bounded `Map` to avoid per-request `radix3` rebuilds without
 *   leaking across distinct test configurations.
 */
export function createCachedRouteRuleMatcher(
  createMatcher: (runtimeConfig: RouteRuleRuntimeConfig) => OgImageRouteRuleMatcher,
): (runtimeConfig?: RouteRuleRuntimeConfig) => OgImageRouteRuleMatcher {
  const byRouteRulesRef = new WeakMap<object, { baseURL: string, matcher: OgImageRouteRuleMatcher }>()
  const bySignature = new Map<string, OgImageRouteRuleMatcher>()

  return (runtimeConfig?: RouteRuleRuntimeConfig): OgImageRouteRuleMatcher => {
    const routeRules = runtimeConfig?.nitro?.routeRules
    if (!routeRules || typeof routeRules !== 'object')
      return EMPTY_MATCHER

    const baseURL = runtimeConfig?.app?.baseURL || '/'
    const cachedByRef = byRouteRulesRef.get(routeRules)
    if (cachedByRef && cachedByRef.baseURL === baseURL)
      return cachedByRef.matcher

    const routes = Object.keys(routeRules)
    let ogImageRules: Record<string, { ogImage: OgImageRouteRules['ogImage'] }> | undefined
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]!
      const rule = routeRules[route]
      if (rule && typeof rule === 'object' && rule.ogImage !== undefined) {
        ogImageRules ||= {}
        ogImageRules[route] = { ogImage: rule.ogImage }
      }
    }

    if (!ogImageRules) {
      byRouteRulesRef.set(routeRules, { baseURL, matcher: EMPTY_MATCHER })
      return EMPTY_MATCHER
    }

    let signature: string | undefined
    try {
      signature = JSON.stringify([baseURL, ogImageRules])
    }
    catch {
      // Non-serializable rule values (e.g. circular refs or BigInt) cannot be keyed; build uncached.
    }

    if (signature !== undefined) {
      const cachedBySignature = bySignature.get(signature)
      if (cachedBySignature) {
        byRouteRulesRef.set(routeRules, { baseURL, matcher: cachedBySignature })
        return cachedBySignature
      }
    }

    const matcher = createMatcher({
      app: { baseURL },
      nitro: { routeRules: ogImageRules },
    })

    if (signature !== undefined) {
      if (bySignature.size >= MAX_SIGNATURE_CACHE_ENTRIES) {
        const oldestKey = bySignature.keys().next().value
        if (oldestKey !== undefined)
          bySignature.delete(oldestKey)
      }
      bySignature.set(signature, matcher)
    }
    byRouteRulesRef.set(routeRules, { baseURL, matcher })
    return matcher
  }
}
