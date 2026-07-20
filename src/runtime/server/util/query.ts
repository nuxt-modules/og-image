import type { H3Event } from 'h3'
import { getQuery } from 'ufo'

/**
 * Parse query parameters from the event path without relying on the H3 event
 * implementation. Nitro adapters can pass an H3 v1 event to bundled H3 v2
 * utilities, where getQuery(event) treats the relative req.url as absolute.
 */
export function getEventQuery(event: H3Event) {
  return getQuery(event.path)
}
