import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'
import { withoutBase, withoutTrailingSlash } from 'ufo'
import type { NitroRouteRules } from 'nitropack'
import { useRuntimeConfig } from '#imports'

export function withoutQuery(path: string) {
  return path.split('?')[0]
}

export function createNitroRouteRuleMatcher() {
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
