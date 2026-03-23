import type { H3Event } from 'h3'
import type { NuxtIslandResponse } from 'nuxt/app'
import { hash } from 'ohash'

export { createNitroRouteRuleMatcher, withoutQuery } from '#nuxtseo-shared/server/kit'

export function fetchIsland(e: H3Event, component: string, props: Record<string, any>): Promise<NuxtIslandResponse> {
  const hashId = hash([component, props]).replaceAll('_', '-')
  return e.$fetch<NuxtIslandResponse>(`/__nuxt_island/${component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(props),
    },
  })
}
