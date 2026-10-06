import type { RequestEvent } from 'nuxt/server'
import { getNitroOrigin } from '#site-config/server/composables'

/** Site Config captures the request origin before renderer and cache hooks run. */
export function getOgImageOrigin(event: Pick<RequestEvent, 'context'>): string {
  return getNitroOrigin({ context: event.context })
}
